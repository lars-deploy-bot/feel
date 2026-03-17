"use client"

/**
 * React Hooks for Dexie Message Database
 *
 * Uses useLiveQuery from dexie-react-hooks for reactive queries.
 * All hooks require a session context (userId + orgId) for security.
 *
 * CRITICAL: Must filter by BOTH creatorId AND orgId for shared conversations
 * to prevent leaking other orgs' data from local cache.
 */

import Dexie from "dexie"
import { useLiveQuery } from "dexie-react-hooks"
import { useMemo } from "react"
import { type DbConversation, type DbMessage, type DbTab, getMessageDb } from "./messageDb"

// =============================================================================
// Session Context
// =============================================================================

/**
 * Session context required for all conversation operations.
 * Never allow operations without these values.
 */
export interface SessionContext {
  userId: string
  orgId: string
}

// =============================================================================
// Conversation Hooks
// =============================================================================

/**
 * Get conversations for a workspace (user's own + shared from same org).
 *
 * Uses composite index [workspace+updatedAt] for efficient sorted query.
 * Filters by creatorId OR (shared AND same orgId) for security.
 */
export function useConversations(workspace: string | null, session: SessionContext | null): DbConversation[] {
  return (
    useLiveQuery(
      async () => {
        if (!workspace || !session?.userId || !session?.orgId) return []

        const db = getMessageDb(session.userId)

        // Use composite index for efficient sorted query
        return (
          db.conversations
            .where("[workspace+updatedAt]")
            .between([workspace, Dexie.minKey], [workspace, Dexie.maxKey])
            // CRITICAL: Filter for security
            .and(
              c =>
                !c.deletedAt && // Exclude soft-deleted
                !c.archivedAt && // Exclude archived
                (c.creatorId === session.userId || // User's own
                  (c.visibility === "shared" && c.orgId === session.orgId)), // Shared in same org
            )
            .reverse() // Most recent first
            .toArray()
        )
      },
      [workspace, session?.userId, session?.orgId],
      [],
    ) ?? []
  )
}

/**
 * Get only shared conversations for a workspace (team view).
 * Uses composite index [orgId+visibility+updatedAt] for performance.
 */
export function useSharedConversations(workspace: string | null, session: SessionContext | null): DbConversation[] {
  return (
    useLiveQuery(
      async () => {
        if (!workspace || !session?.userId || !session?.orgId) return []

        const db = getMessageDb(session.userId)

        return db.conversations
          .where("[orgId+visibility+updatedAt]")
          .between([session.orgId, "shared", Dexie.minKey], [session.orgId, "shared", Dexie.maxKey])
          .and(c => !c.deletedAt && !c.archivedAt && c.workspace === workspace) // Filter by workspace and exclude deleted/archived
          .reverse()
          .toArray()
      },
      [workspace, session?.userId, session?.orgId],
      [],
    ) ?? []
  )
}

/**
 * Get ALL conversations across ALL workspaces (user's own + shared from user's orgs).
 *
 * Uses composite index [creatorId+updatedAt] for efficient sorted query.
 * Filters by creatorId OR (shared AND orgId in user's org set) for security.
 */
export function useAllConversations(session: SessionContext | null, orgIds: ReadonlySet<string>): DbConversation[] {
  // Stabilize orgIds set — useLiveQuery deps comparison uses Object.is, so we
  // serialize to a sorted string to avoid re-firing on every render.
  const orgIdsKey = useMemo(() => [...orgIds].sort().join(","), [orgIds])

  return (
    useLiveQuery(
      async () => {
        if (!session?.userId || orgIds.size === 0) return []

        const db = getMessageDb(session.userId)

        // Fetch own conversations via [creatorId+updatedAt] index
        const own = await db.conversations
          .where("[creatorId+updatedAt]")
          .between([session.userId, Dexie.minKey], [session.userId, Dexie.maxKey])
          .and(c => !c.deletedAt && !c.archivedAt)
          .toArray()

        // Fetch shared conversations from each of the user's orgs
        const sharedResults: DbConversation[] = []
        for (const orgId of orgIds) {
          const shared = await db.conversations
            .where("[orgId+visibility+updatedAt]")
            .between([orgId, "shared", Dexie.minKey], [orgId, "shared", Dexie.maxKey])
            .and(c => !c.deletedAt && !c.archivedAt && c.creatorId !== session.userId)
            .toArray()
          sharedResults.push(...shared)
        }

        // Merge and sort by updatedAt descending, stable tiebreaker by id
        const merged = [...own, ...sharedResults]
        merged.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
        return merged
      },
      [session?.userId, orgIdsKey],
      [],
    ) ?? []
  )
}

/**
 * Get ALL archived conversations across ALL workspaces (user's own only).
 */
export function useAllArchivedConversations(session: SessionContext | null): DbConversation[] {
  return (
    useLiveQuery(
      async () => {
        if (!session?.userId) return []

        const db = getMessageDb(session.userId)

        return db.conversations
          .where("[creatorId+updatedAt]")
          .between([session.userId, Dexie.minKey], [session.userId, Dexie.maxKey])
          .and(c => !c.deletedAt && !!c.archivedAt)
          .reverse()
          .toArray()
      },
      [session?.userId],
      [],
    ) ?? []
  )
}

/**
 * Get archived conversations for a workspace.
 * Shows user's own archived conversations that can be restored.
 */
export function useArchivedConversations(workspace: string | null, session: SessionContext | null): DbConversation[] {
  return (
    useLiveQuery(
      async () => {
        if (!workspace || !session?.userId || !session?.orgId) return []

        const db = getMessageDb(session.userId)

        // Get archived conversations (has archivedAt but not deletedAt)
        return db.conversations
          .where("[workspace+updatedAt]")
          .between([workspace, Dexie.minKey], [workspace, Dexie.maxKey])
          .and(
            c =>
              !c.deletedAt && // Not deleted
              !!c.archivedAt && // Is archived
              c.creatorId === session.userId, // User's own only (can't unarchive shared)
          )
          .reverse() // Most recently archived first
          .toArray()
      },
      [workspace, session?.userId, session?.orgId],
      [],
    ) ?? []
  )
}

/**
 * Get a single conversation by ID.
 */
export function useConversation(id: string | null, userId: string | null): DbConversation | null {
  return (
    useLiveQuery(
      async () => {
        if (!id || !userId) return null
        const db = getMessageDb(userId)
        return (await db.conversations.get(id)) ?? null
      },
      [id, userId],
      null,
    ) ?? null
  )
}

// =============================================================================
// Tab Hooks
// =============================================================================

/**
 * Get tabs for a conversation, ordered by position.
 * Uses composite index [conversationId+position] for efficient query.
 */
export function useTabs(conversationId: string | null, userId: string | null): DbTab[] {
  return (
    useLiveQuery(
      async () => {
        if (!conversationId || !userId) return []

        const db = getMessageDb(userId)

        return db.tabs
          .where("[conversationId+position]")
          .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
          .toArray()
      },
      [conversationId, userId],
      [],
    ) ?? []
  )
}

/**
 * Get a single tab by ID.
 */
export function useTab(tabId: string | null, userId: string | null): DbTab | null {
  return (
    useLiveQuery(
      async () => {
        if (!tabId || !userId) return null
        const db = getMessageDb(userId)
        return (await db.tabs.get(tabId)) ?? null
      },
      [tabId, userId],
      null,
    ) ?? null
  )
}

// =============================================================================
// Message Hooks
// =============================================================================

/**
 * Get messages for a tab (messages belong to tabs, NOT conversations).
 * Uses composite index [tabId+seq] for reliable ordering by sequence number.
 * Filters out soft-deleted messages (those with deletedAt set).
 */
export function useMessages(tabId: string | null, userId: string | null): DbMessage[] | undefined {
  return useLiveQuery(
    async () => {
      if (!tabId || !userId) return []

      const db = getMessageDb(userId)

      // Order by seq (sequence number) for reliable ordering
      // Filter out soft-deleted messages
      return db.messages
        .where("[tabId+seq]")
        .between([tabId, Dexie.minKey], [tabId, Dexie.maxKey])
        .and(m => !m.deletedAt) // Exclude deleted messages
        .toArray()
    },
    [tabId, userId],
    // No default — returns undefined while the async query resolves.
    // This lets consumers distinguish "loading" from "genuinely empty".
  )
}

/**
 * Get pending (unsynced) messages for a tab.
 * Useful for showing sync status in UI.
 */
export function usePendingMessages(tabId: string | null, userId: string | null): DbMessage[] {
  return (
    useLiveQuery(
      async () => {
        if (!tabId || !userId) return []

        const db = getMessageDb(userId)

        // Note: Dexie stores booleans as 0/1 in indexes, so we filter manually
        return db.messages
          .where("tabId")
          .equals(tabId)
          .and(m => m.pendingSync === true)
          .toArray()
      },
      [tabId, userId],
      [],
    ) ?? []
  )
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Get total message count for a conversation (across all tabs).
 * Uses conversation.messageCount metadata for efficiency.
 */
export function useConversationMessageCount(conversationId: string | null, userId: string | null): number {
  const conversation = useConversation(conversationId, userId)
  return conversation?.messageCount ?? 0
}

/**
 * Check if there are any pending syncs for a workspace.
 */
export function useHasPendingSyncs(workspace: string | null, userId: string | null): boolean {
  return (
    useLiveQuery(
      async () => {
        if (!workspace || !userId) return false

        const db = getMessageDb(userId)

        const pendingConvo = await db.conversations
          .where("pendingSync")
          .equals(1) // Dexie stores booleans as 0/1 in indexes
          .and(c => c.workspace === workspace)
          .first()

        return pendingConvo !== undefined
      },
      [workspace, userId],
      false,
    ) ?? false
  )
}
