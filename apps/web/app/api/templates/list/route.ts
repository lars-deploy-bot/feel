/**
 * Super Templates List API
 * Returns available Alive Super Templates from filesystem frontmatter
 */

import * as Sentry from "@sentry/nextjs"
import { listTemplates } from "@webalive/tools"
import { NextResponse } from "next/server"
import { AuthenticationError, requireSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { ErrorCodes } from "@/lib/error-codes"

/**
 * GET - Get all available Super Templates
 * Requires authentication — only served to logged-in users.
 */
export async function GET() {
  try {
    await requireSessionUser()

    const templates = await listTemplates()

    return NextResponse.json(
      { templates },
      {
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        },
      },
    )
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }
    console.error("[Templates List API] Error:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, {
      status: 500,
      details: {
        exception: error instanceof Error ? error.message : String(error),
      },
    })
  }
}
