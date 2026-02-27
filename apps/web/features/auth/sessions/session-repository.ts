import * as Sentry from "@sentry/nextjs"
import { createIamClient } from "@/lib/supabase/iam"
import type { AuthSessionListItem } from "./types"

interface CreateParams {
  sid: string
  userId: string
  userAgent: string | null
  ipAddress: string | null
  deviceLabel: string | null
  expiresAt: Date
}

export async function createAuthSessionRow(params: CreateParams): Promise<void> {
  const iam = await createIamClient("service")
  const { error } = await iam.from("auth_sessions").insert({
    sid: params.sid,
    user_id: params.userId,
    user_agent: params.userAgent,
    ip_address: params.ipAddress,
    device_label: params.deviceLabel,
    expires_at: params.expiresAt.toISOString(),
  })
  if (error) {
    throw new Error(`[AuthSessionRepo] Failed to create session: ${error.message}`)
  }
}

export async function listActiveSessionRows(userId: string, currentSid: string): Promise<AuthSessionListItem[]> {
  const iam = await createIamClient("service")
  const { data, error } = await iam
    .from("auth_sessions")
    .select("sid, device_label, ip_address, created_at, last_active_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`[AuthSessionRepo] Failed to list sessions: ${error.message}`)
  }

  return (data ?? []).map(row => ({
    sid: row.sid,
    deviceLabel: row.device_label,
    ipAddress: row.ip_address != null ? String(row.ip_address) : null,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    isCurrent: row.sid === currentSid,
  }))
}

export async function revokeAuthSessionRow(userId: string, sid: string): Promise<boolean> {
  const iam = await createIamClient("service")
  const { data, error } = await iam.rpc("revoke_auth_session", {
    p_user_id: userId,
    p_sid: sid,
    p_revoked_by: "user",
  })
  if (error) {
    throw new Error(`[AuthSessionRepo] Failed to revoke session: ${error.message}`)
  }
  return data === true
}

export async function revokeOtherAuthSessionRows(userId: string, currentSid: string): Promise<number> {
  const iam = await createIamClient("service")
  const { data, error } = await iam.rpc("revoke_other_auth_sessions", {
    p_user_id: userId,
    p_current_sid: currentSid,
  })
  if (error) {
    throw new Error(`[AuthSessionRepo] Failed to revoke other sessions: ${error.message}`)
  }
  return typeof data === "number" ? data : 0
}

export async function touchAuthSessionRow(sid: string, userId: string): Promise<void> {
  const iam = await createIamClient("service")
  const { error } = await iam.rpc("touch_auth_session", {
    p_sid: sid,
    p_user_id: userId,
  })
  if (error) {
    Sentry.captureMessage(`[AuthSessionRepo] Failed to touch session: ${error.message}`, "warning")
  }
}

export async function isSessionRevokedInDb(sid: string): Promise<boolean> {
  const iam = await createIamClient("service")
  const { data, error } = await iam.from("auth_sessions").select("revoked_at").eq("sid", sid).single()

  if (error) {
    // Session not found in DB = not revoked (fail-open)
    return false
  }

  return data?.revoked_at !== null
}
