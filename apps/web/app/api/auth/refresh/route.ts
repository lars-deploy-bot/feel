/**
 * POST /api/auth/refresh
 *
 * Silent session refresh. Re-issues the JWT with a fresh expiry
 * while keeping the same session ID (sid). Also refreshes org
 * memberships from the database so permission changes take effect
 * without re-login.
 *
 * Called by the client heartbeat before the token nears expiry.
 * Returns 401 if the session is invalid/revoked — the client
 * shows the session expired modal in that case.
 */

import { buildSessionOrgClaims } from "@webalive/shared"
import { NextResponse } from "next/server"
import { getSessionPayloadFromCookie, getSessionUser } from "@/features/auth/lib/auth"
import { createSessionToken } from "@/features/auth/lib/jwt"
import { checkRevocation } from "@/features/auth/sessions/session-service"
import { structuredErrorResponse } from "@/lib/api/responses"
import { setSessionCookie } from "@/lib/auth/cookies"
import { ErrorCodes } from "@/lib/error-codes"
import { createIamClient } from "@/lib/supabase/iam"

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
  }

  const payload = await getSessionPayloadFromCookie()
  if (!payload?.sid) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
  }

  // Double-check revocation (getSessionUser already checks, but be explicit)
  if (await checkRevocation(payload.sid)) {
    return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
  }

  // Re-fetch org memberships so permission changes propagate without re-login
  const iam = await createIamClient("service")
  const { data: memberships, error: membershipError } = await iam
    .from("org_memberships")
    .select("org_id, role")
    .eq("user_id", payload.userId)

  if (membershipError) {
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  const { orgIds, orgRoles } = buildSessionOrgClaims(memberships ?? [])

  // Issue new JWT with same sid, fresh expiry, updated org claims
  const newToken = await createSessionToken({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    sid: payload.sid,
    scopes: payload.scopes,
    orgIds,
    orgRoles,
  })

  const res = NextResponse.json({ ok: true })
  setSessionCookie(res, newToken, req)

  return res
}
