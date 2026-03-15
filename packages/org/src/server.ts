/**
 * @webalive/org/server
 *
 * Server-only org domain logic: email sending, credit awarding.
 * These take their dependencies as parameters — no global state.
 */

export {
  type AwardCreditsResult,
  awardCreditsToUserPrimaryOrg,
  awardReferralCredits,
  type CreditOps,
} from "./credits.js"
export {
  type SendReferralInviteConfig,
  type SendReferralInviteParams,
  sendReferralInvite,
} from "./email.js"
