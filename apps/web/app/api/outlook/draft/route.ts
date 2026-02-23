/**
 * Outlook Draft API
 *
 * Saves a draft via Microsoft Graph when user clicks Save Draft button.
 * Mirrors the Gmail draft route structure for consistency.
 */

import * as Sentry from "@sentry/nextjs"
import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { outlookProvider } from "@/lib/email/providers/outlook"
import { type EmailMessage, EmailProviderError } from "@/lib/email/types"
import { ErrorCodes } from "@/lib/error-codes"

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const body: EmailMessage = await req.json()
    if (!body.to?.length || !body.subject || !body.body) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { reason: "Missing required fields: to, subject, body" },
      })
    }

    const result = await outlookProvider.saveDraft(user.id, body)

    return NextResponse.json({
      ok: true,
      draftId: result.draftId,
      messageId: result.messageId,
    })
  } catch (error) {
    if (error instanceof EmailProviderError) {
      Sentry.captureException(error)
      const status = error.code === "not_connected" ? 403 : 500
      return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, {
        status,
        details: { reason: error.message },
      })
    }
    console.error("[Outlook Draft] Error:", error)
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "Failed to save draft"
    return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, { status: 500, details: { reason: message } })
  }
}
