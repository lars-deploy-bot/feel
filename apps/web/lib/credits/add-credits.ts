/**
 * Thin wrappers — resolve Supabase IAM client, delegate to @webalive/org/server.
 */

import {
  type AwardCreditsResult,
  awardCreditsToUserPrimaryOrg as awardCreditsCore,
  awardReferralCredits as awardReferralCreditsCore,
  type CreditOps,
} from "@webalive/org/server"
import { REFERRAL } from "@webalive/shared"
import { createIamClient } from "@/lib/supabase/iam"

export type { AwardCreditsResult }

async function buildCreditOps(): Promise<CreditOps> {
  const iam = await createIamClient("service")
  return {
    async findPrimaryOrgId(userId: string) {
      const { data } = await iam
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single()
      return data?.org_id ?? null
    },
    async addCredits(orgId: string, amount: number) {
      const { data, error } = await iam.rpc("add_credits", {
        p_org_id: orgId,
        p_amount: amount,
      })
      if (error) throw error
      return data as number
    },
  }
}

export async function awardCreditsToUserPrimaryOrg(userId: string, amount: number): Promise<AwardCreditsResult> {
  const ops = await buildCreditOps()
  return awardCreditsCore(ops, userId, amount)
}

export async function awardReferralCredits(
  referrerId: string,
  referredId: string,
  amount: number = REFERRAL.CREDITS,
): Promise<{ referrerResult: AwardCreditsResult; referredResult: AwardCreditsResult }> {
  const ops = await buildCreditOps()
  return awardReferralCreditsCore(ops, referrerId, referredId, amount)
}
