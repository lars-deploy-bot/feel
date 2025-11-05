import { realpathSync } from "node:fs"
import { NextResponse } from "next/server"
import { type ZodSchema, z } from "zod"
import { requireSessionUser } from "@/features/auth/lib/auth"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"

// Workspace base directory (from env or default)
const WORKSPACE_BASE = process.env.WORKSPACE_BASE ?? "/srv/webalive/sites"

interface WorkspaceApiConfig<T extends z.ZodRawShape> {
  schema: ZodSchema<any>
  handler: (params: { data: z.infer<ZodSchema<any>>; requestId: string }) => Promise<NextResponse>
}

/**
 * Validates workspace containment to prevent path traversal attacks
 * Uses realpathSync to resolve symlinks before checking containment
 */
function validateWorkspaceContainment(workspaceRoot: string, requestId: string): boolean {
  try {
    // Resolve any symlinks to get real paths
    const realWorkspaceRoot = realpathSync(workspaceRoot)
    const realBaseRoot = realpathSync(WORKSPACE_BASE)

    // Ensure workspace is within the base directory
    if (!realWorkspaceRoot.startsWith(realBaseRoot + "/")) {
      console.error(
        `[workspace-api ${requestId}] Path traversal attempt: ${workspaceRoot} -> ${realWorkspaceRoot} not in ${realBaseRoot}`,
      )
      return false
    }

    console.log(`[workspace-api ${requestId}] Workspace validated: ${realWorkspaceRoot}`)
    return true
  } catch (error) {
    console.error(`[workspace-api ${requestId}] Workspace validation failed:`, error)
    return false
  }
}

/**
 * Shared handler for workspace API endpoints
 * Provides consistent auth, validation, and error handling
 */
export async function handleWorkspaceApi<T extends z.ZodRawShape>(
  req: Request,
  config: WorkspaceApiConfig<T>,
): Promise<NextResponse> {
  const requestId = crypto.randomUUID()

  try {
    // Authentication
    const origin = req.headers.get("host")
    const isLocalhost = origin?.includes("localhost")

    if (!isLocalhost) {
      await requireSessionUser()
    }

    // Parse and validate request body
    const body = await req.json()
    const parseResult = config.schema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: getErrorMessage(ErrorCodes.INVALID_REQUEST, {
            field: parseResult.error.issues[0]?.path.join(".") || "unknown",
          }),
          requestId,
        },
        { status: 400 },
      )
    }

    // Validate workspace containment if workspaceRoot is present
    if (parseResult.data.workspaceRoot) {
      if (!validateWorkspaceContainment(parseResult.data.workspaceRoot, requestId)) {
        return NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.WORKSPACE_NOT_FOUND,
            message: "Invalid workspace path",
            requestId,
          },
          { status: 403 },
        )
      }
    }

    // Call the specific handler
    return await config.handler({ data: parseResult.data, requestId })
  } catch (error) {
    // Handle authentication errors
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.UNAUTHORIZED,
          message: getErrorMessage(ErrorCodes.UNAUTHORIZED),
          requestId,
        },
        { status: 401 },
      )
    }

    // Handle unexpected errors
    console.error(`[workspace-api ${requestId}] Unexpected error:`, error)
    return NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.REQUEST_PROCESSING_FAILED,
        message: getErrorMessage(ErrorCodes.REQUEST_PROCESSING_FAILED),
        details: { error: error instanceof Error ? error.message : "Unknown error" },
        requestId,
      },
      { status: 500 },
    )
  }
}
