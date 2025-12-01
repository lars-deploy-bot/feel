import { EMAIL_TEMPLATES } from "@/config/emails"

interface SendReferralInviteParams {
  to: string
  senderName: string
  inviteLink: string
}

interface LoopsResponse {
  success: boolean
  id?: string
}

/**
 * Send a referral invite email via Loops.so transactional API.
 *
 * @throws Error if LOOPS_API_KEY is not configured
 * @throws Error if Loops API returns an error response
 */
export async function sendReferralInvite({
  to,
  senderName,
  inviteLink,
}: SendReferralInviteParams): Promise<LoopsResponse> {
  const LOOPS_API_KEY = process.env.LOOPS_API_KEY
  if (!LOOPS_API_KEY) {
    throw new Error("LOOPS_API_KEY not configured")
  }

  const response = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOOPS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transactionalId: EMAIL_TEMPLATES.referralInvite,
      email: to,
      dataVariables: {
        senderName,
        inviteLink,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Loops API error: ${response.status} - ${error}`)
  }

  return response.json()
}
