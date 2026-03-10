/**
 * Gmail Send API
 *
 * Sends an email via Gmail API when user clicks Send button.
 * Thin route handler — business logic lives in lib/email/.
 */

import * as Sentry from "@sentry/nextjs"
import type { NextRequest } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, isHandleBodyError } from "@/lib/api/server"
import { gmailProvider } from "@/lib/email/providers/gmail"
import { EmailProviderError } from "@/lib/email/types"
import { ErrorCodes } from "@/lib/error-codes"

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const parsed = await handleBody("gmail/send", req)
    if (isHandleBodyError(parsed)) return parsed

    const result = await gmailProvider.sendEmail(user.id, parsed)

    return alrighty("gmail/send", {
      messageId: result.messageId,
      threadId: result.threadId,
    })
  } catch (error) {
    if (error instanceof EmailProviderError) {
      Sentry.captureException(error)
      const status = error.code === "not_connected" || error.code === "delivery_disabled" ? 403 : 500
      return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, {
        status,
        details: { reason: error.message },
      })
    }
    console.error("[Gmail Send] Error:", error)
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "Failed to send email"
    return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, { status: 500, details: { reason: message } })
  }
}
