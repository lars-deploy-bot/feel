/**
 * E2B MCP Server
 *
 * Provides Read, Write, Edit, Glob, Grep, and Bash tools that
 * execute against an E2B sandbox instead of the local filesystem. Tool names
 * and input schemas match the SDK built-ins exactly so Claude uses them naturally.
 *
 * The SDK built-in tools are disabled via `disallowedTools` when this server is active.
 * Claude sees `mcp__e2b__Read` etc. with identical schemas to what it's trained on.
 */

import * as path from "node:path"
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk"
import { buildPreviewUrl, TOOL_LIMITS, truncateOutput } from "@webalive/shared"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import type { Sandbox } from "e2b"
import { z } from "zod"
import { SANDBOX_WORKSPACE_ROOT } from "./manager.js"

// =============================================================================
// SHARED HELPERS
// =============================================================================

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] }
}

function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true }
}

/** Optional callback for reporting errors to the caller (e.g. Sentry). */
export type E2bErrorReporter = (error: Error, context: Record<string, unknown>) => void

/** No-op reporter used when no callback is provided. */
const noopReporter: E2bErrorReporter = () => {}

/**
 * SECURITY: Validate that a file path is within the sandbox workspace root.
 * Resolves relative paths against SANDBOX_WORKSPACE_ROOT.
 * Returns { resolved } on success or { error } on traversal attempt.
 * Security violations are reported via the error reporter callback (Sentry in production).
 */
function resolveWorkspacePath(
  filePath: string,
  toolName: string,
  reportError: E2bErrorReporter,
): { resolved: string } | { error: string } {
  const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(SANDBOX_WORKSPACE_ROOT, filePath)
  if (!isPathWithinWorkspace(resolved, SANDBOX_WORKSPACE_ROOT)) {
    const message = `[E2B_SECURITY] Path traversal blocked: tool=${toolName}, path=${filePath}, resolved=${resolved}`
    reportError(new Error(message), { tool: toolName, path: filePath, resolved, allowed: SANDBOX_WORKSPACE_ROOT })
    return { error: `Path must be within ${SANDBOX_WORKSPACE_ROOT}. Got: ${filePath}` }
  }
  return { resolved }
}

/** Config for preview URL generation */
export interface E2bMcpConfig {
  /** The workspace hostname, e.g. "larry.alive.best" */
  hostname: string
  /** The preview base domain, e.g. "alive.best" */
  previewBase: string
}

/**
 * Detect port numbers in command output (e.g. "localhost:3000", "port 5173", ":8080")
 * and append the preview URL so Claude can share it with the user.
 */
function appendPortUrls(output: string, hostname: string, previewBase: string): string {
  const portPattern = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})|(?:port\s+)(\d{2,5})/gi
  const ports = new Set<string>()

  for (const match of output.matchAll(portPattern)) {
    const port = match[1] || match[2]
    if (port) ports.add(port)
  }

  if (ports.size === 0) return output

  const url = buildPreviewUrl(hostname, previewBase)
  return `${output}\n\nPreview: ${url}\nShare this URL with visitors — NOT localhost.`
}

// =============================================================================
// FILE TOOLS
// =============================================================================

const readTool = (sandbox: Sandbox, reportError: E2bErrorReporter) => {
  const NAME = "Read"
  return tool(
    NAME,
    "Reads a file from the workspace filesystem. " +
      "The file_path parameter must be an absolute path, not a relative path. " +
      `By default, it reads up to ${TOOL_LIMITS.READ_DEFAULT_LINES} lines starting from the beginning of the file. ` +
      "You can optionally specify a line offset and limit (especially handy for long files). " +
      "Results are returned using cat -n format, with line numbers starting at 1.",
    {
      file_path: z.string().describe("The absolute path to the file to read"),
      offset: z
        .number()
        .optional()
        .describe("The line number to start reading from. Only provide if the file is too large to read at once"),
      limit: z
        .number()
        .optional()
        .describe("The number of lines to read. Only provide if the file is too large to read at once."),
    },
    async ({ file_path, offset, limit }) => {
      const result = resolveWorkspacePath(file_path, NAME, reportError)
      if ("error" in result) return errorResult(result.error)
      try {
        const content = await sandbox.files.read(result.resolved)
        const lines = content.split("\n")

        const start = offset ? offset - 1 : 0
        const count = limit ?? lines.length
        const slice = lines.slice(start, start + count)

        const formatted = slice.map((line, i) => `${String(start + i + 1).padStart(6)}\t${line}`).join("\n")
        return textResult(formatted)
      } catch (err) {
        return errorResult(`Failed to read ${file_path}: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )
}

const writeTool = (sandbox: Sandbox, reportError: E2bErrorReporter) => {
  const NAME = "Write"
  return tool(
    NAME,
    "Writes a file to the workspace filesystem. " +
      "This tool will overwrite the existing file if there is one at the provided path. " +
      "Prefer the Edit tool for modifying existing files — it only sends the diff.",
    {
      file_path: z.string().describe("The absolute path to the file to write (must be absolute, not relative)"),
      content: z.string().describe("The content to write to the file"),
    },
    async ({ file_path, content }) => {
      const result = resolveWorkspacePath(file_path, NAME, reportError)
      if ("error" in result) return errorResult(result.error)
      try {
        await sandbox.files.write(result.resolved, content)
        return textResult(`Successfully wrote to ${file_path}`)
      } catch (err) {
        return errorResult(`Failed to write ${file_path}: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )
}

/**
 * Shared string-edit logic for the Edit tool.
 * Validates inputs, reads file, performs replacement, writes back.
 */
async function performStringEdit(
  sandbox: Sandbox,
  resolvedPath: string,
  displayPath: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
) {
  if (oldString === newString) {
    return errorResult("old_string and new_string are the same")
  }

  const content = await sandbox.files.read(resolvedPath)

  if (!content.includes(oldString)) {
    return errorResult(`old_string not found in ${resolvedPath}`)
  }

  if (!replaceAll) {
    const occurrences = content.split(oldString).length - 1
    if (occurrences > 1) {
      return errorResult(
        `old_string appears ${occurrences} times in the file. Use replace_all or provide more context to make it unique.`,
      )
    }
  }

  const updated = replaceAll ? content.replaceAll(oldString, newString) : content.replace(oldString, newString)

  await sandbox.files.write(resolvedPath, updated)
  return textResult(`Successfully edited ${displayPath}`)
}

const editTool = (sandbox: Sandbox, reportError: E2bErrorReporter) => {
  const NAME = "Edit"
  return tool(
    NAME,
    "Performs exact string replacements in files. " +
      "The edit will FAIL if old_string is not unique in the file. " +
      "Either provide a larger string with more surrounding context to make it unique or use replace_all. " +
      "Use replace_all for replacing and renaming strings across the file.",
    {
      file_path: z.string().describe("The absolute path to the file to modify"),
      old_string: z.string().describe("The text to replace"),
      new_string: z.string().describe("The text to replace it with (must be different from old_string)"),
      replace_all: z
        .boolean()
        .optional()
        .default(false)
        .describe("Replace all occurrences of old_string (default false)"),
    },
    async ({ file_path, old_string, new_string, replace_all }) => {
      const result = resolveWorkspacePath(file_path, NAME, reportError)
      if ("error" in result) return errorResult(result.error)
      try {
        return await performStringEdit(sandbox, result.resolved, file_path, old_string, new_string, replace_all)
      } catch (err) {
        return errorResult(`Failed to edit ${file_path}: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )
}

// =============================================================================
// SEARCH TOOLS
// =============================================================================

const globTool = (sandbox: Sandbox, reportError: E2bErrorReporter) => {
  const NAME = "Glob"
  return tool(
    NAME,
    "Find files under the workspace using a glob pattern. Returns matching file paths sorted by modification time.",
    {
      pattern: z.string().describe("Glob pattern, e.g. **/*.ts"),
      path: z.string().optional().describe("Optional absolute search root directory (defaults to workspace root)"),
    },
    async ({ pattern, path: searchPath }) => {
      const searchRoot = searchPath ?? SANDBOX_WORKSPACE_ROOT
      const pathResult = resolveWorkspacePath(searchRoot, NAME, reportError)
      if ("error" in pathResult) return errorResult(pathResult.error)

      try {
        const cmd = `rg --files --hidden -g ${JSON.stringify(pattern)} ${JSON.stringify(pathResult.resolved)}`
        const result = await sandbox.commands.run(cmd, {
          timeoutMs: TOOL_LIMITS.SEARCH_TIMEOUT_MS,
          cwd: SANDBOX_WORKSPACE_ROOT,
        })

        const output = (result.stdout || "").trim()
        if (!output) return textResult("(no matches)")

        return textResult(truncateOutput(output, TOOL_LIMITS.SEARCH_OUTPUT))
      } catch (err) {
        return errorResult(`Glob failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )
}

const grepTool = (sandbox: Sandbox, reportError: E2bErrorReporter) => {
  const NAME = "Grep"
  return tool(
    NAME,
    "Search file content within the workspace using ripgrep and return matching lines with line numbers.",
    {
      pattern: z.string().describe("Regex or plain text pattern to search"),
      path: z.string().optional().describe("Optional absolute search root directory (defaults to workspace root)"),
      include: z.string().optional().describe("Optional glob include filter, e.g. *.tsx"),
      max_results: z
        .number()
        .optional()
        .describe(`Maximum number of matches to return (default ${TOOL_LIMITS.GREP_DEFAULT_MAX_RESULTS})`),
    },
    async ({ pattern, path: searchPath, include, max_results }) => {
      const searchRoot = searchPath ?? SANDBOX_WORKSPACE_ROOT
      const pathResult = resolveWorkspacePath(searchRoot, NAME, reportError)
      if ("error" in pathResult) return errorResult(pathResult.error)

      try {
        const maxResults = Math.min(TOOL_LIMITS.GREP_MAX_RESULTS, max_results ?? TOOL_LIMITS.GREP_DEFAULT_MAX_RESULTS)

        const args = ["rg", "--line-number", "--no-heading", "--color", "never", "--max-count", String(maxResults)]
        if (include) args.push("--glob", JSON.stringify(include))
        args.push(JSON.stringify(pattern), JSON.stringify(pathResult.resolved))

        const result = await sandbox.commands.run(args.join(" "), {
          timeoutMs: TOOL_LIMITS.SEARCH_TIMEOUT_MS,
          cwd: SANDBOX_WORKSPACE_ROOT,
        })

        const output = (result.stdout || "").trim()
        if (!output) return textResult("(no matches)")

        return textResult(truncateOutput(output, TOOL_LIMITS.SEARCH_OUTPUT))
      } catch (err) {
        return errorResult(`Grep failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )
}

// =============================================================================
// SHELL TOOL
// =============================================================================

const bashTool = (sandbox: Sandbox, mcpConfig: E2bMcpConfig) =>
  tool(
    "Bash",
    "Executes a given bash command and returns its output. " +
      "The working directory persists between commands, but shell state does not. " +
      "Use background: true for long-running commands (e.g. dev servers) — returns immediately with the PID. " +
      "IMPORTANT: This runs inside a cloud sandbox. localhost is NOT accessible to the user. " +
      "When a server starts, share the preview URL shown in the output, never localhost.",
    {
      command: z.string().describe("The command to execute"),
      timeout: z
        .number()
        .optional()
        .describe(`Optional timeout in milliseconds (max ${TOOL_LIMITS.BASH_MAX_TIMEOUT_MS})`),
      background: z
        .boolean()
        .optional()
        .describe(
          "Run the command in the background. Returns immediately with PID. Use for dev servers and long-running processes.",
        ),
      description: z
        .string()
        .optional()
        .describe("Clear, concise description of what this command does in active voice."),
    },
    async ({ command, timeout, background }) => {
      try {
        if (background) {
          const handle = await sandbox.commands.run(command, {
            background: true,
            cwd: SANDBOX_WORKSPACE_ROOT,
          })
          return textResult(`Background process started (PID: ${handle.pid})`)
        }

        const timeoutMs = Math.min(TOOL_LIMITS.BASH_MAX_TIMEOUT_MS, timeout ?? TOOL_LIMITS.BASH_TIMEOUT_MS)
        const result = await sandbox.commands.run(command, { timeoutMs, cwd: SANDBOX_WORKSPACE_ROOT })

        let output = ""
        if (result.stdout) output += result.stdout
        if (result.stderr) output += (output ? "\n" : "") + result.stderr
        if (result.exitCode !== 0) {
          output += `\nExit code: ${result.exitCode}`
        }
        output = output || "(no output)"

        return textResult(
          appendPortUrls(truncateOutput(output, TOOL_LIMITS.BASH_OUTPUT), mcpConfig.hostname, mcpConfig.previewBase),
        )
      } catch (err) {
        return errorResult(`Command failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )

// =============================================================================
// SERVER
// =============================================================================

export function createE2bMcp(sandbox: Sandbox, reportError: E2bErrorReporter | undefined, config: E2bMcpConfig) {
  const report = reportError ?? noopReporter
  return createSdkMcpServer({
    name: "e2b",
    version: "1.0.0",
    tools: [
      readTool(sandbox, report),
      writeTool(sandbox, report),
      editTool(sandbox, report),
      globTool(sandbox, report),
      grepTool(sandbox, report),
      bashTool(sandbox, config),
    ],
  })
}
