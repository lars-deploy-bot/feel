/**
 * Outlook Email Provider
 *
 * Implements EmailProvider using Microsoft Graph API.
 * Handles OAuth token retrieval and Graph API calls for send/draft.
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

/** Get an access token for Microsoft Graph */
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

/** Build Graph API recipient list from email addresses */
function toRecipients(emails: string[]): Array<{ emailAddress: { address: string } }> {
  return emails.map(address => ({ emailAddress: { address } }))
}

export const outlookProvider: EmailProvider = {
  async sendEmail(userId: string, message: EmailMessage): Promise<SendEmailResult> {
    const accessToken = await getAccessToken(userId)

    const graphMessage = {
      subject: message.subject,
      body: { contentType: "text", content: message.body },
      toRecipients: toRecipients(message.to),
      ccRecipients: message.cc ? toRecipients(message.cc) : undefined,
      bccRecipients: message.bcc ? toRecipients(message.bcc) : undefined,
    }

    // Graph sendMail endpoint sends immediately and returns 202 Accepted
    const res = await fetch(`${GRAPH_BASE}/me/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: graphMessage, saveToSentItems: true }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new EmailProviderError(`Graph API ${res.status}: ${text}`, "api_error")
    }

    // sendMail returns 202 with no body — no message ID available
    console.log(`[Outlook Send] Email sent by user ${userId}`)

    return {
      messageId: `outlook-sent-${Date.now()}`,
      threadId: undefined,
    }
  },

  async saveDraft(userId: string, message: EmailMessage): Promise<SaveDraftResult> {
    const accessToken = await getAccessToken(userId)

    const graphMessage = {
      subject: message.subject,
      body: { contentType: "text", content: message.body },
      toRecipients: toRecipients(message.to),
      ccRecipients: message.cc ? toRecipients(message.cc) : undefined,
      bccRecipients: message.bcc ? toRecipients(message.bcc) : undefined,
    }

    const res = await fetch(`${GRAPH_BASE}/me/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphMessage),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new EmailProviderError(`Graph API ${res.status}: ${text}`, "api_error")
    }

    const data = await res.json()

    console.log(`[Outlook Draft] Draft saved by user ${userId}, ID: ${data.id}`)

    if (!data.id) {
      throw new EmailProviderError("Graph API did not return message ID", "no_result")
    }

    return {
      draftId: data.id,
      messageId: data.id,
    }
  },
}
