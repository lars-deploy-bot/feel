/**
 * Referral credit awarding logic.
 *
 * Server-only. Takes query functions as parameters — no Supabase dependency.
 */

import { REFERRAL } from "@webalive/shared"

export interface AwardCreditsResult {
  success: boolean
  orgId?: string
  newBalance?: number
  error?: string
}

/**
 * Database operations needed for credit awarding.
 * Callers implement this with their own Supabase client.
 */
export interface CreditOps {
  /** Find the user's primary org (first by creation date). Returns null if no org. */
  findPrimaryOrgId(userId: string): Promise<string | null>
  /** Atomically add credits to an org. Returns the new balance. */
  addCredits(orgId: string, amount: number): Promise<number>
}

/**
 * Award credits to a user's primary org.
 */
export async function awardCreditsToUserPrimaryOrg(
  ops: CreditOps,
  userId: string,
  amount: number,
): Promise<AwardCreditsResult> {
  const orgId = await ops.findPrimaryOrgId(userId)

  if (!orgId) {
    console.warn(`[Referral] User ${userId} has no org — credits not awarded`)
    return { success: false, error: "no_org" }
  }

  try {
    const newBalance = await ops.addCredits(orgId, amount)
    console.log(`[Referral] Awarded ${amount} credits to org ${orgId}, new balance: ${newBalance}`)
    return { success: true, orgId, newBalance }
  } catch (err) {
    console.error(`[Referral] Failed to add credits to org ${orgId}:`, err)
    return { success: false, error: "credit_failed" }
  }
}

/**
 * Award credits to both referrer and referred user's primary orgs.
 *
 * Each call is individually atomic (row-level lock in DB).
 * The two calls are NOT wrapped in a single transaction — acceptable because
 * credit additions are idempotent and failures are logged for reconciliation.
 */
export async function awardReferralCredits(
  ops: CreditOps,
  referrerId: string,
  referredId: string,
  amount: number = REFERRAL.CREDITS,
): Promise<{ referrerResult: AwardCreditsResult; referredResult: AwardCreditsResult }> {
  const [referrerResult, referredResult] = await Promise.all([
    awardCreditsToUserPrimaryOrg(ops, referrerId, amount),
    awardCreditsToUserPrimaryOrg(ops, referredId, amount),
  ])

  if (!referrerResult.success || !referredResult.success) {
    console.error("[Referral] Partial credit award:", {
      referrer: { userId: referrerId, ...referrerResult },
      referred: { userId: referredId, ...referredResult },
      amount,
    })
  }

  return { referrerResult, referredResult }
}
