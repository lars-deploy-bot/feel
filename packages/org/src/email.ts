/**
 * Referral invite email sending via Loops.so.
 *
 * Server-only. Takes API key as a parameter — no env var access.
 * Does NOT log — callers own observability.
 */

import { retryAsync } from "@webalive/shared"

export interface SendReferralInviteParams {
  to: string
  senderName: string
  inviteLink: string
}

export interface SendReferralInviteConfig {
  loopsApiKey: string
  templateId: string
}

export interface LoopsResponse {
  success: boolean
  id?: string
}

function isRetryableEmailError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message
    if (msg.includes("fetch failed") || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT")) {
      return true
    }
    if (msg.includes("429") || msg.includes("502") || msg.includes("503") || msg.includes("504")) {
      return true
    }
  }
  return false
}

/**
 * Send a referral invite email via Loops.so transactional API.
 * Retries up to 3 times for transient failures.
 *
 * @throws if loopsApiKey is missing or Loops API returns an error after retries
 */
export async function sendReferralInvite(
  params: SendReferralInviteParams,
  config: SendReferralInviteConfig,
): Promise<LoopsResponse> {
  if (!config.loopsApiKey) {
    throw new Error("loopsApiKey is required to send referral invite emails")
  }

  return retryAsync(
    async () => {
      const response = await fetch("https://app.loops.so/api/v1/transactional", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.loopsApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionalId: config.templateId,
          email: params.to,
          dataVariables: {
            senderName: params.senderName,
            inviteLink: params.inviteLink,
          },
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Loops API error: ${response.status} - ${body}`)
      }

      return response.json() as Promise<LoopsResponse>
    },
    {
      attempts: 3,
      minDelayMs: 1000,
      maxDelayMs: 10000,
      jitter: 0.2,
      shouldRetry: isRetryableEmailError,
    },
  )
}
