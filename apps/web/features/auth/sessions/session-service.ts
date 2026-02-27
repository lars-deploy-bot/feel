/**
 * Auth Session Service — thin orchestrator over repository + cache.
 */

import * as Sentry from "@sentry/nextjs"
import { parseDeviceLabel } from "./device-label"
import { isRevoked, markRevoked } from "./session-cache"
import {
  createAuthSessionRow,
  listActiveSessionRows,
  revokeAuthSessionRow,
  revokeOtherAuthSessionRows,
  touchAuthSessionRow,
} from "./session-repository"
import type { AuthSessionListItem } from "./types"

/**
 * Check if a session has been revoked.
 * Uses bounded-TTL cache with fail-open semantics.
 */
export async function checkRevocation(sid: string): Promise<boolean> {
  return isRevoked(sid)
}

/**
 * Create a new auth session record.
 * Called from the login route after JWT creation.
 */
export async function createAuthSession(params: {
  sid: string
  userId: string
  userAgent: string | null
  ip: string | null
  expiresAt: Date
}): Promise<void> {
  const deviceLabel = parseDeviceLabel(params.userAgent)
  await createAuthSessionRow({
    sid: params.sid,
    userId: params.userId,
    userAgent: params.userAgent,
    ipAddress: params.ip,
    deviceLabel,
    expiresAt: params.expiresAt,
  })
}

/**
 * List active (non-revoked, non-expired) sessions for a user.
 */
export async function listActiveSessions(userId: string, currentSid: string): Promise<AuthSessionListItem[]> {
  return listActiveSessionRows(userId, currentSid)
}

/**
 * Revoke a single session. Immediately marks it in the local cache.
 */
export async function revokeSession(userId: string, sid: string): Promise<boolean> {
  const revoked = await revokeAuthSessionRow(userId, sid)
  if (revoked) {
    markRevoked(sid)
  }
  return revoked
}

/**
 * Revoke all sessions except the current one.
 */
export async function revokeOtherSessions(userId: string, currentSid: string): Promise<number> {
  return revokeOtherAuthSessionRows(userId, currentSid)
}

// Throttle map: sid -> last touch timestamp
const touchThrottle = new Map<string, number>()
const TOUCH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Update last_active_at for a session. Throttled to once per 5 minutes per sid.
 * Fire-and-forget: errors are logged but not thrown.
 */
export async function touchLastActive(sid: string, userId: string): Promise<void> {
  const now = Date.now()
  const last = touchThrottle.get(sid)
  if (last && now - last < TOUCH_INTERVAL_MS) {
    return
  }
  touchThrottle.set(sid, now)
  try {
    await touchAuthSessionRow(sid, userId)
  } catch (err) {
    Sentry.captureException(err)
  }
}
