/**
 * Workspace and path validation guards
 * These guards prevent path traversal attacks and validate workspace constraints
 */

/**
 * Check if a hostname is in terminal mode (requires explicit workspace)
 * Terminal mode hostnames start with "terminal." or contain ".terminal."
 *
 * Examples:
 * - terminal.goalive.nl → true
 * - staging.terminal.goalive.nl → true
 * - demo.goalive.nl → false
 *
 * TODO: This is not safe if someone creates a domain like bla.staging.terminal.goalive.nl.joost.nl
 * Should validate that .terminal. is followed by a known domain (e.g., .terminal.goalive.nl)
 */
export function isTerminalMode(host: string): boolean {
  return host.startsWith("terminal.") || host.includes(".terminal.")
}

/**
 * Check if a workspace string is valid (not empty, is string type)
 */
export function isValidWorkspaceString(workspace: unknown): workspace is string {
  return typeof workspace === "string" && workspace.length > 0
}

/**
 * Check if a path is within workspace boundaries (prevents path traversal)
 * Both paths should be absolute/resolved
 */
export function isPathWithinWorkspace(normalizedPath: string, workspacePath: string, pathSeparator: string): boolean {
  return normalizedPath === workspacePath || normalizedPath.startsWith(workspacePath + pathSeparator)
}

/**
 * Check if path contains potential traversal attempts (..)
 */
export function containsPathTraversal(path: string): boolean {
  return path.includes("..")
}

/**
 * Check if path is a valid workspace pattern (e.g., webalive/sites/... or just site name)
 */
export function isValidWorkspacePath(workspace: string): boolean {
  return workspace.startsWith("webalive/sites/") || !workspace.includes("/")
}

/**
 * Validate workspace resolution result structure
 */
export function isWorkspaceResolved(result: unknown): result is { success: true; workspace: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as any).success === true &&
    typeof (result as any).workspace === "string"
  )
}

/**
 * Check if workspace result has an error
 */
export function isWorkspaceError(result: unknown): result is { success: false; response: any } {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as any).success === false &&
    (result as any).response !== undefined
  )
}
