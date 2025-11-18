import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { getAllFeedback } from "@/lib/feedback"

/**
 * GET /api/manager/feedback
 * Fetch all feedback entries (requires manager authentication)
 */
export async function GET(req: NextRequest) {
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

    // Fetch all feedback (already sorted by created_at desc in Supabase)
    const feedback = await getAllFeedback()

    const res = NextResponse.json({
      ok: true,
      feedback,
      count: feedback.length,
    })

    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Manager] Error fetching feedback:", error)

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
 * OPTIONS /api/manager/feedback
 * CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  const res = new NextResponse(null, { status: 204 })
  addCorsHeaders(res, origin)
  return res
}
