"use client"

/**
 * Dexie Message Store
 *
 * New message store implementation using Dexie.js for IndexedDB persistence.
 * This is a PARALLEL implementation - the old localStorage-based messageStore
 * continues to work until the codebase is gradually migrated.
 *
 * Key differences from old store:
 * - Requires session context (userId + orgId) for all operations
 * - Messages belong to tabs, not conversations directly
 * - Supports soft deletes, sharing, and lazy loading
 * - Streaming state is in-memory only, debounced to Dexie
 *
 * Usage:
 * 1. Import from this file instead of messageStore
 * 2. Call setSession() before any operations
 * 3. Use workspace-scoped hooks for conversations
 */

import { create } from "zustand"
import { getMessageDb, CURRENT_MESSAGE_VERSION, type DbConversation, type DbMessage, type DbTab } from "./messageDb"
import { safeDb } from "./safeDb"
import {
  queueSync,
  fetchConversations,
  fetchTabMessages,
  shareConversation as syncShareConversation,
  unshareConversation as syncUnshareConversation,
  deleteConversation as syncDeleteConversation,
  archiveConversation as syncArchiveConversation,
} from "./conversationSync"
import { toDbMessageContent, extractTitle } from "./messageAdapters"
import type { UIMessage } from "@/features/chat/lib/message-parser"

// =============================================================================
// Types
// =============================================================================

const generateId = () => crypto.randomUUID()

export interface DexieSessionContext {
  userId: string
  orgId: string
}

interface DexieMessageStoreState {
  // Session context - REQUIRED for all operations
  session: DexieSessionContext | null
  currentConversationId: string | null
  currentTabId: string | null
  currentWorkspace: string | null
  isLoading: boolean
  isSyncing: boolean

  // Streaming state (per-tab, in-memory only - NOT persisted)
  activeStreamByTab: Record<string, string | null>
  streamingBuffers: Record<string, string>
}

interface DexieMessageStoreActions {
  // Session management
  setSession: (session: DexieSessionContext) => void

  // Conversation management
  initializeConversation: (workspace: string) => Promise<{ conversationId: string; tabId: string }>
  ensureTabGroupWithTab: (
    workspace: string,
    tabGroupId: string,
    tabId: string,
  ) => Promise<{ conversationId: string; tabId: string; created: boolean }>
  switchConversation: (id: string, tabId?: string) => void
  deleteConversation: (id: string) => Promise<void>
  archiveConversation: (id: string) => Promise<void>
  shareConversation: (id: string) => Promise<void>
  unshareConversation: (id: string) => Promise<void>

  // Message management
  addMessage: (message: UIMessage, targetTabId: string) => Promise<void>

  // Tab management
  addTab: (name?: string) => Promise<string>
  switchTab: (tabId: string) => void
  removeTab: (tabId: string) => Promise<void>
  reopenTab: (tabId: string) => Promise<void>
  renameTab: (tabId: string, name: string) => Promise<void>

  // Sync
  syncFromServer: (workspace: string) => Promise<void>
  loadTabMessages: (tabId: string) => Promise<void>

  // Streaming lifecycle
  startAssistantStream: (tabId: string) => Promise<string>
  appendToAssistantStream: (messageId: string, deltaText: string) => void
  finalizeAssistantStream: (messageId: string) => Promise<void>
  stopAssistantStream: (messageId: string) => Promise<void>
  failAssistantStream: (messageId: string, errorCode?: string) => Promise<void>

  // Cleanup
  clearCurrentConversation: () => void
}

type DexieMessageStore = DexieMessageStoreState & DexieMessageStoreActions

// =============================================================================
// Streaming Helpers
// =============================================================================

const flushTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}
const FLUSH_DEBOUNCE_MS = 300
const alreadyFinalized = new Set<string>()

/**
 * Get the next sequence number for a tab.
 * Messages are ordered by seq, not timestamp, for reliable ordering.
 */
async function getNextSeq(db: ReturnType<typeof getMessageDb>, tabId: string): Promise<number> {
  const lastMessage = await db.messages.where("tabId").equals(tabId).last()
  return (lastMessage?.seq ?? 0) + 1
}

function scheduleFlushStreamingSnapshot(messageId: string, userId: string, getText: () => string) {
  if (flushTimeouts[messageId]) {
    clearTimeout(flushTimeouts[messageId])
  }
  flushTimeouts[messageId] = setTimeout(async () => {
    const text = getText()
    if (text == null) return

    const db = getMessageDb(userId)
    await safeDb(() =>
      db.messages.update(messageId, {
        content: { kind: "text", text },
        updatedAt: Date.now(),
        status: "streaming",
      }),
    )
    delete flushTimeouts[messageId]
  }, FLUSH_DEBOUNCE_MS)
}

// =============================================================================
// Store
// =============================================================================

export const useDexieMessageStore = create<DexieMessageStore>((set, get) => ({
  session: null,
  currentConversationId: null,
  currentTabId: null,
  currentWorkspace: null,
  isLoading: false,
  isSyncing: false,
  activeStreamByTab: {},
  streamingBuffers: {},

  setSession: session => set({ session }),

  initializeConversation: async workspace => {
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
      messageCount: 0,
      autoTitleSet: false,
      pendingSync: true,
    }

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

    await safeDb(() =>
      db.transaction("rw", [db.conversations, db.tabs], async () => {
        await db.conversations.add(newConvo)
        await db.tabs.add(defaultTab)
      }),
    )

    set({
      currentConversationId: id,
      currentTabId: defaultTabId,
      currentWorkspace: workspace,
    })

    queueSync(id, session.userId)
    return { conversationId: id, tabId: defaultTabId }
  },

  ensureTabGroupWithTab: async (workspace, tabGroupId, tabId) => {
    const { session } = get()
    if (!session) throw new Error("No session - call setSession first")

    const db = getMessageDb(session.userId)
    const existingTab = await db.tabs.get(tabId)

    if (existingTab) {
      if (existingTab.conversationId !== tabGroupId) {
        console.warn("[dexie] Tab group mismatch for tab, updating conversationId", {
          tabId,
          from: existingTab.conversationId,
          to: tabGroupId,
        })
        await safeDb(() => db.tabs.update(tabId, { conversationId: tabGroupId, pendingSync: true }))
      }
      set({
        currentConversationId: tabGroupId,
        currentTabId: existingTab.id,
        currentWorkspace: workspace,
      })
      return { conversationId: tabGroupId, tabId: existingTab.id, created: false }
    }

    const conversationId = tabGroupId
    const now = Date.now()

    await safeDb(() =>
      db.transaction("rw", [db.conversations, db.tabs], async () => {
        const existingConversation = await db.conversations.get(conversationId)
        if (!existingConversation) {
          const newConvo: DbConversation = {
            id: conversationId,
            workspace,
            orgId: session.orgId,
            creatorId: session.userId,
            title: "New conversation",
            visibility: "private",
            createdAt: now,
            updatedAt: now,
            messageCount: 0,
            autoTitleSet: false,
            pendingSync: true,
          }
          await db.conversations.add(newConvo)
        }

        // Use put (not add) to be idempotent — handleNewConversation and the
        // useEffect that syncs tab↔tabGroup can race, both calling this with
        // the same tabId before the other's write is visible.
        const existingTabs = await db.tabs.where("conversationId").equals(conversationId).toArray()
        const alreadyExists = existingTabs.some(t => t.id === tabId)
        if (!alreadyExists) {
          const newTab: DbTab = {
            id: tabId,
            conversationId,
            name: "current",
            position: existingTabs.length,
            createdAt: now,
            messageCount: 0,
            pendingSync: true,
          }
          await db.tabs.put(newTab)
        }
      }),
    )

    set({
      currentConversationId: conversationId,
      currentTabId: tabId,
      currentWorkspace: workspace,
    })

    queueSync(conversationId, session.userId)
    return { conversationId, tabId, created: true }
  },

  switchConversation: (id, tabId) => {
    set({
      currentConversationId: id,
      currentTabId: tabId ?? null,
    })
  },

  deleteConversation: async id => {
    const { currentConversationId, session } = get()
    if (!session) return

    await syncDeleteConversation(id, session.userId)

    if (currentConversationId === id) {
      set({ currentConversationId: null, currentTabId: null })
    }
  },

  archiveConversation: async id => {
    const { currentConversationId, session } = get()
    if (!session) return

    await syncArchiveConversation(id, session.userId)

    if (currentConversationId === id) {
      set({ currentConversationId: null, currentTabId: null })
    }
  },

  shareConversation: async id => {
    const { session } = get()
    if (!session) return
    await syncShareConversation(id, session.userId)
  },

  unshareConversation: async id => {
    const { session } = get()
    if (!session) return
    await syncUnshareConversation(id, session.userId)
  },

  addMessage: async (message, targetTabId) => {
    // Skip transient stream lifecycle messages that don't make sense when reloaded
    // These are ephemeral UI events (stream start/complete, progress indicators, etc.)
    const TRANSIENT_TYPES = new Set(["start", "complete", "compact_boundary", "tool_progress", "auth_status"])
    if (TRANSIENT_TYPES.has(message.type)) {
      return
    }

    const { currentConversationId, currentTabId, session } = get()

    if (!session || !targetTabId) {
      console.warn("[dexie] addMessage called without session or targetTabId")
      return
    }

    const db = getMessageDb(session.userId)

    // Resolve conversationId for the target tab
    // If target tab differs from current, look up its conversationId from Dexie
    let effectiveConversationId = currentConversationId
    if (targetTabId !== currentTabId) {
      const targetTab = await db.tabs.get(targetTabId)
      if (targetTab) {
        effectiveConversationId = targetTab.conversationId
      } else {
        console.warn(`[dexie] addMessage: target tab ${targetTabId} not found in Dexie`)
      }
    }

    if (!effectiveConversationId) {
      console.warn("[dexie] addMessage called without conversationId")
      return
    }

    const now = Date.now()
    const seq = await getNextSeq(db, targetTabId)

    const dbMessage: DbMessage = {
      id: message.id,
      tabId: targetTabId,
      type: message.type === "user" ? "user" : message.type === "sdk_message" ? "sdk_message" : "system",
      content: toDbMessageContent(message),
      createdAt: now,
      updatedAt: now,
      version: CURRENT_MESSAGE_VERSION,
      status: "complete",
      origin: "local",
      seq,
      pendingSync: true,
    }

    await safeDb(() => db.messages.add(dbMessage))

    // Update conversation metadata
    const convo = await db.conversations.get(effectiveConversationId)
    if (!convo) return

    const updates: Partial<DbConversation> = {
      updatedAt: now,
      lastMessageAt: now,
      messageCount: (convo.messageCount ?? 0) + 1,
      pendingSync: true,
    }

    if (message.type === "user" && !convo.autoTitleSet) {
      updates.title = extractTitle(dbMessage.content)
      updates.firstUserMessageId = dbMessage.id
      updates.autoTitleSet = true
    }

    await safeDb(() => db.conversations.update(effectiveConversationId!, updates))

    const tab = await db.tabs.get(targetTabId)
    if (tab) {
      await safeDb(() =>
        db.tabs.update(targetTabId, {
          lastMessageAt: now,
          messageCount: (tab.messageCount ?? 0) + 1,
          pendingSync: true,
        }),
      )
    }

    queueSync(effectiveConversationId, session.userId)
  },

  addTab: async (name = "new tab") => {
    const { currentConversationId, session } = get()
    if (!session) throw new Error("No session")
    if (!currentConversationId) throw new Error("No active conversation")

    const db = getMessageDb(session.userId)
    const existingTabs = await db.tabs.where("conversationId").equals(currentConversationId).toArray()

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

  switchTab: tabId => set({ currentTabId: tabId }),

  removeTab: async tabId => {
    const { session } = get()
    if (!session) return

    const db = getMessageDb(session.userId)
    await safeDb(() => db.tabs.update(tabId, { closedAt: Date.now() }))
  },

  reopenTab: async tabId => {
    const { session } = get()
    if (!session) return

    const db = getMessageDb(session.userId)
    // Dexie doesn't support setting a field to undefined via update,
    // so we read-modify-write to remove closedAt
    const tab = await db.tabs.get(tabId)
    if (!tab) return
    const { closedAt: _, ...rest } = tab
    await safeDb(() => db.tabs.put(rest))
  },

  renameTab: async (tabId, name) => {
    const { session } = get()
    if (!session) return

    const db = getMessageDb(session.userId)
    const tab = await db.tabs.get(tabId)
    if (!tab) return

    await safeDb(() => db.tabs.update(tabId, { name: name.trim() || "untitled", pendingSync: true }))
    queueSync(tab.conversationId, session.userId)
  },

  syncFromServer: async workspace => {
    const { session } = get()
    if (!session) return

    set({ isSyncing: true })
    try {
      await fetchConversations(workspace, session.userId, session.orgId)
    } finally {
      set({ isSyncing: false })
    }
  },

  loadTabMessages: async tabId => {
    const { session } = get()
    if (!session) return

    set({ isLoading: true })
    try {
      await fetchTabMessages(tabId, session.userId)
    } finally {
      set({ isLoading: false })
    }
  },

  startAssistantStream: async tabId => {
    const { currentConversationId, session } = get()
    if (!session) throw new Error("No session")
    if (!currentConversationId) throw new Error("No active conversation")

    const db = getMessageDb(session.userId)
    const id = generateId()
    const now = Date.now()
    const seq = await getNextSeq(db, tabId)

    const dbMessage: DbMessage = {
      id,
      tabId,
      type: "assistant",
      content: { kind: "text", text: "" },
      createdAt: now,
      updatedAt: now,
      version: CURRENT_MESSAGE_VERSION,
      status: "streaming",
      origin: "local",
      seq,
      pendingSync: false,
    }

    await safeDb(() => db.messages.add(dbMessage))

    set(state => ({
      activeStreamByTab: { ...state.activeStreamByTab, [tabId]: id },
      streamingBuffers: { ...state.streamingBuffers, [id]: "" },
    }))

    return id
  },

  appendToAssistantStream: (messageId, deltaText) => {
    const { streamingBuffers, session } = get()
    if (!session) return

    const next = (streamingBuffers[messageId] ?? "") + deltaText
    set({ streamingBuffers: { ...streamingBuffers, [messageId]: next } })
    scheduleFlushStreamingSnapshot(messageId, session.userId, () => get().streamingBuffers[messageId] ?? "")
  },

  finalizeAssistantStream: async messageId => {
    if (alreadyFinalized.has(messageId)) return
    alreadyFinalized.add(messageId)

    const { streamingBuffers, activeStreamByTab, currentConversationId, session } = get()
    if (!session) return

    const db = getMessageDb(session.userId)
    const text = streamingBuffers[messageId] ?? ""

    await safeDb(() =>
      db.messages.update(messageId, {
        content: { kind: "text", text },
        updatedAt: Date.now(),
        status: "complete",
        pendingSync: true,
      }),
    )

    const tabId = Object.entries(activeStreamByTab).find(([, id]) => id === messageId)?.[0]

    set(state => {
      const newBuffers = { ...state.streamingBuffers }
      delete newBuffers[messageId]
      return {
        streamingBuffers: newBuffers,
        activeStreamByTab: tabId ? { ...state.activeStreamByTab, [tabId]: null } : state.activeStreamByTab,
      }
    })

    if (currentConversationId) queueSync(currentConversationId, session.userId)
    setTimeout(() => alreadyFinalized.delete(messageId), 60000)
  },

  stopAssistantStream: async messageId => {
    if (alreadyFinalized.has(messageId)) return
    alreadyFinalized.add(messageId)

    const { streamingBuffers, activeStreamByTab, currentConversationId, session } = get()
    if (!session) return

    const db = getMessageDb(session.userId)
    const text = streamingBuffers[messageId] ?? ""

    await safeDb(() =>
      db.messages.update(messageId, {
        content: { kind: "text", text },
        updatedAt: Date.now(),
        status: "interrupted",
        abortedAt: Date.now(),
        pendingSync: true,
      }),
    )

    const tabId = Object.entries(activeStreamByTab).find(([, id]) => id === messageId)?.[0]

    set(state => {
      const newBuffers = { ...state.streamingBuffers }
      delete newBuffers[messageId]
      return {
        streamingBuffers: newBuffers,
        activeStreamByTab: tabId ? { ...state.activeStreamByTab, [tabId]: null } : state.activeStreamByTab,
      }
    })

    if (currentConversationId) queueSync(currentConversationId, session.userId)
    setTimeout(() => alreadyFinalized.delete(messageId), 60000)
  },

  failAssistantStream: async (messageId, errorCode) => {
    if (alreadyFinalized.has(messageId)) return
    alreadyFinalized.add(messageId)

    const { streamingBuffers, activeStreamByTab, currentConversationId, session } = get()
    if (!session) return

    const db = getMessageDb(session.userId)
    const text = streamingBuffers[messageId] ?? ""

    await safeDb(() =>
      db.messages.update(messageId, {
        content: { kind: "text", text },
        updatedAt: Date.now(),
        status: "error",
        errorCode: errorCode ?? "unknown",
        pendingSync: true,
      }),
    )

    const tabId = Object.entries(activeStreamByTab).find(([, id]) => id === messageId)?.[0]

    set(state => {
      const newBuffers = { ...state.streamingBuffers }
      delete newBuffers[messageId]
      return {
        streamingBuffers: newBuffers,
        activeStreamByTab: tabId ? { ...state.activeStreamByTab, [tabId]: null } : state.activeStreamByTab,
      }
    })

    if (currentConversationId) queueSync(currentConversationId, session.userId)
    setTimeout(() => alreadyFinalized.delete(messageId), 60000)
  },

  clearCurrentConversation: () => {
    set({ currentConversationId: null, currentTabId: null })
  },
}))

// =============================================================================
// Selectors
// =============================================================================

export const useDexieCurrentConversationId = () => useDexieMessageStore(s => s.currentConversationId)
export const useDexieCurrentTabId = () => useDexieMessageStore(s => s.currentTabId)
export const useDexieCurrentWorkspace = () => useDexieMessageStore(s => s.currentWorkspace)
export const useDexieIsSyncing = () => useDexieMessageStore(s => s.isSyncing)
export const useDexieIsLoading = () => useDexieMessageStore(s => s.isLoading)
export const useDexieSession = () => useDexieMessageStore(s => s.session)

export const useDexieMessageActions = () =>
  useDexieMessageStore(state => ({
    setSession: state.setSession,
    initializeConversation: state.initializeConversation,
    ensureTabGroupWithTab: state.ensureTabGroupWithTab,
    switchConversation: state.switchConversation,
    deleteConversation: state.deleteConversation,
    archiveConversation: state.archiveConversation,
    shareConversation: state.shareConversation,
    unshareConversation: state.unshareConversation,
    addMessage: state.addMessage,
    addTab: state.addTab,
    switchTab: state.switchTab,
    removeTab: state.removeTab,
    reopenTab: state.reopenTab,
    renameTab: state.renameTab,
    syncFromServer: state.syncFromServer,
    loadTabMessages: state.loadTabMessages,
    startAssistantStream: state.startAssistantStream,
    appendToAssistantStream: state.appendToAssistantStream,
    finalizeAssistantStream: state.finalizeAssistantStream,
    stopAssistantStream: state.stopAssistantStream,
    failAssistantStream: state.failAssistantStream,
    clearCurrentConversation: state.clearCurrentConversation,
  }))

// =============================================================================
// Re-export Dexie Hooks
// =============================================================================

export {
  useConversations as useDexieConversations,
  useSharedConversations as useDexieSharedConversations,
  useMessages as useDexieMessages,
  useTabs as useDexieTabs,
  useConversation as useDexieConversation,
  useCurrentConversationSafe as useDexieCurrentConversationSafe,
} from "./useMessageDb"
