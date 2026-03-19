"use client"

/**
 * Conversation Sync Service
 *
 * Handles syncing between local Dexie database and remote Supabase via API.
 *
 * Key behaviors:
 * - Debounced sync (2 second delay)
 * - Batch sync (multiple conversations in one request)
 * - Conflict detection (server rejects stale writes)
 * - Lazy loading (metadata first, messages per-tab)
 * - Exponential backoff on failure
 * - Soft deletes only (never hard delete)
 * - Cross-device sync: populates localStorage tabStore from Dexie on fetch
 */

import Dexie from "dexie"
import { logError } from "@/lib/client-error-logger"
import { normalizeConversationSourcePayload } from "@/lib/conversations/source"
import {
  type ConflictInfo,
  type ConversationsResponse,
  type MessagesResponse,
  type SyncResult,
  VALID_MESSAGE_STATUSES,
  VALID_MESSAGE_TYPES,
} from "@/lib/conversations/sync-types"
import { type DbConversation, type DbMessage, type DbMessageContent, type DbTab, getMessageDb } from "./messageDb"
import { syncDexieTabsToLocalStorage } from "./tabSync"

// =============================================================================
// Configuration
// =============================================================================

const SYNC_DEBOUNCE_MS = 2000
const INITIAL_RETRY_MS = 5000
const MAX_RETRY_MS = 60000
const BATCH_SIZE = 10 // Max conversations per batch request

// =============================================================================
// Runtime Narrowing (uses shared constants from sync-types.ts)
// =============================================================================

function normalizeMessageType(raw: string): DbMessage["type"] {
  if (VALID_MESSAGE_TYPES.has(raw)) return raw as DbMessage["type"]
  return "system"
}

function normalizeMessageStatus(raw: string): DbMessage["status"] {
  if (VALID_MESSAGE_STATUSES.has(raw)) return raw as DbMessage["status"]
  return "complete"
}

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

// Note: We don't auto-retry on "online" event because we don't have userId in scope.
// The next user action will trigger a sync.

// =============================================================================
// Core Sync Operations
// =============================================================================

/**
 * Build sync payload for a conversation
 */
async function buildConversationPayload(db: ReturnType<typeof getMessageDb>, conversation: DbConversation) {
  // Get all tabs for this conversation
  const tabs = await db.tabs.where("conversationId").equals(conversation.id).toArray()
  const tabIds = tabs.map(t => t.id)

  // Get pending messages (not streaming)
  const pendingMessages = await db.messages
    .where("tabId")
    .anyOf(tabIds)
    .and(m => m.pendingSync === true && m.status !== "streaming")
    .toArray()

  // Get pending tabs
  const pendingTabs = tabs.filter(t => t.pendingSync === true)

  return {
    conversation: {
      id: conversation.id,
      workspace: conversation.workspace,
      orgId: conversation.orgId,
      title: conversation.title,
      visibility: conversation.visibility,
      messageCount: conversation.messageCount ?? 0,
      lastMessageAt: conversation.lastMessageAt ?? null,
      firstUserMessageId: conversation.firstUserMessageId ?? null,
      autoTitleSet: conversation.autoTitleSet ?? false,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      deletedAt: conversation.deletedAt ?? null,
      archivedAt: conversation.archivedAt ?? null,
      remoteUpdatedAt: conversation.remoteUpdatedAt ?? null,
    },
    tabs: pendingTabs.map(t => ({
      id: t.id,
      conversationId: t.conversationId,
      name: t.name,
      position: t.position,
      messageCount: t.messageCount ?? 0,
      lastMessageAt: t.lastMessageAt ?? null,
      createdAt: t.createdAt,
      closedAt: t.closedAt ?? null,
      draft: t.draft ?? null,
    })),
    messages: pendingMessages.map(m => ({
      id: m.id,
      tabId: m.tabId,
      type: m.type,
      content: m.content,
      version: m.version,
      status: m.status,
      seq: m.seq,
      abortedAt: m.abortedAt ?? null,
      errorCode: m.errorCode ?? null,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })),
    pendingTabs,
    pendingMessages,
  }
}

/**
 * Handle sync conflict by fetching fresh server state, then re-queue
 * if local pending messages/tabs still need to reach the server.
 *
 * Previous behavior just cleared remoteUpdatedAt and hoped the next user
 * action would trigger a refresh — leaving pending messages stranded forever
 * if the user reloaded before that happened.
 */
async function handleConflict(
  db: ReturnType<typeof getMessageDb>,
  conflict: ConflictInfo,
  userId: string,
): Promise<void> {
  logError("sync", `Conflict detected for ${conflict.conversationId}`, {
    local: new Date(conflict.localUpdatedAt).toISOString(),
    server: new Date(conflict.serverUpdatedAt).toISOString(),
  })

  // Step 1: Accept the server's version of the conversation metadata.
  // Clear remoteUpdatedAt so the next fetchConversations overwrites local metadata.
  await db.conversations.update(conflict.conversationId, {
    pendingSync: false,
    lastSyncError: undefined,
    remoteUpdatedAt: undefined,
  })

  // Step 2: Check if there are still pending messages or tabs that never made it.
  const tabs = await db.tabs.where("conversationId").equals(conflict.conversationId).toArray()
  const tabIds = tabs.map(t => t.id)
  const hasPendingTabs = tabs.some(t => t.pendingSync === true)
  const hasPendingMessages =
    tabIds.length > 0 &&
    (await db.messages
      .where("tabId")
      .anyOf(tabIds)
      .and(m => m.pendingSync === true && m.status !== "streaming")
      .count()) > 0

  if (hasPendingTabs || hasPendingMessages) {
    // Step 3: Re-mark conversation for sync so pending data gets another chance.
    // Use a short delay to let the server state settle after the conflict.
    await db.conversations.update(conflict.conversationId, {
      pendingSync: true,
      lastSyncError: `Conflict resolved, retrying ${hasPendingMessages ? "messages" : "tabs"}`,
      nextRetryAt: Date.now() + INITIAL_RETRY_MS,
    })

    // Step 4: Feed the conversation back into the in-memory sync queue.
    // The INITIAL_RETRY_MS delay in queueSync's debounce gives the server time to settle.
    setTimeout(() => queueSync(conflict.conversationId, userId), INITIAL_RETRY_MS)
  }
}

/**
 * Sync conversations to server via API.
 * Uses batch API when syncing multiple conversations.
 */
async function syncConversations(conversationIds: string[], userId: string): Promise<void> {
  // Skip sync if offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return
  }

  const db = getMessageDb(userId)

  // Gather all payloads first
  const payloads: Array<{
    conversationId: string
    payload: Awaited<ReturnType<typeof buildConversationPayload>>
  }> = []

  for (const id of conversationIds) {
    const conversation = await db.conversations.get(id)
    if (!conversation) continue
    payloads.push({
      conversationId: id,
      payload: await buildConversationPayload(db, conversation),
    })
  }

  if (payloads.length === 0) return

  // Use batch API for multiple conversations
  if (payloads.length > 1) {
    // Split into batches
    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
      const batch = payloads.slice(i, i + BATCH_SIZE)
      await syncBatch(db, batch, userId)
    }
  } else {
    // Single conversation - use direct endpoint
    await syncSingle(db, payloads[0], userId)
  }
}

/**
 * Sync a batch of conversations
 */
async function syncBatch(
  db: ReturnType<typeof getMessageDb>,
  batch: Array<{ conversationId: string; payload: Awaited<ReturnType<typeof buildConversationPayload>> }>,
  userId: string,
): Promise<void> {
  try {
    const response = await fetch("/api/conversations/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversations: batch.map(b => ({
          conversation: b.payload.conversation,
          tabs: b.payload.tabs,
          messages: b.payload.messages,
        })),
      }),
      credentials: "include",
    })

    const result: SyncResult = await response.json()
    const now = Date.now()

    // Handle conflicts
    if (result.conflicts) {
      for (const conflict of result.conflicts) {
        await handleConflict(db, conflict, userId)
      }
    }

    // Mark successful syncs
    for (const item of batch) {
      // Skip if this conversation had a conflict
      if (result.conflicts?.some(c => c.conversationId === item.conversationId)) {
        continue
      }

      // Skip if there was an error for this conversation
      if (result.errors?.some(e => e.includes(item.conversationId))) {
        const error = result.errors.find(e => e.includes(item.conversationId))
        await db.conversations.update(item.conversationId, {
          lastSyncError: error,
          lastSyncAttemptAt: now,
        })
        continue
      }

      // Mark as synced
      if (item.payload.pendingMessages.length > 0) {
        await db.messages.bulkPut(item.payload.pendingMessages.map(m => ({ ...m, syncedAt: now, pendingSync: false })))
      }
      if (item.payload.pendingTabs.length > 0) {
        await db.tabs.bulkPut(item.payload.pendingTabs.map(t => ({ ...t, syncedAt: now, pendingSync: false })))
      }
      await db.conversations.update(item.conversationId, {
        syncedAt: now,
        remoteUpdatedAt: item.payload.conversation.updatedAt,
        pendingSync: false,
        lastSyncError: undefined,
        lastSyncAttemptAt: undefined,
        nextRetryAt: undefined,
      })
    }
  } catch (error) {
    // Mark all as failed with backoff
    const now = Date.now()
    for (const item of batch) {
      const conversation = await db.conversations.get(item.conversationId)
      const lastAttempt = conversation?.lastSyncAttemptAt ?? 0
      const timeSinceLastAttempt = now - lastAttempt
      const backoff = Math.min(
        INITIAL_RETRY_MS * 2 ** Math.floor(timeSinceLastAttempt / INITIAL_RETRY_MS),
        MAX_RETRY_MS,
      )

      await db.conversations.update(item.conversationId, {
        lastSyncError: error instanceof Error ? error.message : String(error),
        lastSyncAttemptAt: now,
        nextRetryAt: now + backoff,
      })
    }

    logError("sync", "Batch sync failed", {
      error: error instanceof Error ? error : undefined,
      conversationIds: batch.map(b => b.conversationId),
    })
  }
}

/**
 * Sync a single conversation
 */
async function syncSingle(
  db: ReturnType<typeof getMessageDb>,
  item: { conversationId: string; payload: Awaited<ReturnType<typeof buildConversationPayload>> },
  userId: string,
): Promise<void> {
  try {
    const response = await fetch("/api/conversations/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation: item.payload.conversation,
        tabs: item.payload.tabs,
        messages: item.payload.messages,
      }),
      credentials: "include",
    })

    if (response.status === 409) {
      // Conflict
      const { conflict } = await response.json()
      await handleConflict(db, conflict, userId)
      return
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(error.error || `Sync failed: ${response.status}`)
    }

    const now = Date.now()

    // Mark as synced
    if (item.payload.pendingMessages.length > 0) {
      await db.messages.bulkPut(item.payload.pendingMessages.map(m => ({ ...m, syncedAt: now, pendingSync: false })))
    }
    if (item.payload.pendingTabs.length > 0) {
      await db.tabs.bulkPut(item.payload.pendingTabs.map(t => ({ ...t, syncedAt: now, pendingSync: false })))
    }
    await db.conversations.update(item.conversationId, {
      syncedAt: now,
      remoteUpdatedAt: item.payload.conversation.updatedAt,
      pendingSync: false,
      lastSyncError: undefined,
      lastSyncAttemptAt: undefined,
      nextRetryAt: undefined,
    })
  } catch (error) {
    const conversation = await db.conversations.get(item.conversationId)
    const lastAttempt = conversation?.lastSyncAttemptAt ?? 0
    const timeSinceLastAttempt = Date.now() - lastAttempt
    const backoff = Math.min(INITIAL_RETRY_MS * 2 ** Math.floor(timeSinceLastAttempt / INITIAL_RETRY_MS), MAX_RETRY_MS)

    await db.conversations.update(item.conversationId, {
      lastSyncError: error instanceof Error ? error.message : String(error),
      lastSyncAttemptAt: Date.now(),
      nextRetryAt: Date.now() + backoff,
    })

    logError("sync", "Single conversation sync failed", {
      error: error instanceof Error ? error : undefined,
      conversationId: item.conversationId,
    })
  }
}

// =============================================================================
// Fetch Operations (Lazy Loading)
// =============================================================================

/**
 * In-flight deduplication for fetchTabMessages.
 * Prevents duplicate network requests when the same tab is loaded concurrently
 * (e.g., rapid tab switches, effect + click racing).
 */
const tabMessageFetches = new Map<string, Promise<{ messages: DbMessage[]; hasMore: boolean }>>()

/**
 * Sync from server: Fetch all conversations for a workspace.
 * Call this when entering a workspace to get the latest data.
 *
 * Returns stats about what was synced.
 */
export async function syncFromServer(
  workspace: string,
  userId: string,
  orgId: string,
): Promise<{ conversations: number; tabs: number; isOffline: boolean }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { conversations: 0, tabs: 0, isOffline: true }
  }

  await fetchConversations(userId, orgId, workspace)

  // Drain orphaned pending data: find conversations that have pending
  // messages/tabs but are not themselves marked pendingSync (the handleConflict bug).
  await drainOrphanedPendingData(userId, workspace)

  // Reconcile: fetch messages for tabs where server has more than local.
  // This closes the server→client gap where messages exist in Supabase
  // but were never lazy-loaded into IndexedDB.
  await reconcileMessageCounts(userId, workspace)

  // Count what we have locally now
  const db = getMessageDb(userId)
  const conversations = await db.conversations.where("workspace").equals(workspace).count()
  const tabs = await db.tabs.count() // Approximate, not filtered by workspace

  return { conversations, tabs, isOffline: false }
}

/**
 * Find conversations with pending messages/tabs that are NOT marked for sync
 * (orphans from prior conflict handling) and re-queue them.
 */
async function drainOrphanedPendingData(userId: string, workspace: string): Promise<void> {
  const db = getMessageDb(userId)

  // Get all pending messages
  const pendingMessages = await db.messages.where("pendingSync").equals(1).toArray()
  if (pendingMessages.length === 0) return

  // Map pending messages → tab → conversation
  const pendingTabIds = Array.from(new Set(pendingMessages.map(m => m.tabId)))
  const tabs = await db.tabs.where("id").anyOf(pendingTabIds).toArray()
  const conversationIds = new Set(tabs.map(t => t.conversationId))

  // Also check for pending tabs directly
  const pendingTabs = await db.tabs.where("pendingSync").equals(1).toArray()
  for (const t of pendingTabs) conversationIds.add(t.conversationId)

  // Filter to conversations in this workspace that are NOT already queued
  let requeued = 0
  for (const convId of Array.from(conversationIds)) {
    const conv = await db.conversations.get(convId)
    if (!conv || conv.workspace !== workspace || conv.pendingSync) continue

    await db.conversations.update(convId, { pendingSync: true })
    queueSync(convId, userId)
    requeued++
  }

  if (requeued > 0) {
    logError("sync", `Drained ${requeued} conversations with orphaned pending data`, { workspace })
  }
}

/**
 * Detect tabs where server has more messages than local IndexedDB and fetch them.
 * Uses messageCount from tab metadata (already synced via fetchConversations)
 * to avoid unnecessary network requests for tabs that are already complete.
 */
async function reconcileMessageCounts(userId: string, workspace: string): Promise<void> {
  const db = getMessageDb(userId)

  // Get all conversations in this workspace
  const conversations = await db.conversations.where("workspace").equals(workspace).toArray()
  const conversationIds = conversations.map(c => c.id)
  if (conversationIds.length === 0) return

  // Get all tabs for these conversations
  const tabs = await db.tabs.where("conversationId").anyOf(conversationIds).toArray()

  // Compare local message count with server-reported count for each tab
  const tabsToFetch: string[] = []
  for (const tab of tabs) {
    const serverCount = tab.messageCount ?? 0
    if (serverCount === 0) continue

    const localCount = await db.messages.where("tabId").equals(tab.id).count()
    if (serverCount > localCount) {
      tabsToFetch.push(tab.id)
    }
  }

  if (tabsToFetch.length === 0) return

  // Fetch missing messages in parallel (bounded concurrency)
  const RECONCILE_CONCURRENCY = 3
  for (let i = 0; i < tabsToFetch.length; i += RECONCILE_CONCURRENCY) {
    const batch = tabsToFetch.slice(i, i + RECONCILE_CONCURRENCY)
    await Promise.all(batch.map(tabId => fetchTabMessages(tabId, userId)))
  }

  logError("sync", `Reconciled ${tabsToFetch.length} tabs with missing messages`, { workspace })
}

/**
 * Fetch user's conversations from server.
 * workspace is optional — omit for cross-workspace unified sidebar fetch.
 *
 * CRITICAL: This fetches METADATA ONLY, not messages!
 * Messages are loaded lazily per-tab via fetchTabMessages.
 */
export async function fetchConversations(
  userId: string,
  _orgId: string,
  workspace?: string,
  cursor?: string,
): Promise<{ hasMore: boolean; nextCursor: string | null }> {
  // Skip fetch if offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { hasMore: false, nextCursor: null }
  }

  try {
    const url = new URL("/api/conversations", window.location.origin)
    if (workspace) url.searchParams.set("workspace", workspace)
    if (cursor) url.searchParams.set("cursor", cursor)

    const response = await fetch(url.toString(), {
      credentials: "include",
    })

    if (!response.ok) {
      logError("sync", "Fetch conversations returned non-OK", { status: response.status, workspace })
      return { hasMore: false, nextCursor: null }
    }

    const { own, shared, hasMore, nextCursor: responseCursor }: ConversationsResponse = await response.json()
    const db = getMessageDb(userId)

    // Merge server data with local data
    // Server is source of truth for synced conversations
    // Local changes take precedence if pendingSync is true

    // Collect tabs grouped by workspace for cross-device sync to localStorage
    const tabsByWorkspace = new Map<string, { tabs: DbTab[]; conversations: Array<{ id: string; title: string }> }>()

    for (const convo of [...own, ...shared]) {
      const local = await db.conversations.get(convo.id)

      // If local has pending changes, skip server update
      if (local?.pendingSync) {
        continue
      }

      // Track conversation for tab sync (grouped by workspace)
      const ws = convo.workspace
      if (!tabsByWorkspace.has(ws)) {
        tabsByWorkspace.set(ws, { tabs: [], conversations: [] })
      }
      const wsGroup = tabsByWorkspace.get(ws)!
      wsGroup.conversations.push({ id: convo.id, title: convo.title })

      const normalizedSource = normalizeConversationSourcePayload(convo.source, convo.sourceMetadata)

      // Upsert conversation from server
      const dbConvo: DbConversation = {
        id: convo.id,
        workspace: convo.workspace,
        orgId: convo.orgId,
        creatorId: convo.creatorId,
        title: convo.title,
        visibility: convo.visibility,
        createdAt: convo.createdAt,
        updatedAt: convo.updatedAt,
        messageCount: convo.messageCount,
        lastMessageAt: convo.lastMessageAt ?? undefined,
        firstUserMessageId: convo.firstUserMessageId ?? undefined,
        autoTitleSet: convo.autoTitleSet,
        source: normalizedSource.source,
        sourceMetadata: normalizedSource.sourceMetadata ?? undefined,
        deletedAt: convo.deletedAt ?? undefined,
        archivedAt: convo.archivedAt ?? undefined,
        syncedAt: Date.now(),
        remoteUpdatedAt: convo.updatedAt,
        pendingSync: false,
      }

      await db.conversations.put(dbConvo)

      // Upsert tabs from server
      for (const tab of convo.tabs || []) {
        const localTab = await db.tabs.get(tab.id)
        if (localTab?.pendingSync) continue

        const dbTab: DbTab = {
          id: tab.id,
          conversationId: tab.conversationId,
          name: tab.name,
          position: tab.position,
          createdAt: tab.createdAt,
          messageCount: tab.messageCount,
          lastMessageAt: tab.lastMessageAt ?? undefined,
          closedAt: tab.closedAt ?? undefined,
          draft: tab.draft ?? undefined,
          syncedAt: Date.now(),
          pendingSync: false,
        }

        await db.tabs.put(dbTab)
        wsGroup.tabs.push(dbTab)
      }
    }

    // Cross-device sync: populate localStorage tabStore per workspace
    // This enables clicking synced conversations in the sidebar to load correctly
    for (const [ws, { tabs, conversations }] of tabsByWorkspace) {
      syncDexieTabsToLocalStorage(ws, tabs, conversations)
    }

    return { hasMore: hasMore ?? false, nextCursor: responseCursor ?? null }
  } catch (error) {
    logError("sync", "Failed to fetch conversations", {
      error: error instanceof Error ? error : undefined,
      workspace,
    })
    return { hasMore: false, nextCursor: null }
  }
}

/**
 * Fetch messages for a specific tab (lazy loading).
 * Call this when user opens a conversation/tab.
 *
 * Deduplicates concurrent calls for the same tab — if a fetch is already
 * in flight, callers join the existing promise instead of firing another request.
 */
export function fetchTabMessages(
  tabId: string,
  userId: string,
  cursor?: string, // ISO timestamp for pagination
): Promise<{ messages: DbMessage[]; hasMore: boolean }> {
  // Deduplicate: if a fetch for this tab is already in flight, return the same promise.
  // Keyed by tabId+cursor so paginated requests aren't blocked.
  const dedupeKey = cursor ? `${tabId}:${cursor}` : tabId
  const inflight = tabMessageFetches.get(dedupeKey)
  if (inflight) return inflight

  const promise = fetchTabMessagesImpl(tabId, userId, cursor).finally(() => {
    tabMessageFetches.delete(dedupeKey)
  })
  tabMessageFetches.set(dedupeKey, promise)
  return promise
}

async function fetchTabMessagesImpl(
  tabId: string,
  userId: string,
  cursor?: string,
): Promise<{ messages: DbMessage[]; hasMore: boolean }> {
  const db = getMessageDb(userId)

  const localMessages = await db.messages
    .where("[tabId+seq]")
    .between([tabId, Dexie.minKey], [tabId, Dexie.maxKey])
    .toArray()

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { messages: localMessages, hasMore: false }
  }

  try {
    const url = new URL("/api/conversations/messages", window.location.origin)
    url.searchParams.set("tabId", tabId)
    if (cursor) url.searchParams.set("cursor", cursor)

    const response = await fetch(url.toString(), { credentials: "include" })

    if (!response.ok) {
      logError("sync", "Fetch tab messages returned non-OK", { status: response.status, tabId })

      // If server returned 404 but we have pending local messages, the tab
      // hasn't been synced yet. Re-queue the conversation so the tab + messages
      // get pushed to the server instead of being silently lost.
      if (response.status === 404) {
        const pendingLocal = localMessages.filter(m => m.pendingSync)
        if (pendingLocal.length > 0) {
          const tab = await db.tabs.get(tabId)
          if (tab) {
            await db.conversations.update(tab.conversationId, { pendingSync: true })
            queueSync(tab.conversationId, userId)
            logError(
              "sync",
              `Tab ${tabId} not on server but has ${pendingLocal.length} pending messages, re-queued`,
              {},
            )
          }
        }
      }

      return { messages: localMessages, hasMore: false }
    }

    const { messages: serverMessages, hasMore }: MessagesResponse = await response.json()

    // Merge server messages with local in a single transaction.
    // Batching avoids N intermediate useLiveQuery re-renders (one per put).
    const now = Date.now()
    await db.transaction("rw", [db.messages, db.tabs], async () => {
      // Identify local pending messages to skip (they take precedence)
      const pendingIds = new Set<string>()
      for (const msg of serverMessages) {
        const local = await db.messages.get(msg.id)
        if (local?.pendingSync) pendingIds.add(msg.id)
      }

      const messagesToPut: DbMessage[] = serverMessages
        .filter(msg => !pendingIds.has(msg.id))
        .map(msg => ({
          id: msg.id,
          tabId: msg.tabId,
          type: normalizeMessageType(msg.type),
          content: msg.content as DbMessageContent,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          version: msg.version,
          status: normalizeMessageStatus(msg.status),
          origin: "remote" as const,
          seq: msg.seq,
          abortedAt: msg.abortedAt ?? undefined,
          errorCode: msg.errorCode ?? undefined,
          syncedAt: now,
          pendingSync: false,
        }))

      if (messagesToPut.length > 0) {
        await db.messages.bulkPut(messagesToPut)
      }

      // Update local tab messageCount from merged state so counts stay accurate.
      // Don't rely on counts as "fully synced" signal, but keep them honest.
      const mergedMessages = await db.messages
        .where("[tabId+seq]")
        .between([tabId, Dexie.minKey], [tabId, Dexie.maxKey])
        .toArray()

      const lastMsg =
        mergedMessages.length > 0
          ? mergedMessages.reduce((latest, m) => (m.createdAt > latest.createdAt ? m : latest), mergedMessages[0])
          : null

      await db.tabs.update(tabId, {
        messageCount: mergedMessages.length,
        lastMessageAt: lastMsg?.createdAt,
      })
    })

    const updatedMessages = await db.messages
      .where("[tabId+seq]")
      .between([tabId, Dexie.minKey], [tabId, Dexie.maxKey])
      .toArray()

    return { messages: updatedMessages, hasMore }
  } catch (error) {
    logError("sync", "Failed to fetch tab messages", {
      error: error instanceof Error ? error : undefined,
      tabId,
    })
    return { messages: localMessages, hasMore: false }
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

  // Immediate sync for archive operations
  forceSyncNow(conversationId, userId)
}

/**
 * Restore a conversation from archive.
 *
 * Clears archivedAt to show conversation in sidebar again.
 */
export async function unarchiveConversation(conversationId: string, userId: string): Promise<void> {
  const db = getMessageDb(userId)
  const conversation = await db.conversations.get(conversationId)
  if (!conversation) return

  // Dexie doesn't support setting to undefined, so we need to read-modify-write
  const { archivedAt: _, ...rest } = conversation
  await db.conversations.put({
    ...rest,
    updatedAt: Date.now(),
    pendingSync: true,
  })

  // Immediate sync for unarchive operations
  forceSyncNow(conversationId, userId)
}

/**
 * Rename a conversation.
 *
 * Also sets autoTitleSet to true to prevent auto-title from overwriting.
 */
export async function renameConversation(conversationId: string, userId: string, title: string): Promise<void> {
  const db = getMessageDb(userId)
  const trimmed = title.trim()
  const newTitle = trimmed.length > 0 ? trimmed : "Untitled"

  await db.conversations.update(conversationId, {
    title: newTitle,
    autoTitleSet: true, // Prevent auto-title from overwriting manual rename
    updatedAt: Date.now(),
    pendingSync: true,
  })

  // Queue sync (not immediate - rename is not critical)
  queueSync(conversationId, userId)
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

  // Immediate sync for delete operations
  forceSyncNow(conversationId, userId)
}

// =============================================================================
// Realtime Subscriptions (TODO: Implement with Supabase Realtime)
// =============================================================================

/**
 * Subscribe to realtime updates for shared conversations.
 * Call this when entering a workspace.
 *
 * TODO: Implement with Supabase Realtime when needed.
 */
export function subscribeToSharedConversations(
  _workspace: string,
  _orgId: string,
  _userId: string,
  _onMessage: (message: DbMessage) => void,
): () => void {
  // Return no-op unsubscribe for now
  return () => {}
}
