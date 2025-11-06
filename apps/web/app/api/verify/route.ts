import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"
import { isWorkspaceAuthenticated } from "@/features/auth/lib/auth"
import { getWorkspace } from "@/features/chat/lib/workspaceRetriever"
import { isTerminalMode } from "@/features/workspace/types/workspace"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { generateRequestId } from "@/lib/utils"

export async function POST(req: Request) {
  const requestId = generateRequestId()
  console.log(`[Verify API ${requestId}] === VERIFICATION START ===`)

  try {
    const jar = await cookies()
    if (!jar.get("session")) {
      console.log(`[Verify API ${requestId}] No session cookie found`)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.NO_SESSION,
          message: getErrorMessage(ErrorCodes.NO_SESSION),
        },
        { status: 401 },
      )
    }

    let body: unknown
    try {
      body = await req.json()
      console.log(`[Verify API ${requestId}] Raw body:`, body)
    } catch (jsonError) {
      console.error(`[Verify API ${requestId}] Failed to parse JSON body:`, jsonError)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_JSON,
          message: getErrorMessage(ErrorCodes.INVALID_JSON),
        },
        { status: 400 },
      )
    }

    const host = (await headers()).get("host") || "localhost"
    console.log(`[Verify API ${requestId}] Host: ${host}`)

    // Use workspace checker to validate
    const workspaceResult = getWorkspace({ host, body, requestId })

    if (!workspaceResult.success) {
      console.log(`[Verify API ${requestId}] Workspace verification failed`)
      // Extract error details from the NextResponse
      const errorResponse = await workspaceResult.response.json()
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          ...errorResponse,
        },
        { status: 200 },
      ) // Return 200 so frontend can handle verification result
    }

    console.log(`[Verify API ${requestId}] Workspace verification successful: ${workspaceResult.workspace}`)

    // Determine workspace name for authentication (domain only, not path)
    // Same pattern as claude/stream route
    const workspaceName = isTerminalMode(host) ? (body as any)?.workspace || "unknown" : host

    console.log(`[Verify API ${requestId}] Workspace name for auth check: ${workspaceName}`)

    // Check if user is authenticated for this specific workspace
    const isAuthenticated = await isWorkspaceAuthenticated(workspaceName)
    if (!isAuthenticated) {
      console.log(`[Verify API ${requestId}] User not authenticated for workspace: ${workspaceName}`)
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          error: ErrorCodes.WORKSPACE_NOT_AUTHENTICATED,
          message: "Not authenticated for this workspace",
          workspace: workspaceName,
        },
        { status: 401 },
      )
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      workspace: workspaceResult.workspace,
      message: "Workspace directory found and accessible",
      requestId,
    })
  } catch (error) {
    console.error(`[Verify API ${requestId}] Verification failed:`, error)
    return NextResponse.json(
      {
        ok: false,
        verified: false,
        error: ErrorCodes.REQUEST_PROCESSING_FAILED,
        message: getErrorMessage(ErrorCodes.REQUEST_PROCESSING_FAILED),
        details: error instanceof Error ? error.message : "Unknown error",
        requestId,
      },
      { status: 500 },
    )
  }
}
