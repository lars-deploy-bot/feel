import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { addFeedbackEntry } from "@/lib/feedback"
import { generateRequestId } from "@/lib/utils"

/**
 * Zod schema for feedback submission
 */
const FeedbackSchema = z.object({
  feedback: z.string().min(1).max(5000),
  email: z.string().email().optional(),
  workspace: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  userAgent: z.string().optional(),
})

/**
 * POST /api/feedback
 * Submit user feedback (no authentication required for simplicity)
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")

  try {
    // Parse request body
    const body = await req.json().catch(() => ({}))
    const result = FeedbackSchema.safeParse(body)

    if (!result.success) {
      const res = NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: getErrorMessage(ErrorCodes.INVALID_REQUEST),
          details: { issues: result.error.issues },
          requestId,
        },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    const { feedback, email, workspace, conversationId, userAgent } = result.data

    // Add feedback entry to storage
    const entry = addFeedbackEntry({
      feedback,
      email,
      workspace: workspace || "unknown",
      conversationId,
      userAgent: userAgent || req.headers.get("user-agent") || undefined,
    })

    console.log(`[Feedback] New feedback received from workspace: ${entry.workspace} (ID: ${entry.id})`)

    const res = NextResponse.json({
      ok: true,
      id: entry.id,
      timestamp: entry.timestamp,
    })

    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Feedback] Error saving feedback:", error)

    const res = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INTERNAL_ERROR,
        message: getErrorMessage(ErrorCodes.INTERNAL_ERROR),
        details: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
        requestId,
      },
      { status: 500 },
    )

    addCorsHeaders(res, origin)
    return res
  }
}

/**
 * OPTIONS /api/feedback
 * CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  const res = new NextResponse(null, { status: 204 })
  addCorsHeaders(res, origin)
  return res
}
