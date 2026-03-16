/**
 * Thin wrapper — resolves env + config, delegates to @webalive/org/server.
 */

import { type SendReferralInviteParams, sendReferralInvite as sendReferralInviteCore } from "@webalive/org/server"
import { EMAIL_TEMPLATES } from "@/config/emails"

export async function sendReferralInvite(params: SendReferralInviteParams) {
  const loopsApiKey = process.env.LOOPS_API_KEY
  if (!loopsApiKey) {
    throw new Error("LOOPS_API_KEY not configured")
  }

  return sendReferralInviteCore(params, {
    loopsApiKey,
    templateId: EMAIL_TEMPLATES.referralInvite,
  })
}
