/**
 * Gmail Send API
 *
 * Sends an email via Gmail API when user clicks Send button.
 * Uses stored OAuth token from user's Gmail connection.
 */

import { type NextRequest, NextResponse } from "next/server"
import { gmail_v1, auth as gauth } from "@googleapis/gmail"
import { getSessionUser, createErrorResponse } from "@/features/auth/lib/auth"
import { ErrorCodes } from "@/lib/error-codes"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"

interface SendEmailRequest {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  threadId?: string
}

function createRawEmail(params: SendEmailRequest): string {
  const { to, cc, bcc, subject, body } = params

  const headers = [
    `To: ${to.join(", ")}`,
    cc?.length ? `Cc: ${cc.join(", ")}` : null,
    bcc?.length ? `Bcc: ${bcc.join(", ")}` : null,
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
    const body: SendEmailRequest = await req.json()
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
      console.error("[Gmail Send] Failed to get OAuth token:", error)
      return createErrorResponse(ErrorCodes.INTEGRATION_ERROR, 403, {
        reason: "Gmail not connected. Please connect Gmail in Settings.",
      })
    }

    // 4. Create Gmail client
    const oauth2Client = new gauth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const gmail = new gmail_v1.Gmail({ auth: oauth2Client })

    // 5. Send email
    const raw = createRawEmail(body)
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: body.threadId,
      },
    })

    console.log(`[Gmail Send] Email sent by user ${user.id}, ID: ${response.data.id}`)

    return NextResponse.json({
      ok: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
    })
  } catch (error) {
    console.error("[Gmail Send] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to send email"
    return createErrorResponse(ErrorCodes.INTEGRATION_ERROR, 500, { reason: message })
  }
}
