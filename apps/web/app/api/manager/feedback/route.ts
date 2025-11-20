import { type NextRequest, NextResponse } from "next/server"
import { requireManagerAuth } from "@/features/manager/lib/api-helpers"
import { addCorsHeaders } from "@/lib/cors-utils"
import { createCorsSuccessResponse, createCorsErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"
import { getAllFeedback } from "@/lib/feedback"

/**
 * GET /api/manager/feedback
 * Fetch all feedback entries (requires manager authentication)
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    // Check manager authentication
    const authError = await requireManagerAuth()
    if (authError) {
      return authError
    }

    // Fetch all feedback (already sorted by created_at desc in Supabase)
    const feedback = await getAllFeedback()

    return createCorsSuccessResponse(origin, {
      feedback,
      count: feedback.length,
    })
  } catch (error) {
    console.error("[Manager] Error fetching feedback:", error)

    return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, {
      details: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    })
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
