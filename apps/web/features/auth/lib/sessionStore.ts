/**
 * Session store - Supabase IAM backed
 * Stores Claude SDK session IDs for conversation persistence
 *
 * NOTE: Session keys use workspace domain (e.g., "demo.goalive.nl") for compatibility
 * with conversation locking and cancellation, but database uses domain_id internally.
 */

import {
  hasExistingSession,
  isConversationLocked,
  tryLockConversation,
  unlockConversation,
} from "@/features/auth/types/session"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"

export interface SessionStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

// Parse composite key: userId::workspaceDomain::conversationId
function parseKey(key: string): { userId: string; workspaceDomain: string; conversationId: string } {
  const [userId, workspaceDomain, conversationId] = key.split("::")
  return { userId, workspaceDomain: workspaceDomain || "default", conversationId }
}

// In-memory cache for hostname → domain_id lookups (reduces DB queries by 50%)
// Cache entries expire after 5 minutes to handle domain changes
interface DomainCacheEntry {
  domainId: string
  timestamp: number
}

const domainIdCache = new Map<string, DomainCacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get domain_id for a hostname, using cache when possible
 * This reduces DB queries from 2 per session operation to 1
 */
async function getDomainId(hostname: string): Promise<string | null> {
  const now = Date.now()
  const cached = domainIdCache.get(hostname)

  // Return cached value if not expired
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.domainId
  }

  // Cache miss or expired - query database
  const app = await createAppClient("service")
  const { data: domain } = await app.from("domains").select("domain_id").eq("hostname", hostname).single()

  if (!domain) {
    // Remove stale cache entry if domain no longer exists
    domainIdCache.delete(hostname)
    return null
  }

  // Update cache
  domainIdCache.set(hostname, {
    domainId: domain.domain_id,
    timestamp: now,
  })

  return domain.domain_id
}

// Periodic cleanup of expired cache entries (every 10 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now()
      let cleanedCount = 0

      for (const [hostname, entry] of domainIdCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
          domainIdCache.delete(hostname)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        console.log(`[SessionStore] Cleaned up ${cleanedCount} expired domain cache entries`)
      }
    },
    10 * 60 * 1000,
  )
}

export const SessionStoreMemory: SessionStore = {
  async get(key: string): Promise<string | null> {
    const { userId, workspaceDomain, conversationId } = parseKey(key)

    // Look up domain_id from hostname (cached)
    const domainId = await getDomainId(workspaceDomain)

    if (!domainId) {
      console.warn(`[SessionStore] Domain not found: ${workspaceDomain}`)
      return null
    }

    // Query session from IAM
    const iam = await createIamClient("service")
    const { data: session } = await iam
      .from("sessions")
      .select("sdk_session_id")
      .eq("user_id", userId)
      .eq("domain_id", domainId)
      .eq("conversation_id", conversationId)
      .single()

    return session?.sdk_session_id || null
  },

  async set(key: string, value: string): Promise<void> {
    const { userId, workspaceDomain, conversationId } = parseKey(key)

    // Look up domain_id from hostname (cached)
    const domainId = await getDomainId(workspaceDomain)

    if (!domainId) {
      throw new Error(`Domain not found: ${workspaceDomain}`)
    }

    // Upsert session in IAM (updates if exists, inserts if not)
    const iam = await createIamClient("service")
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await iam.from("sessions").upsert(
      {
        user_id: userId,
        domain_id: domainId,
        conversation_id: conversationId,
        sdk_session_id: value,
        last_activity: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      {
        onConflict: "user_id,domain_id,conversation_id",
      },
    )
  },

  async delete(key: string): Promise<void> {
    const { userId, workspaceDomain, conversationId } = parseKey(key)

    // Look up domain_id from hostname (cached)
    const domainId = await getDomainId(workspaceDomain)

    if (!domainId) {
      // If domain doesn't exist, session doesn't either - silent success
      return
    }

    // Delete session from IAM
    const iam = await createIamClient("service")
    await iam
      .from("sessions")
      .delete()
      .eq("user_id", userId)
      .eq("domain_id", domainId)
      .eq("conversation_id", conversationId)
  },
}

// Helper to build a stable key (user + workspace + conversation)
// Used for Claude SDK session persistence - same conversation = same session
export function sessionKey({
  userId,
  workspace,
  conversationId,
}: {
  userId: string
  workspace?: string
  conversationId: string
}) {
  return `${userId}::${workspace ?? "default"}::${conversationId}`
}

// Helper to build a lock key (user + workspace + conversation + tab)
// Used for concurrent request prevention - each browser tab can work independently
// Without tabId, two browser windows viewing the same conversation would block each other
export function lockKey({
  userId,
  workspace,
  conversationId,
  tabId,
}: {
  userId: string
  workspace?: string
  conversationId: string
  tabId?: string
}) {
  // If no tabId provided, fall back to conversation-level locking (legacy behavior)
  const base = `${userId}::${workspace ?? "default"}::${conversationId}`
  return tabId ? `${base}::${tabId}` : base
}

// Re-export guards from types/guards/session for backward compatibility
export { tryLockConversation, unlockConversation, isConversationLocked, hasExistingSession }
