/**
 * @webalive/org/server
 *
 * Server-only org domain logic: email sending, credit awarding.
 * These take their dependencies as parameters — no global state.
 */

export {
  awardCreditsToUserPrimaryOrg,
  type AwardCreditsResult,
  awardReferralCredits,
  type CreditOps,
} from "./credits.js"
export {
  sendReferralInvite,
  type SendReferralInviteConfig,
  type SendReferralInviteParams,
} from "./email.js"
