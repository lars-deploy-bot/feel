/**
 * Gmail Email Provider
 *
 * Implements EmailProvider using the Gmail API.
 * Handles OAuth token retrieval, profile lookup, and raw message construction.
 */

import { auth as gauth, gmail_v1 } from "@googleapis/gmail"
import * as Sentry from "@sentry/nextjs"
import { getOAuthInstance } from "@/lib/oauth/oauth-instances"
import { createRawEmail } from "../message"
import {
  type EmailMessage,
  type EmailProvider,
  EmailProviderError,
  type SaveDraftResult,
  type SendEmailResult,
} from "../types"

/** Create an authenticated Gmail client for a user */
async function getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
  const oauthManager = getOAuthInstance("google")
  let accessToken: string
  try {
    accessToken = await oauthManager.getAccessToken(userId, "google")
  } catch (error) {
    console.error("[Gmail] Failed to get OAuth token:", error)
    Sentry.captureException(error)
    throw new EmailProviderError("Gmail not connected. Please connect Gmail in Settings.", "not_connected")
  }

  const oauth2Client = new gauth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })
  return new gmail_v1.Gmail({ auth: oauth2Client })
}

/** Resolve the authenticated user's email address */
async function getSenderEmail(gmail: gmail_v1.Gmail): Promise<string> {
  const profile = await gmail.users.getProfile({ userId: "me" })
  const email = profile.data.emailAddress
  if (!email) {
    throw new EmailProviderError("Could not determine sender email address", "no_sender")
  }
  return email
}

export const gmailProvider: EmailProvider = {
  async sendEmail(userId: string, message: EmailMessage): Promise<SendEmailResult> {
    const gmail = await getGmailClient(userId)
    const senderEmail = await getSenderEmail(gmail)

    const raw = createRawEmail({ ...message, from: senderEmail })
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: message.threadId,
      },
    })

    console.log(`[Gmail Send] Email sent by user ${userId}, ID: ${response.data.id}`)

    if (!response.data.id) {
      throw new EmailProviderError("Gmail API did not return message ID", "no_result")
    }

    return {
      messageId: response.data.id,
      threadId: response.data.threadId || undefined,
    }
  },

  async saveDraft(userId: string, message: EmailMessage): Promise<SaveDraftResult> {
    const gmail = await getGmailClient(userId)
    const senderEmail = await getSenderEmail(gmail)

    const raw = createRawEmail({ ...message, from: senderEmail })
    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw,
          threadId: message.threadId,
        },
      },
    })

    console.log(`[Gmail Draft] Draft saved by user ${userId}, ID: ${response.data.id}`)

    if (!response.data.id) {
      throw new EmailProviderError("Gmail API did not return draft ID", "no_result")
    }

    return {
      draftId: response.data.id,
      messageId: response.data.message?.id || undefined,
    }
  },
}
