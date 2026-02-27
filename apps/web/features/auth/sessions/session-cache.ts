/**
 * Bounded-TTL revocation cache.
 *
 * Per-sid entries with 60s TTL. Immediate local invalidation when
 * revokeSession is called on the same process. Cross-server worst case: 60s stale.
 *
 * Fail-open: if DB is unreachable, skip check (matches current behavior).
 */

import { isSessionRevokedInDb } from "./session-repository"

interface CacheEntry {
  revoked: boolean
  checkedAt: number
}

const CACHE_TTL_MS = 60_000
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

const cache = new Map<string, CacheEntry>()

export function markRevoked(sid: string): void {
  cache.set(sid, { revoked: true, checkedAt: Date.now() })
}

export async function isRevoked(sid: string): Promise<boolean> {
  const entry = cache.get(sid)
  const now = Date.now()

  if (entry && now - entry.checkedAt < CACHE_TTL_MS) {
    return entry.revoked
  }

  // Cache miss or stale — query DB
  try {
    const revoked = await isSessionRevokedInDb(sid)
    cache.set(sid, { revoked, checkedAt: now })
    return revoked
  } catch {
    // Fail-open: DB unreachable, don't block the request
    return false
  }
}

// Periodic cleanup: remove entries older than 30 days (JWT max age)
const JWT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function cleanup(): void {
  const now = Date.now()
  for (const [sid, entry] of cache.entries()) {
    if (now - entry.checkedAt > JWT_MAX_AGE_MS) {
      cache.delete(sid)
    }
  }
}

if (typeof setInterval !== "undefined" && typeof process !== "undefined" && !process.env.VITEST) {
  setInterval(cleanup, CLEANUP_INTERVAL_MS)
}

// Export for testing
export function _clearCache(): void {
  cache.clear()
}

export function _getCacheSize(): number {
  return cache.size
}
