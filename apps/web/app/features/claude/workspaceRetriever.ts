import { existsSync, statSync } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { normalizeDomain } from "@/lib/domain-utils"
import { ErrorCodes } from "@/lib/error-codes"

export interface WorkspaceRequest {
  host: string
  body: any
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
 * Determines the workspace directory based on hostname and request body
 *
 * For terminal.* hostnames:
 * - Expects 'workspace' parameter in request body
 * - Must start with 'webalive/sites/'
 * - Returns full path: /root/{workspace}
 *
 * For other hostnames:
 * - Uses WORKSPACE_BASE environment variable or default
 * - Returns: {WORKSPACE_BASE}/{host}/src
 */
export function getWorkspace({ host, body, requestId }: WorkspaceRequest): WorkspaceResult {
  console.log(`[Workspace ${requestId}] Resolving workspace for host: ${host}`)

  if (host.startsWith("terminal.")) {
    return getTerminalWorkspace(body, requestId)
  }
  return getHostnameWorkspace(host, requestId)
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

function getHostnameWorkspace(host: string, requestId: string): WorkspaceResult {
  // Check for local development mode using template seed repo
  if (process.env.BRIDGE_ENV === "local") {
    const templateWorkspace = process.env.LOCAL_TEMPLATE_PATH

    if (!templateWorkspace) {
      console.error(`[Workspace ${requestId}] BRIDGE_ENV=local but LOCAL_TEMPLATE_PATH not set`)
      return {
        success: false,
        response: NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.WORKSPACE_NOT_FOUND,
            message: "LOCAL_TEMPLATE_PATH environment variable required when BRIDGE_ENV=local",
            details: {
              suggestion: `Run 'bun run setup' and add LOCAL_TEMPLATE_PATH to apps/web/.env.local`,
            },
          },
          { status: 500 },
        ),
      }
    }

    // Validate that the path is absolute
    if (!path.isAbsolute(templateWorkspace)) {
      console.error(`[Workspace ${requestId}] LOCAL_TEMPLATE_PATH must be absolute: ${templateWorkspace}`)
      return {
        success: false,
        response: NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.WORKSPACE_INVALID,
            message: "LOCAL_TEMPLATE_PATH must be an absolute path",
            details: {
              providedPath: templateWorkspace,
              suggestion: "Use an absolute path like: /Users/you/alive-brug/.alive/template",
            },
          },
          { status: 500 },
        ),
      }
    }

    // Check if the workspace exists
    if (!existsSync(templateWorkspace)) {
      console.error(`[Workspace ${requestId}] Local template workspace does not exist: ${templateWorkspace}`)
      return {
        success: false,
        response: NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.WORKSPACE_NOT_FOUND,
            message: "Local template workspace not found",
            details: {
              expectedPath: templateWorkspace,
              suggestion: `Run 'bun run setup' to create the workspace`,
            },
          },
          { status: 404 },
        ),
      }
    }

    // Check if it's actually a directory (not a file)
    try {
      const stat = statSync(templateWorkspace)
      if (!stat.isDirectory()) {
        console.error(
          `[Workspace ${requestId}] LOCAL_TEMPLATE_PATH exists but is not a directory: ${templateWorkspace}`,
        )
        return {
          success: false,
          response: NextResponse.json(
            {
              ok: false,
              error: ErrorCodes.WORKSPACE_INVALID,
              message: "LOCAL_TEMPLATE_PATH exists but is not a directory",
              details: {
                path: templateWorkspace,
                suggestion: `Remove the file and run 'bun run setup'`,
              },
            },
            { status: 500 },
          ),
        }
      }
    } catch (error) {
      console.error(`[Workspace ${requestId}] Failed to stat LOCAL_TEMPLATE_PATH: ${templateWorkspace}`, error)
      return {
        success: false,
        response: NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.WORKSPACE_INVALID,
            message: "Cannot access LOCAL_TEMPLATE_PATH",
            details: {
              path: templateWorkspace,
              error: error instanceof Error ? error.message : String(error),
              suggestion: `Check permissions and run 'bun run setup'`,
            },
          },
          { status: 500 },
        ),
      }
    }

    console.log(`[Workspace ${requestId}] Using local template workspace: ${templateWorkspace}`)
    return {
      success: true,
      workspace: templateWorkspace,
    }
  }

  const base = process.env.WORKSPACE_BASE || "/srv/webalive/sites"
  const workspace = path.join(base, host, "user", "src")

  // Check if workspace directory exists
  if (!existsSync(workspace)) {
    console.error(`[Workspace ${requestId}] Hostname workspace does not exist: ${workspace}`)
    return {
      success: false,
      response: NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_NOT_FOUND,
          message: `Workspace directory not found for hostname '${host}'.`,
          details: {
            host,
            expectedPath: workspace,
            workspaceBase: base,
            suggestion: `Create the workspace directory at: ${workspace}`,
          },
        },
        { status: 404 },
      ),
    }
  }

  console.log(`[Workspace ${requestId}] Using hostname workspace: ${workspace}`)
  return {
    success: true,
    workspace,
  }
}
