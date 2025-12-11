# Plan Part 3: Implementation

Sync service, React hooks, Zustand store, and migration code.

## Phase 1: Dependencies

```bash
cd apps/web && bun add dexie dexie-react-hooks
```

## Phase 2: Conversation Service Layer

**IMPORTANT**: All conversation operations go through this single service layer. Do NOT call Dexie or Supabase directly from stores or components.

**File: `apps/web/lib/conversations/service.ts`**

```typescript
"use client"

// This is the ONLY layer that should touch Dexie and Supabase for conversations.
// Stores and hooks call this service, never the DB directly.

export const conversationService = {
  createConversation,
  addMessage,
  addTab,
  renameTab,
  deleteConversation,  // Soft delete only!
  shareConversation,
  unshareConversation,
  syncFromServer,
  fetchTabMessages,    // Lazy loading per tab
}

// Implementation in files below
```

## Phase 3: Sync Service

**File: `apps/web/lib/db/conversationSync.ts`**

```typescript
"use client"

import { getMessageDb, CURRENT_MESSAGE_VERSION, type DbConversation, type DbMessage, type DbTab } from "./messageDb"
import { safeDb } from "./safeDb"
import { createClient } from "@/lib/supabase/client"

// IMPORTANT: Supabase client is configured with schema "app"
// The table names here ("conversations", "messages", "conversation_tabs")
// refer to app.conversations etc. Do NOT change without updating migrations.

// Debounce sync to avoid hammering the server
const SYNC_DEBOUNCE_MS = 2000
let syncTimeout: ReturnType<typeof setTimeout> | null = null
let pendingSyncConversationIds = new Set<string>()

// Offline retry config
const INITIAL_RETRY_MS = 5000
const MAX_RETRY_MS = 60000

/**
 * Queue a conversation for sync (debounced)
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

// Listen for online events to retry failed syncs
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    // TODO: Re-sync any conversations with pendingSync=true and nextRetryAt <= now
    console.log("[sync] Online - checking for pending syncs")
  })
}

/**
 * Sync conversations to server
 * Uses bulkPut (not bulkUpdate - that's not standard Dexie API!)
 */
async function syncConversations(conversationIds: string[], userId: string): Promise<void> {
  const supabase = createClient()
  const db = getMessageDb(userId)

  for (const id of conversationIds) {
    try {
      const conversation = await db.conversations.get(id)
      if (!conversation) continue

      // Upsert conversation (includes new metadata fields)
      await supabase.from("conversations").upsert({
        id: conversation.id,
        workspace: conversation.workspace,
        org_id: conversation.orgId,
        creator_id: conversation.creatorId,
        title: conversation.title,
        visibility: conversation.visibility,
        created_at: new Date(conversation.createdAt).toISOString(),
        updated_at: new Date(conversation.updatedAt).toISOString(),
        // Metadata
        message_count: conversation.messageCount ?? 0,
        last_message_at: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toISOString() : null,
        first_user_message_id: conversation.firstUserMessageId ?? null,
        auto_title_set: conversation.autoTitleSet ?? false,
        // Soft delete
        deleted_at: conversation.deletedAt ? new Date(conversation.deletedAt).toISOString() : null,
        archived_at: conversation.archivedAt ? new Date(conversation.archivedAt).toISOString() : null,
      })

      // Get all tabs for this conversation
      const tabs = await db.tabs
        .where("conversationId")
        .equals(id)
        .toArray()

      // Get pending messages for all tabs in this conversation
      // Only sync messages that are NOT streaming
      const tabIds = tabs.map(t => t.id)
      const pendingMessages = await db.messages
        .where("tabId")
        .anyOf(tabIds)
        .and(m => m.pendingSync === true && m.status !== "streaming")
        .toArray()

      if (pendingMessages.length > 0) {
        await supabase.from("messages").upsert(
          pendingMessages.map(m => ({
            id: m.id,
            tab_id: m.tabId,
            type: m.type,
            content: m.content,
            created_at: new Date(m.createdAt).toISOString(),
            updated_at: new Date(m.updatedAt).toISOString(),
            status: m.status,
            aborted_at: m.abortedAt ? new Date(m.abortedAt).toISOString() : null,
            error_code: m.errorCode ?? null,
            origin: m.origin,
          }))
        )

        // Mark as synced using bulkPut (NOT bulkUpdate - that doesn't exist!)
        const now = Date.now()
        await db.messages.bulkPut(
          pendingMessages.map(m => ({
            ...m,
            syncedAt: now,
            pendingSync: false,
          }))
        )
      }

      // Get pending tabs
      const pendingTabs = await db.tabs
        .where("conversationId")
        .equals(id)
        .and(t => t.pendingSync === true)
        .toArray()

      if (pendingTabs.length > 0) {
        await supabase.from("conversation_tabs").upsert(
          pendingTabs.map(t => ({
            id: t.id,
            conversation_id: t.conversationId,
            name: t.name,
            position: t.position,
            created_at: new Date(t.createdAt).toISOString(),
            message_count: t.messageCount ?? 0,
            last_message_at: t.lastMessageAt ? new Date(t.lastMessageAt).toISOString() : null,
          }))
        )

        // Mark as synced using bulkPut
        const now = Date.now()
        await db.tabs.bulkPut(
          pendingTabs.map(t => ({
            ...t,
            syncedAt: now,
            pendingSync: false,
          }))
        )
      }

      // Mark conversation as synced, clear retry state
      await db.conversations.update(id, {
        syncedAt: Date.now(),
        pendingSync: false,
        lastSyncError: undefined,
        lastSyncAttemptAt: undefined,
        nextRetryAt: undefined,
      })
    } catch (error) {
      // Set exponential backoff retry
      const conversation = await db.conversations.get(id)
      const lastAttempt = conversation?.lastSyncAttemptAt ?? 0
      const timeSinceLastAttempt = Date.now() - lastAttempt
      const backoff = Math.min(INITIAL_RETRY_MS * Math.pow(2, Math.floor(timeSinceLastAttempt / INITIAL_RETRY_MS)), MAX_RETRY_MS)

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

/**
 * Fetch user's conversations from server (initial load + refresh)
 *
 * CRITICAL: This fetches METADATA ONLY, not messages!
 * Messages are loaded lazily per-tab via fetchTabMessages.
 * Loading all messages for all conversations would be catastrophic at scale.
 */
export async function fetchConversations(
  workspace: string,
  userId: string,
  orgId: string,
): Promise<void> {
  const supabase = createClient()
  const db = getMessageDb(userId)

  // Fetch user's own conversations for this workspace
  // METADATA ONLY - no messages! (see fetchTabMessages for that)
  const { data: ownConversations } = await supabase
    .from("conversations")
    .select(`
      id, workspace, org_id, creator_id, title, visibility,
      created_at, updated_at, message_count, last_message_at,
      first_user_message_id, auto_title_set, deleted_at, archived_at,
      conversation_tabs(id, conversation_id, name, position, created_at, message_count, last_message_at)
    `)
    .eq("workspace", workspace)
    .eq("creator_id", userId)
    .is("deleted_at", null)  // Exclude soft-deleted
    .order("updated_at", { ascending: false })

  // Fetch shared conversations for this workspace
  const { data: sharedConversations } = await supabase
    .from("conversations")
    .select(`
      id, workspace, org_id, creator_id, title, visibility,
      created_at, updated_at, message_count, last_message_at,
      first_user_message_id, auto_title_set, deleted_at, archived_at,
      conversation_tabs(id, conversation_id, name, position, created_at, message_count, last_message_at)
    `)
    .eq("workspace", workspace)
    .eq("org_id", orgId)
    .eq("visibility", "shared")
    .neq("creator_id", userId) // Exclude own (already fetched)
    .is("deleted_at", null)  // Exclude soft-deleted
    .order("updated_at", { ascending: false })

  const allConversations = [...(ownConversations || []), ...(sharedConversations || [])]

  // Upsert to local DB (conversations and tabs only, NOT messages)
  await db.transaction("rw", [db.conversations, db.tabs], async () => {
    for (const c of allConversations) {
      const remoteUpdatedAt = new Date(c.updated_at).getTime()

      await db.conversations.put({
        id: c.id,
        workspace: c.workspace,
        orgId: c.org_id,
        creatorId: c.creator_id,
        title: c.title,
        visibility: c.visibility,
        createdAt: new Date(c.created_at).getTime(),
        updatedAt: remoteUpdatedAt,
        // Metadata
        messageCount: c.message_count ?? 0,
        lastMessageAt: c.last_message_at ? new Date(c.last_message_at).getTime() : undefined,
        firstUserMessageId: c.first_user_message_id ?? undefined,
        autoTitleSet: c.auto_title_set ?? false,
        // Soft delete
        deletedAt: c.deleted_at ? new Date(c.deleted_at).getTime() : undefined,
        archivedAt: c.archived_at ? new Date(c.archived_at).getTime() : undefined,
        // Sync metadata
        syncedAt: Date.now(),
        remoteUpdatedAt,  // For conflict detection
        pendingSync: false,
      })

      // Tabs (metadata only)
      for (const t of c.conversation_tabs || []) {
        await db.tabs.put({
          id: t.id,
          conversationId: t.conversation_id,
          name: t.name,
          position: t.position,
          createdAt: new Date(t.created_at).getTime(),
          messageCount: t.message_count ?? 0,
          lastMessageAt: t.last_message_at ? new Date(t.last_message_at).getTime() : undefined,
          syncedAt: Date.now(),
          pendingSync: false,
        })
      }
    }
  })
}

/**
 * Fetch messages for a specific tab (lazy loading)
 * Call this when user opens a conversation/tab
 */
export async function fetchTabMessages(
  tabId: string,
  userId: string,
  cursor?: string,  // ISO timestamp for pagination
): Promise<{ messages: DbMessage[]; hasMore: boolean }> {
  const supabase = createClient()
  const db = getMessageDb(userId)
  const PAGE_SIZE = 100

  let query = supabase
    .from("messages")
    .select("*")
    .eq("tab_id", tabId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1)  // Fetch one extra to check hasMore

  if (cursor) {
    query = query.lt("created_at", cursor)
  }

  const { data: messages } = await query
  const hasMore = (messages?.length ?? 0) > PAGE_SIZE
  const messagesToStore = hasMore ? messages?.slice(0, PAGE_SIZE) : messages

  // Store in Dexie
  if (messagesToStore && messagesToStore.length > 0) {
    await db.transaction("rw", [db.messages], async () => {
      for (const m of messagesToStore) {
        const createdAt = new Date(m.created_at).getTime()
        await db.messages.put({
          id: m.id,
          tabId: m.tab_id,
          type: m.type,
          content: m.content,
          createdAt,
          updatedAt: new Date(m.updated_at).getTime(),
          version: CURRENT_MESSAGE_VERSION,
          status: m.status ?? "complete",
          origin: "remote",  // Came from server
          abortedAt: m.aborted_at ? new Date(m.aborted_at).getTime() : undefined,
          errorCode: m.error_code ?? undefined,
          syncedAt: Date.now(),
          pendingSync: false,
        })
      }
    })
  }

  return {
    messages: messagesToStore ?? [],
    hasMore,
  }
}

/**
 * Share a conversation with the organization
 */
export async function shareConversation(conversationId: string, userId: string): Promise<void> {
  const db = getMessageDb(userId)
  await db.conversations.update(conversationId, {
    visibility: "shared",
    updatedAt: Date.now(),
    pendingSync: true,
  })
  queueSync(conversationId, userId)
}

/**
 * Make a conversation private again
 */
export async function unshareConversation(conversationId: string, userId: string): Promise<void> {
  const db = getMessageDb(userId)
  await db.conversations.update(conversationId, {
    visibility: "private",
    updatedAt: Date.now(),
    pendingSync: true,
  })
  queueSync(conversationId, userId)
}

/**
 * Soft delete a conversation (NEVER hard delete!)
 */
export async function deleteConversation(conversationId: string, userId: string): Promise<void> {
  const db = getMessageDb(userId)
  await db.conversations.update(conversationId, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
    pendingSync: true,
  })
  queueSync(conversationId, userId)

  // Also update server immediately
  const supabase = createClient()
  await supabase.from("conversations").update({
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", conversationId)
}

/**
 * Subscribe to realtime updates for shared conversations
 * Call this when entering a workspace
 */
export function subscribeToSharedConversations(
  workspace: string,
  orgId: string,
  userId: string,
  onMessage: (message: DbMessage) => void
): () => void {
  const supabase = createClient()

  const channel = supabase
    .channel(`workspace:${workspace}:org:${orgId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'app',
      table: 'messages',
      // Note: We filter client-side since RLS handles security
    }, payload => {
      const m = payload.new as any
      onMessage({
        id: m.id,
        tabId: m.tab_id,
        type: m.type,
        content: m.content,
        createdAt: new Date(m.created_at).getTime(),
        updatedAt: new Date(m.updated_at).getTime(),
        version: CURRENT_MESSAGE_VERSION,
        status: m.status ?? "complete",
        origin: "remote",
        syncedAt: Date.now(),
        pendingSync: false,
      })
    })
    .subscribe()

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}
```

## Phase 4: React Hooks

**File: `apps/web/lib/db/useMessageDb.ts`**

```typescript
"use client"

import Dexie from "dexie"
import { useLiveQuery } from "dexie-react-hooks"
import { getMessageDb, type DbConversation } from "./messageDb"

// Session context type - REQUIRED for all conversation operations
export interface SessionContext {
  userId: string
  orgId: string
}

/**
 * Get conversations for a workspace (user's own + shared)
 * Uses composite index for performance
 *
 * CRITICAL: Must filter by BOTH creatorId AND orgId for shared conversations
 * to prevent leaking other orgs' data from local cache
 */
export function useConversations(
  workspace: string | null,
  session: SessionContext | null
) {
  return useLiveQuery(
    async () => {
      if (!workspace || !session?.userId || !session?.orgId) return []

      const db = getMessageDb(session.userId)

      // Use composite index [workspace+updatedAt] for efficient sorted query
      return db.conversations
        .where("[workspace+updatedAt]")
        .between([workspace, Dexie.minKey], [workspace, Dexie.maxKey])
        // CRITICAL: Filter by org for shared conversations to prevent data leak
        .and(c =>
          !c.deletedAt && (  // Exclude soft-deleted
            c.creatorId === session.userId ||
            (c.visibility === "shared" && c.orgId === session.orgId)
          )
        )
        .reverse()
        .toArray()
    },
    [workspace, session?.userId, session?.orgId],
    []
  )
}

/**
 * Get only shared conversations for a workspace (team view)
 * Uses composite index for performance
 */
export function useSharedConversations(
  workspace: string | null,
  session: SessionContext | null
) {
  return useLiveQuery(
    async () => {
      if (!workspace || !session?.userId || !session?.orgId) return []

      const db = getMessageDb(session.userId)

      // Use composite index [orgId+visibility+updatedAt]
      return db.conversations
        .where("[orgId+visibility+updatedAt]")
        .between([session.orgId, "shared", Dexie.minKey], [session.orgId, "shared", Dexie.maxKey])
        .and(c => !c.deletedAt)  // Exclude soft-deleted
        .reverse()
        .toArray()
    },
    [workspace, session?.userId, session?.orgId],
    []
  )
}

/**
 * Get messages for a tab (messages belong to tabs, not conversations)
 * Uses composite index for performance
 */
export function useMessages(tabId: string | null, userId: string | null) {
  return useLiveQuery(
    async () => {
      if (!tabId || !userId) return []

      const db = getMessageDb(userId)

      // Use composite index [tabId+createdAt]
      return db.messages
        .where("[tabId+createdAt]")
        .between([tabId, Dexie.minKey], [tabId, Dexie.maxKey])
        .toArray()
    },
    [tabId, userId],
    []
  )
}

/**
 * Get tabs for a conversation
 * Uses composite index for performance
 */
export function useTabs(conversationId: string | null, userId: string | null) {
  return useLiveQuery(
    async () => {
      if (!conversationId || !userId) return []

      const db = getMessageDb(userId)

      // Use composite index [conversationId+position]
      return db.tabs
        .where("[conversationId+position]")
        .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
        .toArray()
    },
    [conversationId, userId],
    []
  )
}

/**
 * Get a single conversation
 */
export function useConversation(id: string | null, userId: string | null) {
  return useLiveQuery(
    async () => {
      if (!id || !userId) return null
      const db = getMessageDb(userId)
      return db.conversations.get(id) ?? null
    },
    [id, userId],
    null
  )
}

/**
 * Safe hook for current conversation - handles cross-tab deletion
 * USE THIS instead of raw useConversation + useCurrentConversationId
 */
export function useCurrentConversationSafe(
  currentConversationId: string | null,
  userId: string | null,
  clearCurrentConversation: () => void
) {
  const conversation = useConversation(currentConversationId, userId)

  // Handle cross-tab deletion
  if (currentConversationId && conversation === null) {
    clearCurrentConversation()
  }

  return conversation
}
```

## Phase 5: Message Store (Rewrite)

**File: `apps/web/lib/stores/messageStore.ts`**

> **Note:** Streaming lifecycle actions (`startAssistantStream`, `appendToAssistantStream`, etc.) are documented in [Part 4: Streaming](./four-dexie-streaming-integration.md). This phase covers the core store structure.

**IMPORTANT**: The store delegates to the conversation service layer. It does NOT call Dexie directly for most operations.

```typescript
"use client"

import { create } from "zustand"
import { getMessageDb, CURRENT_MESSAGE_VERSION, type DbConversation, type DbMessage, type DbTab } from "@/lib/db/messageDb"
import { safeDb } from "@/lib/db/safeDb"
import {
  queueSync,
  fetchConversations,
  fetchTabMessages,
  shareConversation as syncShareConversation,
  unshareConversation as syncUnshareConversation,
  deleteConversation as syncDeleteConversation,
} from "@/lib/db/conversationSync"
import { toDbMessageContent, extractTitle } from "@/lib/db/messageAdapters"
import type { UIMessage } from "@/features/chat/lib/message-parser"

const generateId = () => crypto.randomUUID()

interface MessageStoreState {
  // Session context - REQUIRED for all operations
  session: { userId: string; orgId: string } | null
  currentConversationId: string | null
  currentTabId: string | null
  currentWorkspace: string | null
  isLoading: boolean
  isSyncing: boolean

  // Streaming state (per-tab, in-memory only - NOT persisted)
  // IMPORTANT: These are NEVER stored in Dexie - they are ephemeral
  // See Part 4 for streaming lifecycle actions
  activeStreamByTab: Record<string, string | null>  // tabId -> streaming messageId
  streamingBuffers: Record<string, string>          // messageId -> current text
}

interface MessageStoreActions {
  // Session management
  setSession: (session: { userId: string; orgId: string }) => void

  // Conversation management
  initializeConversation: (workspace: string) => Promise<string>
  switchConversation: (id: string, tabId?: string) => void
  deleteConversation: (id: string) => Promise<void>  // Soft delete only!
  shareConversation: (id: string) => Promise<void>
  unshareConversation: (id: string) => Promise<void>

  // Message management (messages belong to tabs)
  addMessage: (message: UIMessage) => Promise<void>

  // Tab management
  addTab: (name?: string) => Promise<string>
  switchTab: (tabId: string) => void
  removeTab: (tabId: string) => Promise<void>
  renameTab: (tabId: string, name: string) => Promise<void>

  // Sync
  syncFromServer: (workspace: string) => Promise<void>
  loadTabMessages: (tabId: string) => Promise<void>  // Lazy load

  // Cleanup
  clearCurrentConversation: () => void
}

type MessageStore = MessageStoreState & MessageStoreActions

export const useMessageStore = create<MessageStore>((set, get) => ({
  session: null,
  currentConversationId: null,
  currentTabId: null,
  currentWorkspace: null,
  isLoading: false,
  isSyncing: false,
  activeStreamByTab: {},
  streamingBuffers: {},

  setSession: (session) => {
    set({ session })
  },

  initializeConversation: async (workspace) => {
    const { session } = get()
    if (!session) throw new Error("No session - call setSession first")

    const db = getMessageDb(session.userId)
    const id = generateId()
    const now = Date.now()

    const newConvo: DbConversation = {
      id,
      workspace,
      orgId: session.orgId,
      creatorId: session.userId,
      title: "New conversation",
      visibility: "private",
      createdAt: now,
      updatedAt: now,
      // Initialize metadata
      messageCount: 0,
      autoTitleSet: false,
      pendingSync: true,
    }

    // Create default tab
    const defaultTabId = generateId()
    const defaultTab: DbTab = {
      id: defaultTabId,
      conversationId: id,
      name: "current",
      position: 0,
      createdAt: now,
      messageCount: 0,
      pendingSync: true,
    }

    await safeDb(() => db.transaction("rw", [db.conversations, db.tabs], async () => {
      await db.conversations.add(newConvo)
      await db.tabs.add(defaultTab)
    }))

    set({
      currentConversationId: id,
      currentTabId: defaultTabId,
      currentWorkspace: workspace,
    })

    queueSync(id, session.userId)
    return id
  },

  switchConversation: (id, tabId) => {
    set({
      currentConversationId: id,
      currentTabId: tabId ?? null,
    })
  },

  // CRITICAL FIX: Soft delete only, and delete messages via tabs (not conversationId)
  deleteConversation: async (id) => {
    const { currentConversationId, session } = get()
    if (!session) {
      console.warn("[messages] deleteConversation called without session")
      return
    }

    // Use the sync service for soft delete
    await syncDeleteConversation(id, session.userId)

    if (currentConversationId === id) {
      set({ currentConversationId: null, currentTabId: null })
    }
  },

  shareConversation: async (id) => {
    const { session } = get()
    if (!session) return
    await syncShareConversation(id, session.userId)
  },

  unshareConversation: async (id) => {
    const { session } = get()
    if (!session) return
    await syncUnshareConversation(id, session.userId)
  },

  addMessage: async (message) => {
    const { currentConversationId, currentTabId, session } = get()

    // Invariant checks - fail early and loudly
    if (!session) {
      console.warn("[messages] addMessage called without session")
      return
    }
    if (!currentConversationId) {
      console.warn("[messages] addMessage called with no currentConversationId")
      return
    }
    if (!currentTabId) {
      console.warn("[messages] addMessage called with no currentTabId")
      return
    }

    const db = getMessageDb(session.userId)
    const now = Date.now()

    const dbMessage: DbMessage = {
      id: message.id,
      tabId: currentTabId,  // Messages belong to tabs, NOT conversations
      type: message.type,
      content: toDbMessageContent(message),
      createdAt: now,
      updatedAt: now,
      version: CURRENT_MESSAGE_VERSION,
      status: "complete",
      origin: "local",
      pendingSync: true,
    }

    await safeDb(() => db.messages.add(dbMessage))

    // Update conversation metadata (efficient - no scanning)
    const convo = await db.conversations.get(currentConversationId)
    if (!convo) return

    const updates: Partial<DbConversation> = {
      updatedAt: now,
      lastMessageAt: now,
      messageCount: (convo.messageCount ?? 0) + 1,
      pendingSync: true,
    }

    // Update title on first user message (using autoTitleSet flag - no scanning!)
    if (message.type === "user" && !convo.autoTitleSet) {
      updates.title = extractTitle(dbMessage.content)
      updates.firstUserMessageId = dbMessage.id
      updates.autoTitleSet = true
    }

    await safeDb(() => db.conversations.update(currentConversationId, updates))

    // Update tab metadata
    const tab = await db.tabs.get(currentTabId)
    if (tab) {
      await safeDb(() => db.tabs.update(currentTabId, {
        lastMessageAt: now,
        messageCount: (tab.messageCount ?? 0) + 1,
        pendingSync: true,
      }))
    }

    queueSync(currentConversationId, session.userId)
  },

  addTab: async (name = "new tab") => {
    const { currentConversationId, session } = get()
    if (!session) throw new Error("No session")
    if (!currentConversationId) throw new Error("No active conversation")

    const db = getMessageDb(session.userId)

    const existingTabs = await db.tabs
      .where("conversationId")
      .equals(currentConversationId)
      .toArray()

    const newTab: DbTab = {
      id: generateId(),
      conversationId: currentConversationId,
      name,
      position: existingTabs.length,
      createdAt: Date.now(),
      messageCount: 0,
      pendingSync: true,
    }

    await safeDb(() => db.tabs.add(newTab))
    queueSync(currentConversationId, session.userId)
    return newTab.id
  },

  switchTab: (tabId) => {
    set({ currentTabId: tabId })
  },

  removeTab: async (tabId) => {
    const { session } = get()
    if (!session) return

    const db = getMessageDb(session.userId)
    const tab = await db.tabs.get(tabId)
    if (!tab) return

    // Delete messages first (via tabId, NOT conversationId!)
    await safeDb(() => db.messages.where("tabId").equals(tabId).delete())
    await safeDb(() => db.tabs.delete(tabId))

    // Reorder remaining tabs using bulkPut (NOT bulkUpdate!)
    const remainingTabs = await db.tabs
      .where("conversationId")
      .equals(tab.conversationId)
      .sortBy("position")

    await safeDb(() => db.tabs.bulkPut(
      remainingTabs.map((t, i) => ({
        ...t,
        position: i,
        pendingSync: true,
      }))
    ))

    // Also delete from server
    const supabase = (await import("@/lib/supabase/client")).createClient()
    await supabase.from("conversation_tabs").delete().eq("id", tabId)

    queueSync(tab.conversationId, session.userId)
  },

  renameTab: async (tabId, name) => {
    const { session } = get()
    if (!session) return

    const db = getMessageDb(session.userId)
    const tab = await db.tabs.get(tabId)
    if (!tab) return

    await safeDb(() => db.tabs.update(tabId, {
      name: name.trim() || "untitled",
      pendingSync: true,
    }))

    queueSync(tab.conversationId, session.userId)
  },

  syncFromServer: async (workspace) => {
    const { session } = get()
    if (!session) return

    set({ isSyncing: true })
    try {
      await fetchConversations(workspace, session.userId, session.orgId)
    } finally {
      set({ isSyncing: false })
    }
  },

  // Lazy load messages for a tab
  loadTabMessages: async (tabId) => {
    const { session } = get()
    if (!session) return

    set({ isLoading: true })
    try {
      await fetchTabMessages(tabId, session.userId)
    } finally {
      set({ isLoading: false })
    }
  },

  clearCurrentConversation: () => {
    set({ currentConversationId: null, currentTabId: null })
  },
}))

// Selectors
export const useCurrentConversationId = () =>
  useMessageStore(state => state.currentConversationId)

export const useIsSyncing = () =>
  useMessageStore(state => state.isSyncing)

export const useMessageActions = () =>
  useMessageStore(state => ({
    initializeConversation: state.initializeConversation,
    switchConversation: state.switchConversation,
    deleteConversation: state.deleteConversation,
    shareConversation: state.shareConversation,
    unshareConversation: state.unshareConversation,
    addMessage: state.addMessage,
    addTab: state.addTab,
    removeTab: state.removeTab,
    renameTab: state.renameTab,
    syncFromServer: state.syncFromServer,
    clearCurrentConversation: state.clearCurrentConversation,
  }))

// Re-export Dexie hooks
export {
  useConversations,
  useSharedConversations,
  useMessages,
  useTabs,
  useConversation,
} from "@/lib/db/useMessageDb"
```

## Phase 6: Migration from localStorage

**File: `apps/web/lib/db/migrateLegacyStorage.ts`**

```typescript
"use client"

import { getMessageDb, CURRENT_MESSAGE_VERSION, type DbMessageType } from "./messageDb"
import { safeDb } from "./safeDb"
import { queueSync } from "./conversationSync"

const LEGACY_STORAGE_KEY = "claude-message-storage"

// Strongly typed legacy state for safe parsing
interface LegacyMessage {
  id: string
  type: DbMessageType
  content: unknown
  createdAt?: number
}

interface LegacyConversation {
  id: string
  workspace?: string
  title?: string
  createdAt?: number
  lastActivity?: number
  messages?: LegacyMessage[]
}

interface LegacyState {
  state: {
    conversations: Record<string, LegacyConversation>
  }
}

// Migration status stored as JSON, not bare "true"
interface MigrationStatus {
  version: number
  completedAt: number
  conversationsMigrated: number
}

const MIGRATION_KEY = "dexie-migration"
const CURRENT_MIGRATION_VERSION = 3

/**
 * Migrate from localStorage to new system (one-time)
 * All migrated conversations are PRIVATE
 * Sets origin: "migration" on all migrated data
 */
export async function migrateLegacyStorage(userId: string, orgId: string): Promise<boolean> {
  if (typeof window === "undefined") return false

  // Check migration status
  const statusRaw = localStorage.getItem(MIGRATION_KEY)
  const status = statusRaw ? JSON.parse(statusRaw) as MigrationStatus : null

  if (status?.version >= CURRENT_MIGRATION_VERSION) {
    return false  // Already migrated
  }

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) {
      // No legacy data - mark as migrated anyway
      saveMigrationStatus(0)
      return false
    }

    const legacy = JSON.parse(raw) as Partial<LegacyState>
    if (!legacy.state?.conversations || typeof legacy.state.conversations !== "object") {
      saveMigrationStatus(0)
      return false
    }

    console.log("[migration] Migrating localStorage to Dexie + Supabase...")

    const db = getMessageDb(userId)
    const conversationIds: string[] = []
    let messageCount = 0

    await safeDb(() => db.transaction("rw", [db.conversations, db.messages, db.tabs], async () => {
      for (const [id, convo] of Object.entries(legacy.state!.conversations)) {
        const baseTime = convo.createdAt ?? Date.now()

        // Create conversation with metadata
        await db.conversations.put({
          id,
          workspace: convo.workspace || "unknown",
          orgId,
          creatorId: userId,
          title: convo.title || "Migrated conversation",
          visibility: "private",
          createdAt: baseTime,
          updatedAt: convo.lastActivity ?? baseTime,
          // Metadata
          messageCount: convo.messages?.length ?? 0,
          lastMessageAt: convo.lastActivity ?? baseTime,
          autoTitleSet: true,  // Don't overwrite existing titles
          // Mark as migrated for debugging
          pendingSync: true,
        })

        // Create default tab
        const defaultTabId = crypto.randomUUID()
        await db.tabs.put({
          id: defaultTabId,
          conversationId: id,
          name: "current",
          position: 0,
          createdAt: baseTime,
          messageCount: convo.messages?.length ?? 0,
          lastMessageAt: convo.lastActivity ?? baseTime,
          pendingSync: true,
        })

        // Create messages (prefer message timestamps if available)
        const messages = convo.messages ?? []
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i]
          // Use message timestamp if available, otherwise derive from position
          const msgTime = msg.createdAt ?? (baseTime + i)

          await db.messages.put({
            id: msg.id,
            tabId: defaultTabId,
            type: msg.type,
            content: msg.content,
            createdAt: msgTime,
            updatedAt: msgTime,
            version: CURRENT_MESSAGE_VERSION,
            status: "complete",
            origin: "migration",  // Mark origin for debugging
            pendingSync: true,
          })
          messageCount++
        }

        conversationIds.push(id)
      }
    }))

    // Queue all for sync
    for (const id of conversationIds) {
      queueSync(id, userId)
    }

    console.log(`[migration] Migrated ${conversationIds.length} conversations, ${messageCount} messages`)
    saveMigrationStatus(conversationIds.length)
    return true
  } catch (error) {
    // On failure, do NOT bump version - allow retry on next load
    console.error("[migration] Failed:", error)
    return false
  }
}

function saveMigrationStatus(conversationsMigrated: number): void {
  const status: MigrationStatus = {
    version: CURRENT_MIGRATION_VERSION,
    completedAt: Date.now(),
    conversationsMigrated,
  }
  localStorage.setItem(MIGRATION_KEY, JSON.stringify(status))
}
```

## File Changes Summary

| File | Change |
|------|--------|
| `apps/web/package.json` | Add `dexie`, `dexie-react-hooks` |
| `apps/web/lib/conversations/service.ts` | **NEW** - Single service layer for all operations |
| `apps/web/lib/db/messageDb.ts` | **NEW** - Dexie schema with USER-scoped DB name |
| `apps/web/lib/db/safeDb.ts` | **NEW** - Error handling wrapper |
| `apps/web/lib/db/messageAdapters.ts` | **NEW** - Type adapters (UIMessage ↔ DbMessage) |
| `apps/web/lib/db/useMessageDb.ts` | **NEW** - React hooks with session context |
| `apps/web/lib/db/conversationSync.ts` | **NEW** - Sync service with lazy loading + retry |
| `apps/web/lib/db/migrateLegacyStorage.ts` | **NEW** - Typed migration with status tracking |
| `apps/web/lib/stores/messageStore.ts` | **REWRITE** - Session-aware, soft deletes |
| `apps/web/lib/supabase/client.ts` | **UPDATE** - Add `db: { schema: "app" }` |
| `supabase/migrations/xxx_conversations.sql` | **NEW** - Server tables with metadata fields |

## Testing Checklist

### Core Operations
1. **Create conversation** → appears locally + syncs to server
2. **Add messages** → synced to server (debounced), metadata updated
3. **Add/remove tabs** → synced to server, messages deleted via tabId
4. **Share conversation** → other org members can see (same org only!)
5. **Unshare** → only creator can see again
6. **Soft delete** → deletedAt set, hidden from UI, synced to server

### Lazy Loading
7. **Open workspace** → only conversation metadata loaded (no messages)
8. **Open tab** → messages loaded for that tab only
9. **Pagination** → "Load older messages" works

### Multi-User Security
10. **Different users, same browser** → separate IndexedDB databases
11. **User A in org X, User B in org Y** → no cross-org data visible
12. **Shared conversations** → only visible to same org members

### Multi-Tab / Multi-Device
13. **Delete in tab A** → tab B clears currentConversation
14. **New message in tab A** → tab B sees it via useLiveQuery
15. **Offline device** → syncs with exponential backoff when online

### Migration
16. **No legacy data** → migration marks complete, no errors
17. **Valid legacy data** → conversations + messages migrated with origin: "migration"
18. **Corrupt legacy JSON** → migration fails gracefully, allows retry
19. **Migration status** → JSON format with version, timestamp, count

### Edge Cases
20. **Dexie quota exceeded** → error caught by safeDb, logged
21. **Schema upgrade blocked** → warning shown, suggest closing tabs
22. **Stale streaming message** → detected as interrupted on refresh

## Timeline

- Phase 1: 1 hour (dependencies)
- Phase 2: 1 hour (service layer)
- Phase 3: 4 hours (sync service with lazy loading + retry)
- Phase 4: 1 hour (hooks with session context)
- Phase 5: 3 hours (store rewrite with fixes)
- Phase 6: 1 hour (typed migration)
- Testing: 4 hours

**Total: ~15 hours**

## Execution Order

1. **[Part 1: Architecture](./one-dexie-architecture.md)** - Read first for context
2. **[Part 2: Schema](./two-dexie-schema.md)** - Implement Supabase + Dexie schema
3. **[Part 3: Implementation](./three-dexie-implementation.md)** - Sync service, hooks, store (this doc)
4. **[Part 4: Streaming](./four-dexie-streaming-integration.md)** - Streaming message lifecycle
