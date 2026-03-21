// apps/web/app/api/referrals/history/route.ts

import type { NextRequest } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleQuery, isHandleBodyError } from "@/lib/api/server"
import { ErrorCodes } from "@/lib/error-codes"
import { createIamClient } from "@/lib/supabase/iam"

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
  }
  const userId = user.id

  // Parse pagination params
  const query = await handleQuery("referrals/history", request)
  if (isHandleBodyError(query)) return query
  const { limit, offset } = query

  const iam = await createIamClient("service")

  // Get total count
  const { count: total } = await iam
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", userId)

  if (!total) {
    return alrighty("referrals/history", { data: { referrals: [], total: 0, hasMore: false } })
  }

  // Get paginated referrals
  const { data: referrals } = await iam
    .from("referrals")
    .select("referral_id, status, credits_awarded, created_at, completed_at, referred_id")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (!referrals?.length) {
    return alrighty("referrals/history", { data: { referrals: [], total, hasMore: false } })
  }

  // Get referred users
  const referredIds = referrals.map(r => r.referred_id)
  const { data: users } = await iam.from("users").select("user_id, email, display_name").in("user_id", referredIds)

  const userMap = new Map(users?.map(u => [u.user_id, u]) ?? [])

  const hasMore = offset + referrals.length < total

  return alrighty("referrals/history", {
    data: {
      referrals: referrals.map(r => {
        const referredUser = userMap.get(r.referred_id)
        return {
          id: r.referral_id,
          status: r.status,
          creditsAwarded: r.credits_awarded,
          createdAt: r.created_at,
          completedAt: r.completed_at,
          referredEmail: referredUser?.email,
          referredName: referredUser?.display_name,
        }
      }),
      total,
      hasMore,
    },
  })
}
