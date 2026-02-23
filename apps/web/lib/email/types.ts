/**
 * Provider-agnostic email types
 *
 * Shared types for email actions (send, draft) across providers.
 * Provider-specific implementations live in ./providers/.
 */

/** Email message fields common to all providers */
export interface EmailMessage {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  threadId?: string
}

/** Result of sending an email */
export interface SendEmailResult {
  messageId: string
  threadId?: string
}

/** Result of saving a draft */
export interface SaveDraftResult {
  draftId: string
  messageId?: string
}

/** Provider-agnostic email operations */
export interface EmailProvider {
  sendEmail(userId: string, message: EmailMessage): Promise<SendEmailResult>
  saveDraft(userId: string, message: EmailMessage): Promise<SaveDraftResult>
}

/**
 * Typed error for email provider failures.
 * Routes map these codes to HTTP status codes.
 */
export type EmailErrorCode = "not_connected" | "no_sender" | "api_error" | "no_result"

export class EmailProviderError extends Error {
  readonly code: EmailErrorCode

  constructor(message: string, code: EmailErrorCode) {
    super(message)
    this.name = "EmailProviderError"
    this.code = code
  }
}
