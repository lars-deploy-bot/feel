import { headers, cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getWorkspace } from "@/app/features/claude/workspaceRetriever"

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(2, 8)
  console.log(`[Verify API ${requestId}] === VERIFICATION START ===`)

  try {
    const jar = await cookies()
    if (!jar.get("session")) {
      console.log(`[Verify API ${requestId}] No session cookie found`)
      return NextResponse.json(
        {
          ok: false,
          error: "no_session",
          message: "Authentication required - no session cookie found",
        },
        { status: 401 },
      )
    }

    let body
    try {
      body = await req.json()
      console.log(`[Verify API ${requestId}] Raw body:`, body)
    } catch (jsonError) {
      console.error(`[Verify API ${requestId}] Failed to parse JSON body:`, jsonError)
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_json",
          message: "Request body is not valid JSON",
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
        error: "verification_failed",
        message: "Failed to verify workspace",
        details: error instanceof Error ? error.message : "Unknown error",
        requestId,
      },
      { status: 500 },
    )
  }
}
