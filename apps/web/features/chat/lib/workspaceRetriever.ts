import { existsSync } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { normalizeDomain } from "@/features/manager/lib/domain-utils"
import { ErrorCodes } from "@/lib/error-codes"

export interface GetWorkspaceParams {
  host: string
  body: Record<string, unknown>
  requestId: string
}

export type WorkspaceResult =
  | {
      success: true
      workspace: string
    }
  | {
      success: false
      response: NextResponse
    }

/**
 * Determines the workspace directory based on request body
 *
 * Always terminal mode:
 * - Expects 'workspace' parameter in request body
 * - Must start with 'webalive/sites/' (or will be auto-prepended)
 * - Returns full path: /srv/{workspace}
 */
export function getWorkspace({ host, body, requestId }: GetWorkspaceParams): WorkspaceResult {
  console.log(`[Workspace ${requestId}] Resolving workspace for host: ${host}`)

  // Always terminal mode - resolve workspace from request body
  return getTerminalWorkspace(body, requestId)
}

function getTerminalWorkspace(body: any, requestId: string): WorkspaceResult {
  const customWorkspace = body?.workspace

  if (!customWorkspace || typeof customWorkspace !== "string") {
    console.error(`[Workspace ${requestId}] Missing or invalid workspace parameter`)
    return {
      success: false,
      response: NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_MISSING,
          message: "Terminal hostname requires workspace parameter in request body (string)",
        },
        { status: 400 },
      ),
    }
  }

  // Allow "test" workspace in local development mode (for E2E tests)
  if (process.env.BRIDGE_ENV === "local" && customWorkspace === "test") {
    console.log(`[Workspace ${requestId}] Using test workspace in local mode`)
    return {
      success: true,
      workspace: "/tmp/test-workspace", // Dummy path for test workspace
    }
  }

  // Normalize domain name to handle protocols, www, uppercase, etc.
  const normalizedDomain = normalizeDomain(customWorkspace)
  console.log(`[Workspace ${requestId}] Normalized workspace: ${customWorkspace} → ${normalizedDomain}`)

  // Auto-prepend webalive/sites/ if not present, and always append /user
  let workspacePath = normalizedDomain.startsWith("webalive/sites/")
    ? normalizedDomain
    : `webalive/sites/${normalizedDomain}`

  // Always append /user to the workspace path
  if (!workspacePath.endsWith("/user")) {
    workspacePath = `${workspacePath}/user`
  }

  // Prevent path traversal attacks
  const normalizedWorkspace = path.normalize(workspacePath)
  if (normalizedWorkspace !== workspacePath || normalizedWorkspace.includes("..")) {
    console.error(`[Workspace ${requestId}] Potential path traversal in workspace: ${workspacePath}`)
    return {
      success: false,
      response: NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_INVALID,
          message: "Invalid workspace path detected",
        },
        { status: 400 },
      ),
    }
  }

  const fullPath = path.join("/srv", normalizedWorkspace)

  // Check if workspace directory exists
  if (!existsSync(fullPath)) {
    console.error(`[Workspace ${requestId}] Workspace directory does not exist: ${fullPath}`)
    return {
      success: false,
      response: NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_NOT_FOUND,
          message: `Workspace directory not found: ${normalizedWorkspace}`,
          details: {
            workspace: normalizedWorkspace,
            fullPath,
            suggestion: `Create the workspace directory at: ${fullPath}`,
          },
        },
        { status: 404 },
      ),
    }
  }

  console.log(`[Workspace ${requestId}] Using custom workspace: ${fullPath}`)
  return {
    success: true,
    workspace: fullPath,
  }
}
