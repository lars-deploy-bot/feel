/**
 * Workspace Validation for MCP Tools
 *
 * Ensures tools can only operate on allowed workspace paths.
 * Critical security boundary - prevents path traversal attacks.
 */

import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { SECURITY } from "@webalive/site-controller"

const ALLOWED_WORKSPACE_BASES = SECURITY.ALLOWED_WORKSPACE_BASES

/**
 * Validates that a workspace path is within allowed boundaries
 *
 * @throws Error if path is invalid or outside allowed workspaces
 */
export function validateWorkspacePath(workspaceRoot: string): void {
  // Normalize and resolve path (handles .., symlinks, etc.)
  const resolvedPath = resolve(workspaceRoot)

  // Check if path is within any allowed base (must be subdirectory or exact match)
  const isAllowed = ALLOWED_WORKSPACE_BASES.some(base => {
    // Path must start with base and either be exact match or have / after base
    return resolvedPath === base || resolvedPath.startsWith(`${base}/`)
  })

  if (!isAllowed) {
    throw new Error(
      `Invalid workspace path. Must be within: ${ALLOWED_WORKSPACE_BASES.join(" or ")}\nProvided: ${resolvedPath}`,
    )
  }

  // Verify path exists
  if (!existsSync(resolvedPath)) {
    throw new Error(`Workspace path does not exist: ${resolvedPath}`)
  }
}

/**
 * Checks if workspace has a package.json (is a Node.js project)
 */
export function hasPackageJson(workspaceRoot: string): boolean {
  return existsSync(resolve(workspaceRoot, "package.json"))
}
