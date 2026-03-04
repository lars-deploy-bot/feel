/**
 * E2B MCP Server
 *
 * Provides Read, Write, Edit, and Bash tools that execute against an E2B sandbox
 * instead of the local filesystem. Tool names and input schemas match the SDK
 * built-ins exactly so Claude uses them naturally.
 *
 * The SDK built-in tools are disabled via `disallowedTools` when this server is active.
 * Claude sees `mcp__e2b__Read` etc. with identical schemas to what it's trained on.
 */

import * as path from "node:path"
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk"
import type { Sandbox } from "e2b"
import { z } from "zod"
import { SANDBOX_WORKSPACE_ROOT } from "./manager.js"

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
 * Resolves symlinks/.. to prevent traversal. Returns error message if outside, null if OK.
 * Security violations are reported via the error reporter callback (Sentry in production).
 */
function assertWorkspacePath(filePath: string, toolName: string, reportError: E2bErrorReporter): string | null {
  const resolved = path.resolve(filePath)
  if (resolved !== SANDBOX_WORKSPACE_ROOT && !resolved.startsWith(`${SANDBOX_WORKSPACE_ROOT}/`)) {
    const message = `[E2B_SECURITY] Path traversal blocked: tool=${toolName}, path=${filePath}, resolved=${resolved}`
    reportError(new Error(message), { tool: toolName, path: filePath, resolved, allowed: SANDBOX_WORKSPACE_ROOT })
    return `Path must be within ${SANDBOX_WORKSPACE_ROOT}. Got: ${filePath}`
  }
  return null
}

const readTool = (sandbox: Sandbox, reportError: E2bErrorReporter) => {
  const NAME = "Read"
  return tool(
    NAME,
    "Reads a file from the workspace filesystem. " +
      "The file_path parameter must be an absolute path, not a relative path. " +
      "By default, it reads up to 2000 lines starting from the beginning of the file. " +
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
      const pathError = assertWorkspacePath(file_path, NAME, reportError)
      if (pathError) return errorResult(pathError)
      try {
        const content = await sandbox.files.read(file_path)
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

const writeTool = (sandbox: Sandbox, reportError: E2bErrorReporter) =>
  tool(
    "Write",
    "Writes a file to the workspace filesystem. " +
      "This tool will overwrite the existing file if there is one at the provided path. " +
      "Prefer the Edit tool for modifying existing files — it only sends the diff.",
    {
      file_path: z.string().describe("The absolute path to the file to write (must be absolute, not relative)"),
      content: z.string().describe("The content to write to the file"),
    },
    async ({ file_path, content }) => {
      const pathError = assertWorkspacePath(file_path, "Write", reportError)
      if (pathError) return errorResult(pathError)
      try {
        await sandbox.files.write(file_path, content)
        return textResult(`Successfully wrote to ${file_path}`)
      } catch (err) {
        return errorResult(`Failed to write ${file_path}: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )

const editTool = (sandbox: Sandbox, reportError: E2bErrorReporter) =>
  tool(
    "Edit",
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
      const pathError = assertWorkspacePath(file_path, "Edit", reportError)
      if (pathError) return errorResult(pathError)
      try {
        if (old_string === new_string) {
          return errorResult("old_string and new_string are the same")
        }

        const content = await sandbox.files.read(file_path)

        if (!content.includes(old_string)) {
          return errorResult(`old_string not found in ${file_path}`)
        }

        if (!replace_all) {
          const occurrences = content.split(old_string).length - 1
          if (occurrences > 1) {
            return errorResult(
              `old_string appears ${occurrences} times in the file. Use replace_all or provide more context to make it unique.`,
            )
          }
        }

        const updated = replace_all
          ? content.replaceAll(old_string, new_string)
          : content.replace(old_string, new_string)

        await sandbox.files.write(file_path, updated)
        return textResult(`Successfully edited ${file_path}`)
      } catch (err) {
        return errorResult(`Failed to edit ${file_path}: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )

const bashTool = (sandbox: Sandbox) =>
  tool(
    "Bash",
    "Executes a given bash command and returns its output. " +
      "The working directory persists between commands, but shell state does not.",
    {
      command: z.string().describe("The command to execute"),
      timeout: z.number().optional().describe("Optional timeout in milliseconds (max 600000)"),
      description: z
        .string()
        .optional()
        .describe("Clear, concise description of what this command does in active voice."),
    },
    async ({ command, timeout }) => {
      try {
        const timeoutMs = timeout ? Math.min(timeout, 600_000) : 120_000
        const result = await sandbox.commands.run(command, { timeoutMs, cwd: SANDBOX_WORKSPACE_ROOT })

        let output = ""
        if (result.stdout) output += result.stdout
        if (result.stderr) output += (output ? "\n" : "") + result.stderr
        if (result.exitCode !== 0) {
          output += `\nExit code: ${result.exitCode}`
        }
        return textResult(output || "(no output)")
      } catch (err) {
        return errorResult(`Command failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  )

export function createE2bMcp(sandbox: Sandbox, reportError?: E2bErrorReporter) {
  const report = reportError ?? noopReporter
  return createSdkMcpServer({
    name: "e2b",
    version: "1.0.0",
    tools: [readTool(sandbox, report), writeTool(sandbox, report), editTool(sandbox, report), bashTool(sandbox)],
  })
}
