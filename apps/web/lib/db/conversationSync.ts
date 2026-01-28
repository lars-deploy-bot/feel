"use client"

/**
 * Conversation Sync Service
 *
 * Handles syncing between local Dexie database and remote Supabase.
 *
 * IMPORTANT: Supabase calls are STUBBED for now.
 * The user will implement Supabase integration later.
 *
 * Key behaviors:
 * - Debounced sync (2 second delay)
 * - Lazy loading (metadata first, messages per-tab)
 * - Exponential backoff on failure
 * - Soft deletes only (never hard delete)
 */

import { getMessageDb, type DbMessage } from "./messageDb"

// =============================================================================
// Configuration
// =============================================================================

const SYNC_DEBOUNCE_MS = 2000
const INITIAL_RETRY_MS = 5000
const MAX_RETRY_MS = 60000

// =============================================================================
// Sync Queue (Debounced)
// =============================================================================

let syncTimeout: ReturnType<typeof setTimeout> | null = null
const pendingSyncConversationIds = new Set<string>()

/**
 * Queue a conversation for sync (debounced).
 * Multiple calls within SYNC_DEBOUNCE_MS are batched together.
 */
export function queueSync(conversationId: string, userId: string): void {
  pendingSyncConversationIds.add(conversationId)

  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    const ids = Array.from(pendingSyncConversationIds)
    pendingSyncConversationIds.clear()
    syncConversations(ids, userId)
  }, SYNC_DEBOUNCE_MS)
}

/**
 * Force immediate sync (bypasses debounce).
 * Use sparingly - only for critical operations like share/unshare.
 */
export function forceSyncNow(conversationId: string, userId: string): void {
  syncConversations([conversationId], userId)
}

// =============================================================================
// Online/Offline Handling
// =============================================================================

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[sync] Online - will retry pending syncs on next operation")
    // Note: We don't auto-retry here because we don't have userId in scope.
    // The next user action will trigger a sync.
  })
}

// =============================================================================
// Core Sync Operations
// =============================================================================

/**
 * Sync conversations to server.
 *
 * STUBBED: Supabase calls are no-ops for now.
 * When ready, uncomment the Supabase sections.
 */
async function syncConversations(conversationIds: string[], userId: string): Promise<void> {
  const db = getMessageDb(userId)

  for (const id of conversationIds) {
    try {
      const conversation = await db.conversations.get(id)
      if (!conversation) continue

      // =================================================================
      // STUB: Supabase upsert conversation
      // =================================================================
      // const supabase = createClient()
      // await supabase.from("conversations").upsert({
      //   id: conversation.id,
      //   workspace: conversation.workspace,
      //   org_id: conversation.orgId,
      //   creator_id: conversation.creatorId,
      //   title: conversation.title,
      //   visibility: conversation.visibility,
      //   created_at: new Date(conversation.createdAt).toISOString(),
      //   updated_at: new Date(conversation.updatedAt).toISOString(),
      //   message_count: conversation.messageCount ?? 0,
      //   last_message_at: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toISOString() : null,
      //   first_user_message_id: conversation.firstUserMessageId ?? null,
      //   auto_title_set: conversation.autoTitleSet ?? false,
      //   deleted_at: conversation.deletedAt ? new Date(conversation.deletedAt).toISOString() : null,
      //   archived_at: conversation.archivedAt ? new Date(conversation.archivedAt).toISOString() : null,
      // })
      console.log(`[sync] STUB: Would sync conversation ${id} to Supabase`)

      // Get pending messages (not streaming)
      const tabs = await db.tabs.where("conversationId").equals(id).toArray()
      const tabIds = tabs.map(t => t.id)

      const pendingMessages = await db.messages
        .where("tabId")
        .anyOf(tabIds)
        .and(m => m.pendingSync === true && m.status !== "streaming")
        .toArray()

      if (pendingMessages.length > 0) {
        // =================================================================
        // STUB: Supabase upsert messages
        // =================================================================
        // await supabase.from("messages").upsert(pendingMessages.map(...))
        console.log(`[sync] STUB: Would sync ${pendingMessages.length} messages`)

        // Mark as synced
        const now = Date.now()
        await db.messages.bulkPut(
          pendingMessages.map(m => ({
            ...m,
            syncedAt: now,
            pendingSync: false,
          })),
        )
      }

      // Get pending tabs
      const pendingTabs = await db.tabs
        .where("conversationId")
        .equals(id)
        .and(t => t.pendingSync === true)
        .toArray()

      if (pendingTabs.length > 0) {
        // =================================================================
        // STUB: Supabase upsert tabs
        // =================================================================
        console.log(`[sync] STUB: Would sync ${pendingTabs.length} tabs`)

        const now = Date.now()
        await db.tabs.bulkPut(
          pendingTabs.map(t => ({
            ...t,
            syncedAt: now,
            pendingSync: false,
          })),
        )
      }

      // Mark conversation as synced
      await db.conversations.update(id, {
        syncedAt: Date.now(),
        pendingSync: false,
        lastSyncError: undefined,
        lastSyncAttemptAt: undefined,
        nextRetryAt: undefined,
      })

      console.log(`[sync] Marked conversation ${id} as synced (local only - Supabase stubbed)`)
    } catch (error) {
      // Set exponential backoff retry
      const conversation = await db.conversations.get(id)
      const lastAttempt = conversation?.lastSyncAttemptAt ?? 0
      const timeSinceLastAttempt = Date.now() - lastAttempt
      const backoff = Math.min(
        INITIAL_RETRY_MS * 2 ** Math.floor(timeSinceLastAttempt / INITIAL_RETRY_MS),
        MAX_RETRY_MS,
      )

      await db.conversations.update(id, {
        lastSyncError: error instanceof Error ? error.message : String(error),
        lastSyncAttemptAt: Date.now(),
        nextRetryAt: Date.now() + backoff,
      })

      console.error("[sync] Failed to sync conversation", {
        conversationId: id,
        workspace: conversation?.workspace,
        error,
      })
    }
  }
}

// =============================================================================
// Fetch Operations (Lazy Loading)
// =============================================================================

/**
 * Fetch user's conversations from server.
 *
 * CRITICAL: This fetches METADATA ONLY, not messages!
 * Messages are loaded lazily per-tab via fetchTabMessages.
 *
 * STUBBED: Returns empty for now. Will populate from Supabase later.
 */
export async function fetchConversations(workspace: string, _userId: string, _orgId: string): Promise<void> {
  console.log(`[sync] STUB: Would fetch conversations for workspace ${workspace}`)

  // =================================================================
  // STUB: Supabase fetch
  // =================================================================
  // const supabase = createClient()
  // const { data: ownConversations } = await supabase
  //   .from("conversations")
  //   .select(`
  //     id, workspace, org_id, creator_id, title, visibility,
  //     created_at, updated_at, message_count, last_message_at,
  //     first_user_message_id, auto_title_set, deleted_at, archived_at,
  //     conversation_tabs(id, conversation_id, name, position, created_at, message_count, last_message_at)
  //   `)
  //   .eq("workspace", workspace)
  //   .eq("creator_id", userId)
  //   .is("deleted_at", null)
  //   .order("updated_at", { ascending: false })
  //
  // ... process and store in Dexie ...

  // For now, do nothing - conversations are created locally
}

/**
 * Fetch messages for a specific tab (lazy loading).
 * Call this when user opens a conversation/tab.
 *
 * STUBBED: Returns local messages only.
 */
export async function fetchTabMessages(
  tabId: string,
  userId: string,
  _cursor?: string, // ISO timestamp for pagination
): Promise<{ messages: DbMessage[]; hasMore: boolean }> {
  console.log(`[sync] STUB: Would fetch messages for tab ${tabId}`)

  const db = getMessageDb(userId)

  // Return local messages (no server fetch yet)
  const messages = await db.messages.where("[tabId+createdAt]").between([tabId, 0], [tabId, Date.now()]).toArray()

  return {
    messages,
    hasMore: false,
  }
}

// =============================================================================
// Conversation Operations
// =============================================================================

/**
 * Share a conversation with the organization.
 */
export async function shareConversation(conversationId: string, userId: string): Promise<void> {
  const db = getMessageDb(userId)
  await db.conversations.update(conversationId, {
    visibility: "shared",
    updatedAt: Date.now(),
    pendingSync: true,
  })

  // Immediate sync for visibility changes
  forceSyncNow(conversationId, userId)
}

/**
 * Make a conversation private again.
 */
export async function unshareConversation(conversationId: string, userId: string): Promise<void> {
  const db = getMessageDb(userId)
  await db.conversations.update(conversationId, {
    visibility: "private",
    updatedAt: Date.now(),
    pendingSync: true,
  })

  // Immediate sync for visibility changes
  forceSyncNow(conversationId, userId)
}

/**
 * Archive a conversation (hide from sidebar, restorable later).
 *
 * Sets archivedAt instead of deletedAt - conversation can be restored.
 */
export async function archiveConversation(conversationId: string, userId: string): Promise<void> {
  const db = getMessageDb(userId)
  await db.conversations.update(conversationId, {
    archivedAt: Date.now(),
    updatedAt: Date.now(),
    pendingSync: true,
  })

  console.log(`[sync] STUB: Would archive conversation ${conversationId} on Supabase`)

  // Immediate sync for archive operations
  forceSyncNow(conversationId, userId)
}

/**
 * Soft delete a conversation (NEVER hard delete!).
 *
 * Hard deletes cause permanent desync on multi-device setups.
 */
export async function deleteConversation(conversationId: string, userId: string): Promise<void> {
  const db = getMessageDb(userId)
  await db.conversations.update(conversationId, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
    pendingSync: true,
  })

  // =================================================================
  // STUB: Supabase soft delete
  // =================================================================
  // const supabase = createClient()
  // await supabase.from("conversations").update({
  //   deleted_at: new Date().toISOString(),
  //   updated_at: new Date().toISOString(),
  // }).eq("id", conversationId)

  console.log(`[sync] STUB: Would soft delete conversation ${conversationId} on Supabase`)

  // Immediate sync for delete operations
  forceSyncNow(conversationId, userId)
}

// =============================================================================
// Realtime Subscriptions (STUBBED)
// =============================================================================

/**
 * Subscribe to realtime updates for shared conversations.
 * Call this when entering a workspace.
 *
 * STUBBED: Returns no-op unsubscribe function.
 */
export function subscribeToSharedConversations(
  workspace: string,
  _orgId: string,
  _userId: string,
  _onMessage: (message: DbMessage) => void,
): () => void {
  console.log(`[sync] STUB: Would subscribe to shared conversations in ${workspace}`)

  // =================================================================
  // STUB: Supabase realtime
  // =================================================================
  // const supabase = createClient()
  // const channel = supabase
  //   .channel(`workspace:${workspace}:org:${orgId}`)
  //   .on('postgres_changes', { ... }, payload => {
  //     onMessage(...)
  //   })
  //   .subscribe()
  //
  // return () => supabase.removeChannel(channel)

  // Return no-op unsubscribe
  return () => {
    console.log(`[sync] STUB: Would unsubscribe from ${workspace}`)
  }
}
