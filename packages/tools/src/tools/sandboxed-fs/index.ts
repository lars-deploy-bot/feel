import { spawn } from "node:child_process"
import { lstat, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, resolve } from "node:path"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { isHeavyBashCommand, truncateOutput } from "@webalive/shared"
import { isPathWithinWorkspace } from "@webalive/shared/path-security"
import { z } from "zod"
import type { ToolResult } from "../../lib/api-client.js"
import { sanitizeSubprocessEnv } from "../../lib/env-sanitizer.js"
import { safeSpawnSync } from "../../lib/safe-spawn.js"
import { validateWorkspacePath } from "../../lib/workspace-validator.js"

const DEFAULT_READ_LIMIT = 2000
const DEFAULT_GREP_MAX_RESULTS = 50
const MAX_GREP_MAX_RESULTS = 200
const DEFAULT_BASH_TIMEOUT_MS = 120_000
const MAX_BASH_TIMEOUT_MS = 600_000

export const sandboxedFsReadParamsSchema = {
  file_path: z.string().describe("Absolute or workspace-relative path to the file"),
  offset: z.number().int().positive().optional().describe("1-based line number to start reading from"),
  limit: z.number().int().positive().optional().describe("Maximum number of lines to return"),
}

export const sandboxedFsWriteParamsSchema = {
  file_path: z.string().describe("Absolute or workspace-relative path to the file"),
  content: z.string().describe("File content to write"),
}

export const sandboxedFsEditParamsSchema = {
  file_path: z.string().describe("Absolute or workspace-relative path to the file"),
  old_string: z.string().describe("Exact text to replace"),
  new_string: z.string().describe("Replacement text"),
  replace_all: z.boolean().optional().default(false).describe("Replace all matches instead of exactly one"),
}

export const sandboxedFsNotebookEditParamsSchema = {
  notebook_path: z.string().describe("Absolute or workspace-relative path to the .ipynb file"),
  old_string: z.string().describe("Exact text to replace in notebook JSON"),
  new_string: z.string().describe("Replacement text"),
  replace_all: z.boolean().optional().default(false).describe("Replace all matches instead of exactly one"),
}

export const sandboxedFsGlobParamsSchema = {
  pattern: z.string().describe("Glob pattern, e.g. **/*.ts"),
  path: z.string().optional().describe("Optional absolute or workspace-relative search root"),
}

export const sandboxedFsGrepParamsSchema = {
  pattern: z.string().describe("Regex or plain text pattern to search"),
  path: z.string().optional().describe("Optional absolute or workspace-relative search root"),
  include: z.string().optional().describe("Optional glob include filter, e.g. *.tsx"),
  max_results: z.number().int().positive().optional().describe("Maximum number of matches to return (default 50)"),
}

export const sandboxedFsBashParamsSchema = {
  command: z.string().describe("Command to execute"),
  timeout: z.number().int().positive().optional().describe("Timeout in milliseconds (max 600000)"),
  background: z.boolean().optional().describe("Run command detached in the background"),
  description: z.string().optional().describe("Short explanation of what the command does"),
}

function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: false }
}

function errorResult(message: string, details?: string): ToolResult {
  return {
    content: [{ type: "text", text: details ? `${message}\n\n${details}` : message }],
    isError: true,
  }
}

function getWorkspaceRoot(): string {
  const workspaceRoot = resolve(process.cwd())
  validateWorkspacePath(workspaceRoot)
  return workspaceRoot
}

function resolveWorkspacePath(inputPath: string, workspaceRoot: string): string {
  const trimmed = inputPath?.trim()
  if (!trimmed) {
    throw new Error("Path cannot be empty")
  }

  const resolvedPath = isAbsolute(trimmed) ? resolve(trimmed) : resolve(workspaceRoot, trimmed)
  if (!isPathWithinWorkspace(resolvedPath, workspaceRoot)) {
    throw new Error(`Path must stay within workspace: ${inputPath}`)
  }

  return resolvedPath
}

async function assertExistingFilePath(inputPath: string, workspaceRoot: string): Promise<string> {
  const resolvedPath = resolveWorkspacePath(inputPath, workspaceRoot)
  const realPath = await realpath(resolvedPath)

  if (!isPathWithinWorkspace(realPath, workspaceRoot)) {
    throw new Error(`Symlink escapes workspace boundary: ${inputPath}`)
  }

  const stats = await stat(realPath)
  if (!stats.isFile()) {
    throw new Error(`Expected a file but got non-file path: ${inputPath}`)
  }

  return realPath
}

async function assertSearchPath(inputPath: string | undefined, workspaceRoot: string): Promise<string> {
  const rawPath = inputPath && inputPath.trim().length > 0 ? inputPath : workspaceRoot
  const resolvedPath = resolveWorkspacePath(rawPath, workspaceRoot)
  const realPath = await realpath(resolvedPath)

  if (!isPathWithinWorkspace(realPath, workspaceRoot)) {
    throw new Error(`Search path escapes workspace boundary: ${rawPath}`)
  }

  return realPath
}

async function ensureWritableFilePath(inputPath: string, workspaceRoot: string): Promise<string> {
  const resolvedPath = resolveWorkspacePath(inputPath, workspaceRoot)
  const parentDir = dirname(resolvedPath)

  await mkdir(parentDir, { recursive: true })

  const realParent = await realpath(parentDir)
  if (!isPathWithinWorkspace(realParent, workspaceRoot)) {
    throw new Error(`Write path escapes workspace boundary: ${inputPath}`)
  }

  // If target already exists (including symlink), resolve and enforce boundary.
  // This blocks writes through in-workspace symlinks pointing outside.
  try {
    const existingStats = await lstat(resolvedPath)

    if (existingStats.isSymbolicLink()) {
      let realTarget: string
      try {
        realTarget = await realpath(resolvedPath)
      } catch {
        throw new Error(`Write target escapes workspace boundary: ${inputPath}`)
      }

      if (!isPathWithinWorkspace(realTarget, workspaceRoot)) {
        throw new Error(`Write target escapes workspace boundary: ${inputPath}`)
      }

      return resolvedPath
    }

    const realTarget = await realpath(resolvedPath)
    if (!isPathWithinWorkspace(realTarget, workspaceRoot)) {
      throw new Error(`Write target escapes workspace boundary: ${inputPath}`)
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      // New file path - safe to proceed.
    } else {
      throw error
    }
  }

  return resolvedPath
}

function formatReadOutput(content: string, offset?: number, limit?: number): string {
  const lines = content.split("\n")

  const startLine = offset && offset > 0 ? offset : 1
  const maxLines = limit && limit > 0 ? limit : DEFAULT_READ_LIMIT

  const startIndex = Math.max(0, startLine - 1)
  const slice = lines.slice(startIndex, startIndex + maxLines)

  return slice.map((line, i) => `${String(startIndex + i + 1).padStart(6)}\t${line}`).join("\n")
}

async function performStringEdit(
  filePath: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
  workspaceRoot: string,
): Promise<ToolResult> {
  if (oldString === newString) {
    return errorResult("old_string and new_string are identical")
  }

  const resolvedPath = await assertExistingFilePath(filePath, workspaceRoot)
  const content = await readFile(resolvedPath, "utf8")

  if (!content.includes(oldString)) {
    return errorResult(`old_string not found in ${filePath}`)
  }

  if (!replaceAll) {
    const occurrenceCount = content.split(oldString).length - 1
    if (occurrenceCount > 1) {
      return errorResult(
        `old_string appears ${occurrenceCount} times in ${filePath}`,
        "Use replace_all=true or provide a more specific old_string.",
      )
    }
  }

  const updated = replaceAll ? content.replaceAll(oldString, newString) : content.replace(oldString, newString)
  await writeFile(resolvedPath, updated, "utf8")

  return textResult(`Successfully edited ${filePath}`)
}

export const sandboxedFsReadTool = tool(
  "Read",
  "Read a UTF-8 text file within the current workspace. Path must stay within the workspace boundary.",
  sandboxedFsReadParamsSchema,
  async args => {
    const workspaceRoot = getWorkspaceRoot()

    try {
      const filePath = await assertExistingFilePath(args.file_path, workspaceRoot)
      const content = await readFile(filePath, "utf8")
      return textResult(formatReadOutput(content, args.offset, args.limit))
    } catch (error) {
      return errorResult("Read failed", error instanceof Error ? error.message : String(error))
    }
  },
)

export const sandboxedFsWriteTool = tool(
  "Write",
  "Write UTF-8 text to a file within the current workspace. Creates parent directories when needed.",
  sandboxedFsWriteParamsSchema,
  async args => {
    const workspaceRoot = getWorkspaceRoot()

    try {
      const filePath = await ensureWritableFilePath(args.file_path, workspaceRoot)
      await writeFile(filePath, args.content, "utf8")
      return textResult(`Successfully wrote ${args.file_path}`)
    } catch (error) {
      return errorResult("Write failed", error instanceof Error ? error.message : String(error))
    }
  },
)

export const sandboxedFsEditTool = tool(
  "Edit",
  "Perform exact string replacement in a workspace file. Fails when old_string is ambiguous unless replace_all=true.",
  sandboxedFsEditParamsSchema,
  async args => {
    const workspaceRoot = getWorkspaceRoot()

    try {
      return await performStringEdit(
        args.file_path,
        args.old_string,
        args.new_string,
        args.replace_all ?? false,
        workspaceRoot,
      )
    } catch (error) {
      return errorResult("Edit failed", error instanceof Error ? error.message : String(error))
    }
  },
)

export const sandboxedFsNotebookEditTool = tool(
  "NotebookEdit",
  "Compatibility shim for notebook edits. Applies string replacement to the notebook JSON file inside the workspace.",
  sandboxedFsNotebookEditParamsSchema,
  async args => {
    const workspaceRoot = getWorkspaceRoot()

    try {
      return await performStringEdit(
        args.notebook_path,
        args.old_string,
        args.new_string,
        args.replace_all ?? false,
        workspaceRoot,
      )
    } catch (error) {
      return errorResult("NotebookEdit failed", error instanceof Error ? error.message : String(error))
    }
  },
)

export const sandboxedFsGlobTool = tool(
  "Glob",
  "Find files under the workspace using a glob pattern (ripgrep --files -g).",
  sandboxedFsGlobParamsSchema,
  async args => {
    const workspaceRoot = getWorkspaceRoot()

    try {
      const searchRoot = await assertSearchPath(args.path, workspaceRoot)
      const result = safeSpawnSync("rg", ["--files", "--hidden", "-g", args.pattern, searchRoot], {
        cwd: workspaceRoot,
        timeout: 30_000,
      })

      if (result.error) {
        return errorResult("Glob failed", result.error.message)
      }

      if (result.status !== 0 && !result.stdout.trim()) {
        return textResult("(no matches)")
      }

      const output = result.stdout.trim()
      if (!output) {
        return textResult("(no matches)")
      }

      return textResult(truncateOutput(output, { maxLines: 400, maxChars: 20_000 }))
    } catch (error) {
      return errorResult("Glob failed", error instanceof Error ? error.message : String(error))
    }
  },
)

export const sandboxedFsGrepTool = tool(
  "Grep",
  "Search file content within the workspace using ripgrep and return matching lines with line numbers.",
  sandboxedFsGrepParamsSchema,
  async args => {
    const workspaceRoot = getWorkspaceRoot()

    try {
      const searchRoot = await assertSearchPath(args.path, workspaceRoot)
      const maxResults = Math.min(MAX_GREP_MAX_RESULTS, args.max_results ?? DEFAULT_GREP_MAX_RESULTS)

      const grepArgs = ["--line-number", "--no-heading", "--color", "never", "--max-count", String(maxResults)]
      if (args.include) {
        grepArgs.push("--glob", args.include)
      }
      grepArgs.push(args.pattern, searchRoot)

      const result = safeSpawnSync("rg", grepArgs, {
        cwd: workspaceRoot,
        timeout: 30_000,
      })

      if (result.error) {
        return errorResult("Grep failed", result.error.message)
      }

      if (result.status === 1 && !result.stdout.trim()) {
        return textResult("(no matches)")
      }

      if (result.status !== 0 && result.stderr.trim()) {
        return errorResult("Grep failed", result.stderr.trim())
      }

      const output = result.stdout.trim()
      if (!output) {
        return textResult("(no matches)")
      }

      return textResult(truncateOutput(output, { maxLines: 400, maxChars: 20_000 }))
    } catch (error) {
      return errorResult("Grep failed", error instanceof Error ? error.message : String(error))
    }
  },
)

export const sandboxedFsBashTool = tool(
  "Bash",
  "Execute a shell command in the workspace. Heavy monorepo commands are blocked for safety.",
  sandboxedFsBashParamsSchema,
  async args => {
    const workspaceRoot = getWorkspaceRoot()

    if (isHeavyBashCommand(args.command)) {
      return errorResult(
        "Command blocked by policy",
        "Heavy commands are disabled in site workspaces. Use targeted project commands instead.",
      )
    }

    if (args.background) {
      try {
        const child = spawn("bash", ["-lc", args.command], {
          cwd: workspaceRoot,
          detached: true,
          stdio: "ignore",
          env: sanitizeSubprocessEnv(),
        })
        child.unref()
        return textResult(`Background process started (pid: ${child.pid})`)
      } catch (error) {
        return errorResult("Background command failed", error instanceof Error ? error.message : String(error))
      }
    }

    try {
      const timeoutMs = Math.min(MAX_BASH_TIMEOUT_MS, args.timeout ?? DEFAULT_BASH_TIMEOUT_MS)
      const result = safeSpawnSync("bash", ["-lc", args.command], {
        cwd: workspaceRoot,
        timeout: timeoutMs,
        env: sanitizeSubprocessEnv(),
      })

      if (result.error) {
        return errorResult("Command failed to start", result.error.message)
      }

      let output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
      if (!output) {
        output = "(no output)"
      }

      if (typeof result.status === "number" && result.status !== 0) {
        output = `${output}\n\nExit code: ${result.status}`
        return {
          content: [{ type: "text", text: truncateOutput(output, { maxLines: 200, maxChars: 20_000 }) }],
          isError: true,
        }
      }

      return textResult(truncateOutput(output, { maxLines: 200, maxChars: 20_000 }))
    } catch (error) {
      return errorResult("Command execution failed", error instanceof Error ? error.message : String(error))
    }
  },
)
