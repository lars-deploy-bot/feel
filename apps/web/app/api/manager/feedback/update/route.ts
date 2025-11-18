import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { updateFeedbackStatus } from "@/lib/feedback"

/**
 * PATCH /api/manager/feedback/update
 * Update feedback entry (mark as closed/reopen) - requires manager authentication
 */
export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    // Check manager authentication
    const jar = await cookies()
    const session = jar.get("manager_session")

    if (!session) {
      const res = NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_NOT_AUTHENTICATED,
          message: getErrorMessage(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED),
        },
        { status: 401 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Parse request body
    const body = await req.json().catch(() => ({}))
    const { id, closed } = body as { id?: string; closed?: boolean }

    if (!id || typeof closed !== "boolean") {
      const res = NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: getErrorMessage(ErrorCodes.INVALID_REQUEST),
        },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Update feedback status in Supabase
    const status = closed ? "closed" : "pending"
    const success = await updateFeedbackStatus(id, status)

    if (!success) {
      const res = NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: "Failed to update feedback entry",
        },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    console.log(`[Manager] Feedback ${id} marked as ${status}`)

    const res = NextResponse.json({
      ok: true,
      id,
      status,
    })

    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Manager] Error updating feedback:", error)

    const res = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INTERNAL_ERROR,
        message: getErrorMessage(ErrorCodes.INTERNAL_ERROR),
        details: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    )

    addCorsHeaders(res, origin)
    return res
  }
}

/**
 * OPTIONS /api/manager/feedback/update
 * CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  const res = new NextResponse(null, { status: 204 })
  addCorsHeaders(res, origin)
  return res
}
