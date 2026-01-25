/**
 * Gmail Send API
 *
 * Proxies to Gmail MCP server's /api/send endpoint.
 * Fetches OAuth token and forwards request.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser, createErrorResponse } from "@/features/auth/lib/auth"
import { ErrorCodes } from "@/lib/error-codes"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"
import { OAUTH_MCP_PROVIDERS } from "@webalive/shared"

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getSessionUser()
    if (!user) {
      return createErrorResponse(ErrorCodes.UNAUTHORIZED, 401)
    }

    // 2. Parse request body
    const body = await req.json()
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

    // 4. Proxy to Gmail MCP server
    const gmailServerUrl = OAUTH_MCP_PROVIDERS.gmail.url.replace("/mcp", "/api/send")
    const response = await fetch(gmailServerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      console.error("[Gmail Send] MCP server error:", result)
      return createErrorResponse(ErrorCodes.INTEGRATION_ERROR, response.status, {
        reason: result.error || "Failed to send email",
      })
    }

    console.log(`[Gmail Send] Email sent by user ${user.id}, ID: ${result.messageId}`)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Gmail Send] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to send email"
    return createErrorResponse(ErrorCodes.INTEGRATION_ERROR, 500, { reason: message })
  }
}
