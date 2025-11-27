"use client"

import { create } from "zustand"
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware"
import type { UIMessage } from "@/features/chat/lib/message-parser"

/**
 * Message Store - Persists messages for multiple conversations with history
 *
 * Stores up to MAX_CONVERSATIONS (20) per workspace. Messages survive page refresh
 * and users can browse past conversations via sidebar.
 *
 * Pattern follows Guide §14.1-14.3:
 * - State + Actions separation
 * - Atomic selectors
 * - Stable actions object
 *
 * Storage limits (to prevent QuotaExceededError):
 * - MAX_MESSAGE_CONTENT_SIZE: 50KB per message content
 * - MAX_STORAGE_SIZE: 4MB total (localStorage limit ~5MB)
 * - Auto-cleanup: removes oldest conversations when quota exceeded
 */

// Storage limits
const MAX_MESSAGE_CONTENT_SIZE = 50 * 1024 // 50KB per message
const MAX_STORAGE_SIZE = 4 * 1024 * 1024 // 4MB total

/**
 * Estimate the byte size of a value when JSON stringified
 */
function _estimateSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return 0
  }
}

/**
 * Truncate message content if it exceeds the size limit
 */
function truncateContent(content: unknown): unknown {
  if (typeof content === "string") {
    const size = new Blob([content]).size
    if (size > MAX_MESSAGE_CONTENT_SIZE) {
      // Binary search for the right truncation point
      let low = 0
      let high = content.length
      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2)
        const truncated = content.slice(0, mid)
        if (new Blob([truncated]).size <= MAX_MESSAGE_CONTENT_SIZE - 100) {
          // Leave room for suffix
          low = mid
        } else {
          high = mid - 1
        }
      }
      return `${content.slice(0, low)}\n\n[Content truncated due to size limit]`
    }
    return content
  }
  // For non-string content, return as-is (arrays, objects handled at message level)
  return content
}

/**
 * Truncate a UIMessage's content if needed
 */
function truncateMessage(message: UIMessage): UIMessage {
  return {
    ...message,
    content: truncateContent(message.content),
  }
}

/**
 * Storage state type for persistence
 */
interface PersistedState {
  conversationId: string | null
  conversations: Record<string, Conversation>
}

/**
 * Remove oldest conversations to free up space
 */
function removeOldestConversations(
  conversations: Record<string, Conversation>,
  keepCount: number,
): Record<string, Conversation> {
  const sorted = Object.values(conversations).sort((a, b) => b.lastActivity - a.lastActivity)
  const toKeep = sorted.slice(0, keepCount)
  const result: Record<string, Conversation> = {}
  for (const convo of toKeep) {
    result[convo.id] = convo
  }
  return result
}

/**
 * Create a safe localStorage wrapper that handles QuotaExceededError
 * by automatically removing old conversations
 */
function createSafeStorage(): PersistStorage<unknown> {
  return {
    getItem: (name: string): StorageValue<unknown> | null => {
      if (typeof window === "undefined") return null
      try {
        const item = localStorage.getItem(name)
        return item ? JSON.parse(item) : null
      } catch (error) {
        console.warn("[messageStore] Failed to read from localStorage:", error)
        return null
      }
    },

    setItem: (name: string, value: StorageValue<unknown>): void => {
      if (typeof window === "undefined") return

      const trySetItem = (data: StorageValue<unknown>, attempt = 1): void => {
        try {
          // Check total size before attempting to store
          const serialized = JSON.stringify(data)
          const size = new Blob([serialized]).size

          // Cast state to our expected type for type-safe access
          const state = data.state as PersistedState | undefined
          const conversations = state?.conversations

          if (size > MAX_STORAGE_SIZE && conversations) {
            // Data too large, proactively remove old conversations
            const conversationCount = Object.keys(conversations).length
            const newCount = Math.max(1, Math.floor(conversationCount * 0.7)) // Keep 70%
            console.warn(
              `[messageStore] Storage size ${(size / 1024 / 1024).toFixed(2)}MB exceeds limit, reducing conversations from ${conversationCount} to ${newCount}`,
            )

            const reducedState: PersistedState = {
              conversationId: state?.conversationId ?? null,
              conversations: removeOldestConversations(conversations, newCount),
            }

            // Recursively try with reduced data
            trySetItem({ ...data, state: reducedState }, attempt + 1)
            return
          }

          localStorage.setItem(name, serialized)
        } catch (error) {
          // Handle QuotaExceededError
          if (
            error instanceof DOMException &&
            (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22)
          ) {
            if (attempt > 5) {
              // Give up after 5 attempts
              console.error("[messageStore] Failed to persist after 5 cleanup attempts, clearing storage")
              try {
                localStorage.removeItem(name)
              } catch {
                // Ignore removal errors
              }
              return
            }

            console.warn(`[messageStore] QuotaExceededError on attempt ${attempt}, cleaning up old conversations`)

            // Cast state to our expected type for type-safe access
            const state = data.state as PersistedState | undefined
            const conversations = state?.conversations

            if (conversations) {
              const conversationCount = Object.keys(conversations).length
              if (conversationCount <= 1) {
                // Can't reduce further, truncate messages in the remaining conversation
                console.warn("[messageStore] Only 1 conversation left, truncating messages")
                const convoId = Object.keys(conversations)[0]
                if (convoId && conversations[convoId]) {
                  const convo = conversations[convoId]
                  // Keep only last 20 messages
                  const truncatedMessages = convo.messages.slice(-20)
                  const reducedState: PersistedState = {
                    conversationId: state?.conversationId ?? null,
                    conversations: {
                      [convoId]: {
                        ...convo,
                        messages: truncatedMessages,
                      },
                    },
                  }
                  trySetItem({ ...data, state: reducedState }, attempt + 1)
                  return
                }
              }

              // Remove oldest conversations (keep 50% on each retry)
              const newCount = Math.max(1, Math.floor(conversationCount * 0.5))
              const reducedState: PersistedState = {
                conversationId: state?.conversationId ?? null,
                conversations: removeOldestConversations(conversations, newCount),
              }

              trySetItem({ ...data, state: reducedState }, attempt + 1)
            }
          } else {
            console.error("[messageStore] Unexpected error persisting to localStorage:", error)
          }
        }
      }

      trySetItem(value)
    },

    removeItem: (name: string): void => {
      if (typeof window === "undefined") return
      try {
        localStorage.removeItem(name)
      } catch (error) {
        console.warn("[messageStore] Failed to remove from localStorage:", error)
      }
    },
  }
}

export interface Conversation {
  id: string
  title: string
  messages: UIMessage[]
  workspace: string
  createdAt: number
  lastActivity: number
}

interface MessageStoreState {
  conversationId: string | null
  conversations: Record<string, Conversation>
  initializeConversation: (id: string, workspace: string) => void
  addMessage: (message: UIMessage) => void
  setMessages: (messages: UIMessage[]) => void
  clearForNewConversation: () => void
  switchConversation: (id: string) => void
  deleteConversation: (id: string) => void
}

const MAX_CONVERSATIONS = 20

// v1 state structure for migration
interface V1State {
  conversationId: string | null
  messages: UIMessage[]
}

// Type guard for v1 state
function isV1State(state: unknown): state is V1State {
  if (!state || typeof state !== "object") return false
  const s = state as Record<string, unknown>
  return (
    "conversationId" in s &&
    (typeof s.conversationId === "string" || s.conversationId === null) &&
    "messages" in s &&
    Array.isArray(s.messages)
  )
}

// Helper: Generate title from first user message
function extractTitle(messages: UIMessage[]): string {
  const firstUserMessage = messages.find(m => m.type === "user")
  if (!firstUserMessage) return "New conversation"

  const content = typeof firstUserMessage.content === "string" ? firstUserMessage.content : "New conversation"

  // Take first 50 chars, trim, remove newlines
  const truncated = content.slice(0, 50).replace(/\n/g, " ").trim()
  return truncated || "New conversation"
}

// Helper: Prune old conversations (keep MAX_CONVERSATIONS most recent)
// Also removes empty conversations (0 messages) except the current one
function pruneConversations(
  conversations: Record<string, Conversation>,
  workspace: string,
  currentId?: string,
): Record<string, Conversation> {
  // First, remove empty conversations (except current one being initialized)
  const nonEmpty: Record<string, Conversation> = {}
  for (const [id, convo] of Object.entries(conversations)) {
    if (convo.messages.length > 0 || id === currentId) {
      nonEmpty[id] = convo
    }
  }

  const workspaceConvos = Object.values(nonEmpty)
    .filter(c => c.workspace === workspace)
    .sort((a, b) => b.lastActivity - a.lastActivity)

  if (workspaceConvos.length <= MAX_CONVERSATIONS) {
    return nonEmpty
  }

  // Keep only the most recent MAX_CONVERSATIONS for this workspace
  const toKeep = new Set(workspaceConvos.slice(0, MAX_CONVERSATIONS).map(c => c.id))

  const pruned: Record<string, Conversation> = {}
  for (const [id, convo] of Object.entries(nonEmpty)) {
    if (convo.workspace !== workspace || toKeep.has(id)) {
      pruned[id] = convo
    }
  }

  return pruned
}

export const useMessageStore = create<MessageStoreState>()(
  persist(
    set => ({
      conversationId: null,
      conversations: {},

      initializeConversation: (id: string, workspace: string) => {
        set(state => {
          // If conversation already exists, switch to it
          if (state.conversations[id]) {
            return { conversationId: id }
          }

          // Create new conversation
          const newConversation: Conversation = {
            id,
            title: "New conversation",
            messages: [],
            workspace,
            createdAt: Date.now(),
            lastActivity: Date.now(),
          }

          // Add conversation and prune if needed (pass id to preserve the new one)
          const updatedConversations = {
            ...state.conversations,
            [id]: newConversation,
          }

          return {
            conversationId: id,
            conversations: pruneConversations(updatedConversations, workspace, id),
          }
        })
      },

      addMessage: (message: UIMessage) => {
        set(state => {
          const { conversationId, conversations } = state
          if (!conversationId || !conversations[conversationId]) {
            console.warn("Cannot add message: no active conversation")
            return state
          }

          // Truncate message content if too large
          const truncatedMessage = truncateMessage(message)

          const conversation = conversations[conversationId]
          const updatedMessages = [...conversation.messages, truncatedMessage]

          // Auto-generate title from first user message
          const shouldUpdateTitle =
            conversation.title === "New conversation" &&
            truncatedMessage.type === "user" &&
            updatedMessages.filter(m => m.type === "user").length === 1

          const updatedConversation: Conversation = {
            ...conversation,
            messages: updatedMessages,
            lastActivity: Date.now(), // Auto-update activity on new message
            title: shouldUpdateTitle ? extractTitle(updatedMessages) : conversation.title,
          }

          return {
            conversations: {
              ...conversations,
              [conversationId]: updatedConversation,
            },
          }
        })
      },

      setMessages: (messages: UIMessage[]) => {
        set(state => {
          const { conversationId, conversations } = state
          if (!conversationId || !conversations[conversationId]) {
            console.warn("Cannot set messages: no active conversation")
            return state
          }

          const conversation = conversations[conversationId]
          const updatedConversation: Conversation = {
            ...conversation,
            messages,
            lastActivity: Date.now(),
          }

          return {
            conversations: {
              ...conversations,
              [conversationId]: updatedConversation,
            },
          }
        })
      },

      clearForNewConversation: () => {
        set({ conversationId: null })
      },

      switchConversation: (id: string) => {
        set(state => {
          if (!state.conversations[id]) {
            console.warn(`Cannot switch to conversation ${id}: not found`)
            return state
          }

          // Don't update lastActivity - switching shouldn't reorder the list
          return {
            conversationId: id,
          }
        })
      },

      deleteConversation: (id: string) => {
        set(state => {
          const { conversations, conversationId } = state

          if (!conversations[id]) {
            console.warn(`Cannot delete conversation ${id}: not found`)
            return state
          }

          const { [id]: _deleted, ...remaining } = conversations

          return {
            conversations: remaining,
            conversationId: conversationId === id ? null : conversationId,
          }
        })
      },
    }),
    {
      name: "claude-message-storage",
      version: 2, // Increment version for migration
      storage: createSafeStorage(),
      partialize: state => ({
        conversationId: state.conversationId,
        conversations: state.conversations,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Migrate from v1 (single conversation) to v2 (multiple conversations)
        if (version === 1 && isV1State(persistedState)) {
          // If there was an active conversation, preserve it
          if (persistedState.conversationId && persistedState.messages && persistedState.messages.length > 0) {
            const conversation: Conversation = {
              id: persistedState.conversationId,
              title: extractTitle(persistedState.messages),
              messages: persistedState.messages,
              workspace: "unknown", // Can't determine from v1 data
              createdAt: Date.now(),
              lastActivity: Date.now(),
            }

            return {
              conversationId: persistedState.conversationId,
              conversations: {
                [persistedState.conversationId]: conversation,
              },
            }
          }

          // No active conversation in v1
          return {
            conversationId: null,
            conversations: {},
          }
        }

        return persistedState
      },
    },
  ),
)

// Atomic selector: current messages (Guide §14.1)
// Single selector to prevent multiple subscriptions
export const useMessages = () =>
  useMessageStore(state => {
    if (!state.conversationId || !state.conversations[state.conversationId]) {
      return []
    }
    return state.conversations[state.conversationId].messages
  })

// Atomic selector: current conversation ID (Guide §14.1)
export const useCurrentConversationId = () => useMessageStore(state => state.conversationId)

// Atomic selector: current conversation
// Single selector to prevent multiple subscriptions
export const useCurrentConversation = () =>
  useMessageStore(state => {
    if (!state.conversationId) return null
    return state.conversations[state.conversationId] || null
  })

// Atomic selector: all conversations filtered by workspace
// Excludes empty conversations (0 messages) from the list - newly initialized
// conversations appear in the sidebar only after the first message is added
export const useConversations = (workspace?: string) =>
  useMessageStore(state =>
    Object.values(state.conversations)
      .filter(c => c.messages.length > 0 && (!workspace || c.workspace === workspace))
      .sort((a, b) => b.lastActivity - a.lastActivity),
  )

export const useMessageActions = () =>
  useMessageStore(state => ({
    initializeConversation: state.initializeConversation,
    addMessage: state.addMessage,
    setMessages: state.setMessages,
    clearForNewConversation: state.clearForNewConversation,
    switchConversation: state.switchConversation,
    deleteConversation: state.deleteConversation,
  }))
