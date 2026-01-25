/**
 * Gmail Draft API
 *
 * Saves a draft via Gmail API when user clicks Save Draft button.
 * Uses stored OAuth token from user's Gmail connection.
 */

import { type NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { getSessionUser, createErrorResponse } from "@/features/auth/lib/auth"
import { ErrorCodes } from "@/lib/error-codes"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"

interface SaveDraftRequest {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  threadId?: string
}

function createRawEmail(params: SaveDraftRequest): string {
  const { to, cc, subject, body } = params

  const headers = [
    `To: ${to.join(", ")}`,
    cc?.length ? `Cc: ${cc.join(", ")}` : null,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ]
    .filter(Boolean)
    .join("\r\n")

  // Base64url encode
  return Buffer.from(headers).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getSessionUser()
    if (!user) {
      return createErrorResponse(ErrorCodes.UNAUTHORIZED, 401)
    }

    // 2. Parse request body
    const body: SaveDraftRequest = await req.json()
    if (!body.to?.length || !body.subject || !body.body) {
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, 400, {
        reason: "Missing required fields: to, subject, body",
      })
    }

    // 3. Get Gmail OAuth token
    const oauthManager = getOAuthInstance("google")
    let accessToken: string
    try {
      accessToken = await oauthManager.getAccessToken(user.id, "google")
    } catch (error) {
      console.error("[Gmail Draft] Failed to get OAuth token:", error)
      return createErrorResponse(ErrorCodes.INTEGRATION_ERROR, 403, {
        reason: "Gmail not connected. Please connect Gmail in Settings.",
      })
    }

    // 4. Create Gmail client
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // 5. Create draft
    const raw = createRawEmail(body)
    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw,
          threadId: body.threadId,
        },
      },
    })

    console.log(`[Gmail Draft] Draft saved by user ${user.id}, ID: ${response.data.id}`)

    return NextResponse.json({
      ok: true,
      draftId: response.data.id,
      messageId: response.data.message?.id,
    })
  } catch (error) {
    console.error("[Gmail Draft] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to save draft"
    return createErrorResponse(ErrorCodes.INTEGRATION_ERROR, 500, { reason: message })
  }
}
