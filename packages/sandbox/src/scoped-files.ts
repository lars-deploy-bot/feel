/**
 * Scoped Filesystem
 *
 * Proxies E2B SDK's `Sandbox.files` with path validation.
 * All paths are relative to SANDBOX_WORKSPACE_ROOT. Traversal throws.
 * Method names match the E2B SDK so callers don't learn a new API.
 */

import * as path from "node:path"
import type { Sandbox } from "e2b"
import { resolveSandboxWorkspacePath } from "./runtime-facade.js"

export interface SandboxFileEntry {
  name: string
  kind: "file" | "directory"
  /** Relative path from workspace root */
  path: string
}

export interface ScopedFilesystem {
  read(relativePath: string): Promise<string>
  write(relativePath: string, content: string | ArrayBuffer): Promise<void>
  list(relativePath: string): Promise<SandboxFileEntry[]>
  makeDir(relativePath: string): Promise<void>
  remove(relativePath: string): Promise<void>
  getEntryKind(relativePath: string): Promise<"file" | "directory" | "unknown">
}

function resolve(relativePath: string, allowWorkspaceRoot: boolean): string {
  return resolveSandboxWorkspacePath(relativePath, { allowWorkspaceRoot })
}

function normalizeListedPath(relativePath: string, entryName: string): string {
  const normalized = path.posix.normalize(relativePath)
  if (normalized === "." || normalized === "") {
    return entryName
  }
  return path.posix.join(normalized, entryName)
}

export function createScopedFilesystem(sandbox: Sandbox): ScopedFilesystem {
  return {
    async read(relativePath: string): Promise<string> {
      const sandboxPath = resolve(relativePath, false)
      return sandbox.files.read(sandboxPath)
    },

    async write(relativePath: string, content: string | ArrayBuffer): Promise<void> {
      const sandboxPath = resolve(relativePath, false)
      await sandbox.files.write(sandboxPath, content)
    },

    async list(relativePath: string): Promise<SandboxFileEntry[]> {
      const sandboxPath = resolve(relativePath, true)
      const entries = await sandbox.files.list(sandboxPath)

      return entries.map(entry => ({
        name: entry.name,
        kind: entry.type === "dir" ? "directory" : "file",
        path: normalizeListedPath(relativePath, entry.name),
      }))
    },

    async makeDir(relativePath: string): Promise<void> {
      const sandboxPath = resolve(relativePath, false)
      try {
        await sandbox.files.makeDir(sandboxPath)
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("exists")) {
          throw error
        }
      }
    },

    async remove(relativePath: string): Promise<void> {
      const sandboxPath = resolve(relativePath, false)
      await sandbox.files.remove(sandboxPath)
    },

    async getEntryKind(relativePath: string): Promise<"file" | "directory" | "unknown"> {
      const sandboxPath = resolve(relativePath, false)
      const parentDir = path.posix.dirname(sandboxPath)
      const baseName = path.posix.basename(sandboxPath)

      try {
        const entries = await sandbox.files.list(parentDir)
        const entry = entries.find(candidate => candidate.name === baseName)
        if (!entry) {
          return "unknown"
        }
        return entry.type === "dir" ? "directory" : "file"
      } catch {
        return "unknown"
      }
    },
  }
}
