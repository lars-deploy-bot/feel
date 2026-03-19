"use client"

/**
 * Conversation Sync Service
 *
 * Syncs local Dexie ↔ remote Supabase. Debounced push, batch sync,
 * conflict detection, lazy message loading, exponential backoff.
 */

import Dexie from "dexie"
import { logError } from "@/lib/client-error-logger"
import { normalizeConversationSourcePayload } from "@/lib/conversations/source"
import {
  type ConflictInfo,
  type ConversationsResponse,
  type MessagesResponse,
  type ServerConversation,
  type ServerMessage,
  type ServerTab,
  type SyncResult,
  VALID_MESSAGE_STATUSES,
  VALID_MESSAGE_TYPES,
} from "@/lib/conversations/sync-types"
import { type DbConversation, type DbMessage, type DbMessageContent, type DbTab, getMessageDb } from "./messageDb"
import { syncDexieTabsToLocalStorage } from "./tabSync"

type MessageDb = ReturnType<typeof getMessageDb>

const SYNC_DEBOUNCE_MS = 2000
const INITIAL_RETRY_MS = 5000
const MAX_RETRY_MS = 60000
const BATCH_SIZE = 10
const RECONCILE_CONCURRENCY = 3

function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine
}

function calculateBackoff(lastAttemptAt: number | undefined): number {
  const elapsed = Date.now() - (lastAttemptAt ?? 0)
  return Math.min(INITIAL_RETRY_MS * 2 ** Math.floor(elapsed / INITIAL_RETRY_MS), MAX_RETRY_MS)
}

// ---------------------------------------------------------------------------
// Server → Dexie mappers (null ↔ undefined coercion)
// ---------------------------------------------------------------------------

function serverConvoToDb(convo: ServerConversation): DbConversation {
  const { source, sourceMetadata } = normalizeConversationSourcePayload(convo.source, convo.sourceMetadata)
  return {
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
    source,
    sourceMetadata: sourceMetadata ?? undefined,
    deletedAt: convo.deletedAt ?? undefined,
    archivedAt: convo.archivedAt ?? undefined,
    syncedAt: Date.now(),
    remoteUpdatedAt: convo.updatedAt,
    pendingSync: false,
  }
}

function serverTabToDb(tab: ServerTab): DbTab {
  return {
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
}

function serverMessageToDb(msg: ServerMessage, now: number): DbMessage {
  return {
    id: msg.id,
    tabId: msg.tabId,
    type: VALID_MESSAGE_TYPES.has(msg.type) ? (msg.type as DbMessage["type"]) : "system",
    content: msg.content as DbMessageContent,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
    version: msg.version,
    status: VALID_MESSAGE_STATUSES.has(msg.status) ? (msg.status as DbMessage["status"]) : "complete",
    origin: "remote",
    seq: msg.seq,
    abortedAt: msg.abortedAt ?? undefined,
    errorCode: msg.errorCode ?? undefined,
    syncedAt: now,
    pendingSync: false,
  }
}

// ---------------------------------------------------------------------------
// Debounced sync queue
// ---------------------------------------------------------------------------

let syncTimeout: ReturnType<typeof setTimeout> | null = null
const pendingSyncIds = new Set<string>()

/** Queue a conversation for sync. Calls within SYNC_DEBOUNCE_MS are batched. */
export function queueSync(conversationId: string, userId: string): void {
  pendingSyncIds.add(conversationId)
  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    const ids = Array.from(pendingSyncIds)
    pendingSyncIds.clear()
    pushToServer(ids, userId)
  }, SYNC_DEBOUNCE_MS)
}

/** Immediate sync — use for critical ops (share, delete). */
export function forceSyncNow(conversationId: string, userId: string): void {
  pushToServer([conversationId], userId)
}

// ---------------------------------------------------------------------------
// Push: local → server
// ---------------------------------------------------------------------------

interface PendingData {
  messages: DbMessage[]
  tabs: DbTab[]
}

interface SyncItem {
  conversationId: string
  apiPayload: { conversation: Record<string, unknown>; tabs: Record<string, unknown>[]; messages: Record<string, unknown>[] }
  pending: PendingData
}

async function collectPendingData(db: MessageDb, conversation: DbConversation): Promise<{ item: SyncItem }> {
  const allTabs = await db.tabs.where("conversationId").equals(conversation.id).toArray()
  const tabIds = allTabs.map(t => t.id)

  const pendingMessages = await db.messages
    .where("tabId")
    .anyOf(tabIds)
    .and(m => m.pendingSync === true && m.status !== "streaming")
    .toArray()

  const pendingTabs = allTabs.filter(t => t.pendingSync === true)

  return {
    item: {
      conversationId: conversation.id,
      apiPayload: {
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
          id: t.id, conversationId: t.conversationId, name: t.name,
          position: t.position, messageCount: t.messageCount ?? 0,
          lastMessageAt: t.lastMessageAt ?? null, createdAt: t.createdAt,
          closedAt: t.closedAt ?? null, draft: t.draft ?? null,
        })),
        messages: pendingMessages.map(m => ({
          id: m.id, tabId: m.tabId, type: m.type, content: m.content,
          version: m.version, status: m.status, seq: m.seq,
          abortedAt: m.abortedAt ?? null, errorCode: m.errorCode ?? null,
          createdAt: m.createdAt, updatedAt: m.updatedAt,
        })),
      },
      pending: { messages: pendingMessages, tabs: pendingTabs },
    },
  }
}

async function markSynced(db: MessageDb, item: SyncItem): Promise<void> {
  const now = Date.now()
  if (item.pending.messages.length > 0) {
    await db.messages.bulkPut(item.pending.messages.map(m => ({ ...m, syncedAt: now, pendingSync: false })))
  }
  if (item.pending.tabs.length > 0) {
    await db.tabs.bulkPut(item.pending.tabs.map(t => ({ ...t, syncedAt: now, pendingSync: false })))
  }
  await db.conversations.update(item.conversationId, {
    syncedAt: now,
    remoteUpdatedAt: (item.apiPayload.conversation as { updatedAt: number }).updatedAt,
    pendingSync: false,
    lastSyncError: undefined,
    lastSyncAttemptAt: undefined,
    nextRetryAt: undefined,
  })
}

async function markFailed(db: MessageDb, conversationId: string, error: unknown): Promise<void> {
  const now = Date.now()
  const conv = await db.conversations.get(conversationId)
  const backoff = calculateBackoff(conv?.lastSyncAttemptAt)
  await db.conversations.update(conversationId, {
    lastSyncError: error instanceof Error ? error.message : String(error),
    lastSyncAttemptAt: now,
    nextRetryAt: now + backoff,
  })
}

async function handleConflict(db: MessageDb, conflict: ConflictInfo, userId: string): Promise<void> {
  logError("sync", `Conflict for ${conflict.conversationId}`, {
    local: new Date(conflict.localUpdatedAt).toISOString(),
    server: new Date(conflict.serverUpdatedAt).toISOString(),
  })

  await db.conversations.update(conflict.conversationId, {
    pendingSync: false,
    lastSyncError: undefined,
    remoteUpdatedAt: undefined,
  })

  // Re-queue if stranded pending data exists
  const hasPending = await hasPendingDataForConversation(db, conflict.conversationId)
  if (hasPending) {
    await db.conversations.update(conflict.conversationId, {
      pendingSync: true,
      lastSyncError: "Conflict resolved, retrying",
      nextRetryAt: Date.now() + INITIAL_RETRY_MS,
    })
    setTimeout(() => queueSync(conflict.conversationId, userId), INITIAL_RETRY_MS)
  }
}

async function hasPendingDataForConversation(db: MessageDb, conversationId: string): Promise<boolean> {
  const tabs = await db.tabs.where("conversationId").equals(conversationId).toArray()
  if (tabs.some(t => t.pendingSync === true)) return true
  const tabIds = tabs.map(t => t.id)
  if (tabIds.length === 0) return false
  return (
    (await db.messages
      .where("tabId")
      .anyOf(tabIds)
      .and(m => m.pendingSync === true && m.status !== "streaming")
      .count()) > 0
  )
}

async function pushToServer(conversationIds: string[], userId: string): Promise<void> {
  if (isOffline()) return

  const db = getMessageDb(userId)
  const items: SyncItem[] = []

  for (const id of conversationIds) {
    const conversation = await db.conversations.get(id)
    if (!conversation) continue
    const { item } = await collectPendingData(db, conversation)
    items.push(item)
  }

  if (items.length === 0) return

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    await pushBatch(db, items.slice(i, i + BATCH_SIZE), userId)
  }
}

async function pushBatch(db: MessageDb, batch: SyncItem[], userId: string): Promise<void> {
  try {
    const response = await fetch("/api/conversations/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversations: batch.map(b => b.apiPayload),
      }),
      credentials: "include",
    })

    const result: SyncResult = await response.json()

    if (result.conflicts) {
      for (const conflict of result.conflicts) {
        await handleConflict(db, conflict, userId)
      }
    }

    for (const item of batch) {
      if (result.conflicts?.some(c => c.conversationId === item.conversationId)) continue

      const matchedError = result.errors?.find(e => e.includes(item.conversationId))
      if (matchedError) {
        await db.conversations.update(item.conversationId, {
          lastSyncError: matchedError,
          lastSyncAttemptAt: Date.now(),
        })
        continue
      }

      await markSynced(db, item)
    }
  } catch (error) {
    for (const item of batch) {
      await markFailed(db, item.conversationId, error)
    }
    logError("sync", "Batch sync failed", {
      error: error instanceof Error ? error : undefined,
      conversationIds: batch.map(b => b.conversationId),
    })
  }
}

// ---------------------------------------------------------------------------
// Pull: server → local
// ---------------------------------------------------------------------------

/** Full workspace sync: metadata + orphan drain + message reconciliation. */
export async function syncFromServer(
  workspace: string,
  userId: string,
  orgId: string,
): Promise<{ conversations: number; tabs: number; isOffline: boolean }> {
  if (isOffline()) return { conversations: 0, tabs: 0, isOffline: true }

  await fetchConversations(userId, orgId, workspace)
  await drainOrphanedPendingData(userId, workspace)
  await reconcileMessageCounts(userId, workspace)

  const db = getMessageDb(userId)
  const conversations = await db.conversations.where("workspace").equals(workspace).count()
  const tabs = await db.tabs.count()
  return { conversations, tabs, isOffline: false }
}

/** Fetch conversation + tab metadata (NOT messages — those are lazy-loaded). */
export async function fetchConversations(
  userId: string,
  _orgId: string,
  workspace?: string,
  cursor?: string,
): Promise<{ hasMore: boolean; nextCursor: string | null }> {
  if (isOffline()) return { hasMore: false, nextCursor: null }

  try {
    const url = new URL("/api/conversations", window.location.origin)
    if (workspace) url.searchParams.set("workspace", workspace)
    if (cursor) url.searchParams.set("cursor", cursor)

    const response = await fetch(url.toString(), { credentials: "include" })
    if (!response.ok) {
      logError("sync", "Fetch conversations failed", { status: response.status, workspace })
      return { hasMore: false, nextCursor: null }
    }

    const { own, shared, hasMore, nextCursor: responseCursor }: ConversationsResponse = await response.json()
    const db = getMessageDb(userId)

    const tabsByWorkspace = new Map<string, { tabs: DbTab[]; conversations: Array<{ id: string; title: string }> }>()

    for (const convo of [...own, ...shared]) {
      const local = await db.conversations.get(convo.id)
      if (local?.pendingSync) continue

      const ws = convo.workspace
      if (!tabsByWorkspace.has(ws)) tabsByWorkspace.set(ws, { tabs: [], conversations: [] })
      const wsGroup = tabsByWorkspace.get(ws)!
      wsGroup.conversations.push({ id: convo.id, title: convo.title })

      await db.conversations.put(serverConvoToDb(convo))

      for (const tab of convo.tabs || []) {
        const localTab = await db.tabs.get(tab.id)
        if (localTab?.pendingSync) continue
        const dbTab = serverTabToDb(tab)
        await db.tabs.put(dbTab)
        wsGroup.tabs.push(dbTab)
      }
    }

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

// In-flight deduplication for fetchTabMessages
const tabMessageFetches = new Map<string, Promise<{ messages: DbMessage[]; hasMore: boolean }>>()

/** Fetch messages for a tab (lazy loading, deduplicated). */
export function fetchTabMessages(
  tabId: string,
  userId: string,
  cursor?: string,
): Promise<{ messages: DbMessage[]; hasMore: boolean }> {
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
  const getLocal = () =>
    db.messages.where("[tabId+seq]").between([tabId, Dexie.minKey], [tabId, Dexie.maxKey]).toArray()

  const localMessages = await getLocal()
  if (isOffline()) return { messages: localMessages, hasMore: false }

  try {
    const url = new URL("/api/conversations/messages", window.location.origin)
    url.searchParams.set("tabId", tabId)
    if (cursor) url.searchParams.set("cursor", cursor)

    const response = await fetch(url.toString(), { credentials: "include" })
    if (!response.ok) {
      logError("sync", "Fetch tab messages failed", { status: response.status, tabId })
      if (response.status === 404) await requeueUnsyncedTab(db, tabId, localMessages, userId)
      return { messages: localMessages, hasMore: false }
    }

    const { messages: serverMessages, hasMore }: MessagesResponse = await response.json()
    const now = Date.now()

    await db.transaction("rw", [db.messages, db.tabs], async () => {
      const pendingIds = new Set<string>()
      for (const msg of serverMessages) {
        const local = await db.messages.get(msg.id)
        if (local?.pendingSync) pendingIds.add(msg.id)
      }

      const toInsert = serverMessages
        .filter(msg => !pendingIds.has(msg.id))
        .map(msg => serverMessageToDb(msg, now))

      if (toInsert.length > 0) await db.messages.bulkPut(toInsert)

      const merged = await getLocal()
      const lastMsg = merged.reduce<DbMessage | null>(
        (latest, m) => (!latest || m.createdAt > latest.createdAt ? m : latest),
        null,
      )
      await db.tabs.update(tabId, {
        messageCount: merged.length,
        lastMessageAt: lastMsg?.createdAt,
      })
    })

    return { messages: await getLocal(), hasMore }
  } catch (error) {
    logError("sync", "Failed to fetch tab messages", {
      error: error instanceof Error ? error : undefined,
      tabId,
    })
    return { messages: localMessages, hasMore: false }
  }
}

/** Server 404'd a tab but we have pending local messages — re-queue. */
async function requeueUnsyncedTab(
  db: MessageDb,
  tabId: string,
  localMessages: DbMessage[],
  userId: string,
): Promise<void> {
  if (!localMessages.some(m => m.pendingSync)) return

  const tab = await db.tabs.get(tabId)
  if (!tab) return

  await db.conversations.update(tab.conversationId, { pendingSync: true })
  queueSync(tab.conversationId, userId)
  logError("sync", `Tab ${tabId} unsynced with pending messages, re-queued`, {})
}

// ---------------------------------------------------------------------------
// Orphan drain & message count reconciliation
// ---------------------------------------------------------------------------

/** Re-queue conversations with pending messages/tabs not marked for sync. */
async function drainOrphanedPendingData(userId: string, workspace: string): Promise<void> {
  const db = getMessageDb(userId)

  // Collect conversation IDs from BOTH pending messages and pending tabs
  const conversationIds = new Set<string>()

  const pendingMessages = await db.messages.where("pendingSync").equals(1).toArray()
  if (pendingMessages.length > 0) {
    const tabIds = Array.from(new Set(pendingMessages.map(m => m.tabId)))
    const tabs = await db.tabs.where("id").anyOf(tabIds).toArray()
    for (const t of tabs) conversationIds.add(t.conversationId)
  }

  const pendingTabs = await db.tabs.where("pendingSync").equals(1).toArray()
  for (const t of pendingTabs) conversationIds.add(t.conversationId)

  if (conversationIds.size === 0) return

  let requeued = 0
  for (const convId of conversationIds) {
    const conv = await db.conversations.get(convId)
    if (!conv || conv.workspace !== workspace || conv.pendingSync) continue

    await db.conversations.update(convId, { pendingSync: true })
    queueSync(convId, userId)
    requeued++
  }

  if (requeued > 0) {
    console.info(`[sync] Drained ${requeued} orphaned conversations (${workspace})`)
  }
}

/** Fetch messages for tabs where server count > local count. */
async function reconcileMessageCounts(userId: string, workspace: string): Promise<void> {
  const db = getMessageDb(userId)

  const conversations = await db.conversations.where("workspace").equals(workspace).toArray()
  if (conversations.length === 0) return

  const tabs = await db.tabs.where("conversationId").anyOf(conversations.map(c => c.id)).toArray()

  const tabsToFetch: string[] = []
  for (const tab of tabs) {
    const serverCount = tab.messageCount ?? 0
    if (serverCount === 0) continue
    const localCount = await db.messages.where("tabId").equals(tab.id).count()
    if (serverCount > localCount) tabsToFetch.push(tab.id)
  }

  if (tabsToFetch.length === 0) return

  for (let i = 0; i < tabsToFetch.length; i += RECONCILE_CONCURRENCY) {
    await Promise.all(tabsToFetch.slice(i, i + RECONCILE_CONCURRENCY).map(id => fetchTabMessages(id, userId)))
  }

  console.info(`[sync] Reconciled ${tabsToFetch.length} tabs (${workspace})`)
}

// ---------------------------------------------------------------------------
// Conversation mutations
// ---------------------------------------------------------------------------

async function updateAndSync(
  conversationId: string,
  userId: string,
  fields: Partial<DbConversation>,
  immediate: boolean,
): Promise<void> {
  const db = getMessageDb(userId)
  await db.conversations.update(conversationId, {
    ...fields,
    updatedAt: Date.now(),
    pendingSync: true,
  })
  if (immediate) forceSyncNow(conversationId, userId)
  else queueSync(conversationId, userId)
}

export function shareConversation(conversationId: string, userId: string): Promise<void> {
  return updateAndSync(conversationId, userId, { visibility: "shared" }, true)
}

export function unshareConversation(conversationId: string, userId: string): Promise<void> {
  return updateAndSync(conversationId, userId, { visibility: "private" }, true)
}

export function archiveConversation(conversationId: string, userId: string): Promise<void> {
  return updateAndSync(conversationId, userId, { archivedAt: Date.now() }, true)
}

export function deleteConversation(conversationId: string, userId: string): Promise<void> {
  return updateAndSync(conversationId, userId, { deletedAt: Date.now() }, true)
}

export async function unarchiveConversation(conversationId: string, userId: string): Promise<void> {
  const db = getMessageDb(userId)
  const conversation = await db.conversations.get(conversationId)
  if (!conversation) return

  // Dexie can't set a field to undefined via update(), so read-modify-write
  const { archivedAt: _, ...rest } = conversation
  await db.conversations.put({ ...rest, updatedAt: Date.now(), pendingSync: true })
  forceSyncNow(conversationId, userId)
}

export async function renameConversation(conversationId: string, userId: string, title: string): Promise<void> {
  const trimmed = title.trim()
  return updateAndSync(conversationId, userId, {
    title: trimmed.length > 0 ? trimmed : "Untitled",
    autoTitleSet: true,
  }, false)
}
