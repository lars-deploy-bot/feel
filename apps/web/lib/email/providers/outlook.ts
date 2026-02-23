/**
 * Outlook Email Provider
 *
 * Implements EmailProvider using the Microsoft Graph API.
 * Handles OAuth token retrieval, user profile lookup, and structured message construction.
 */

import * as Sentry from "@sentry/nextjs"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"
import {
  type EmailMessage,
  type EmailProvider,
  EmailProviderError,
  type SaveDraftResult,
  type SendEmailResult,
} from "../types"

const GRAPH_BASE = "https://graph.microsoft.com/v1.0"

/** Get a valid access token for Microsoft Graph */
async function getAccessToken(userId: string): Promise<string> {
  const oauthManager = getOAuthInstance("microsoft")
  try {
    return await oauthManager.getAccessToken(userId, "microsoft")
  } catch (error) {
    console.error("[Outlook] Failed to get OAuth token:", error)
    Sentry.captureException(error)
    throw new EmailProviderError("Outlook not connected. Please connect Outlook in Settings.", "not_connected")
  }
}

/** Resolve the authenticated user's email address via /me */
async function getSenderEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new EmailProviderError(`Microsoft Graph /me failed: ${res.status}`, "api_error")
  }
  const profile: { mail?: string; userPrincipalName?: string } = await res.json()
  const email = profile.mail || profile.userPrincipalName
  if (!email) {
    throw new EmailProviderError("Could not determine sender email address", "no_sender")
  }
  return email
}

/** Convert an email address string to a Graph API recipient object */
function toRecipient(address: string): { emailAddress: { address: string } } {
  return { emailAddress: { address } }
}

/** Build the Graph API message payload from our provider-agnostic EmailMessage */
function buildGraphMessage(message: EmailMessage) {
  return {
    subject: message.subject,
    body: { contentType: "HTML" as const, content: message.body },
    toRecipients: message.to.map(toRecipient),
    ...(message.cc?.length ? { ccRecipients: message.cc.map(toRecipient) } : {}),
    ...(message.bcc?.length ? { bccRecipients: message.bcc.map(toRecipient) } : {}),
    // Note: Graph API's conversationId is read-only — cannot be set on create.
    // Thread tracking for Outlook replies requires replying to a specific message ID.
  }
}

export const outlookProvider: EmailProvider = {
  async sendEmail(userId: string, message: EmailMessage): Promise<SendEmailResult> {
    const accessToken = await getAccessToken(userId)
    await getSenderEmail(accessToken) // validate connection & sender

    const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: buildGraphMessage(message), saveToSentItems: true }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new EmailProviderError(`Outlook send failed: ${res.status} ${text}`, "api_error")
    }

    // sendMail returns 202 with no body — Graph doesn't return a message ID.
    // We generate a synthetic one so the caller always gets a non-empty ID.
    const messageId = `outlook_${Date.now()}`
    console.log(`[Outlook Send] Email sent by user ${userId}, synthetic ID: ${messageId}`)

    return { messageId }
  },

  async saveDraft(userId: string, message: EmailMessage): Promise<SaveDraftResult> {
    const accessToken = await getAccessToken(userId)
    await getSenderEmail(accessToken)

    const res = await fetch(`${GRAPH_BASE}/me/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGraphMessage(message)),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new EmailProviderError(`Outlook draft failed: ${res.status} ${text}`, "api_error")
    }

    const data: { id?: string } = await res.json()

    if (!data.id) {
      throw new EmailProviderError("Outlook API did not return draft ID", "no_result")
    }

    console.log(`[Outlook Draft] Draft saved by user ${userId}, ID: ${data.id}`)

    return { draftId: data.id }
  },
}
