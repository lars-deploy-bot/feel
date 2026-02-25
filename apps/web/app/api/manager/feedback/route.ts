import * as Sentry from "@sentry/nextjs"
import { type NextRequest, NextResponse } from "next/server"
import { requireManagerAuth } from "@/features/manager/lib/api-helpers"
import { createCorsErrorResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes } from "@/lib/error-codes"
import { getAllFeedback, updateFeedback } from "@/lib/feedback"

/**
 * GET /api/manager/feedback
 * Fetch all feedback entries (requires manager authentication)
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")
  const startTime = performance.now()
  const timings: Record<string, number> = {}

  try {
    // Check manager authentication
    const authStart = performance.now()
    const authError = await requireManagerAuth()
    timings.auth = performance.now() - authStart

    if (authError) {
      return authError
    }

    // Fetch all feedback (already sorted by created_at desc in Supabase)
    const fetchStart = performance.now()
    const feedback = await getAllFeedback()
    timings.fetch = performance.now() - fetchStart

    timings.total = performance.now() - startTime

    return createCorsSuccessResponse(origin, {
      feedback,
      count: feedback.length,
      debug: {
        timings: {
          auth_ms: Math.round(timings.auth * 100) / 100,
          fetch_ms: Math.round(timings.fetch * 100) / 100,
          total_ms: Math.round(timings.total * 100) / 100,
        },
      },
    })
  } catch (error) {
    console.error("[Manager] Error fetching feedback:", error)
    Sentry.captureException(error)

    return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, {
      details: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    })
  }
}

/**
 * PATCH /api/manager/feedback
 * Update feedback entry (github issue, aware/fixed emails)
 */
export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    const authError = await requireManagerAuth()
    if (authError) return authError

    const body = await req.json()
    const { feedbackId, githubIssueUrl, awareEmailSent, fixedEmailSent } = body

    if (!feedbackId || typeof feedbackId !== "string") {
      return createCorsErrorResponse(origin, ErrorCodes.INVALID_REQUEST, 400, {
        details: { message: "feedbackId is required" },
      })
    }

    await updateFeedback(feedbackId, { githubIssueUrl, awareEmailSent, fixedEmailSent })

    return createCorsSuccessResponse(origin, { success: true })
  } catch (error) {
    console.error("[Manager] Error updating feedback:", error)
    Sentry.captureException(error)

    return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, {
      details: { message: error instanceof Error ? error.message : "Unknown error" },
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
