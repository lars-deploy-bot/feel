"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
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
 */

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
  getAllConversations: (workspace?: string) => Conversation[]
}

type MessageStore = MessageStoreState

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
function pruneConversations(
  conversations: Record<string, Conversation>,
  workspace: string,
): Record<string, Conversation> {
  const workspaceConvos = Object.values(conversations)
    .filter(c => c.workspace === workspace)
    .sort((a, b) => b.lastActivity - a.lastActivity)

  if (workspaceConvos.length <= MAX_CONVERSATIONS) {
    return conversations
  }

  // Keep only the most recent MAX_CONVERSATIONS for this workspace
  const toKeep = new Set(workspaceConvos.slice(0, MAX_CONVERSATIONS).map(c => c.id))

  const pruned: Record<string, Conversation> = {}
  for (const [id, convo] of Object.entries(conversations)) {
    if (convo.workspace !== workspace || toKeep.has(id)) {
      pruned[id] = convo
    }
  }

  return pruned
}

export const useMessageStore = create<MessageStore>()(
  persist(
    (set, get) => ({
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

          // Add conversation and prune if needed
          const updatedConversations = {
            ...state.conversations,
            [id]: newConversation,
          }

          return {
            conversationId: id,
            conversations: pruneConversations(updatedConversations, workspace),
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

          const conversation = conversations[conversationId]
          const updatedMessages = [...conversation.messages, message]

          // Auto-generate title from first user message
          const shouldUpdateTitle =
            conversation.title === "New conversation" &&
            message.type === "user" &&
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

      getAllConversations: (workspace?: string) => {
        const conversations = Object.values(get().conversations)

        if (workspace) {
          return conversations.filter(c => c.workspace === workspace).sort((a, b) => b.lastActivity - a.lastActivity)
        }

        return conversations.sort((a, b) => b.lastActivity - a.lastActivity)
      },
    }),
    {
      name: "claude-message-storage",
      version: 2, // Increment version for migration
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

// Atomic selector: all conversations
export const useConversations = (workspace?: string) => useMessageStore(state => state.getAllConversations(workspace))

export const useMessageActions = () =>
  useMessageStore(state => ({
    initializeConversation: state.initializeConversation,
    addMessage: state.addMessage,
    setMessages: state.setMessages,
    clearForNewConversation: state.clearForNewConversation,
    switchConversation: state.switchConversation,
    deleteConversation: state.deleteConversation,
    getAllConversations: state.getAllConversations,
  }))
