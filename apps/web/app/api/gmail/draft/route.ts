/**
 * Gmail Draft API
 *
 * Saves a draft via Gmail API when user clicks Save Draft button.
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

    const parsed = await handleBody("gmail/draft", req)
    if (isHandleBodyError(parsed)) return parsed

    const result = await gmailProvider.saveDraft(user.id, parsed)

    return alrighty("gmail/draft", {
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
    console.error("[Gmail Draft] Error:", error)
    Sentry.captureException(error)
    const message = error instanceof Error ? error.message : "Failed to save draft"
    return structuredErrorResponse(ErrorCodes.INTEGRATION_ERROR, { status: 500, details: { reason: message } })
  }
}
