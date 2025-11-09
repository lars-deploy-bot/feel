"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { UIMessage } from "@/features/chat/lib/message-parser"

/**
 * Message Store - Persists messages for the current conversation
 *
 * Keeps only the active conversation in memory. Messages survive page refresh
 * but are cleared on new conversation.
 *
 * Pattern follows Guide §14.1-14.3:
 * - State + Actions separation
 * - Atomic selectors
 * - Stable actions object
 */

interface MessageStoreState {
  conversationId: string | null
  messages: UIMessage[]
  initializeConversation: (id: string) => void
  addMessage: (message: UIMessage) => void
  setMessages: (messages: UIMessage[]) => void
  clearForNewConversation: () => void
}

type MessageStore = MessageStoreState

export const useMessageStore = create<MessageStore>()(
  persist(
    set => ({
      conversationId: null,
      messages: [],
      initializeConversation: (id: string) => {
        set(state => {
          // Only reset messages if conversation ID changed
          if (state.conversationId !== id) {
            return { conversationId: id, messages: [] }
          }
          return state
        })
      },
      addMessage: (message: UIMessage) => {
        set(state => ({
          messages: [...state.messages, message],
        }))
      },
      setMessages: (messages: UIMessage[]) => {
        set({ messages })
      },
      clearForNewConversation: () => {
        set({ conversationId: null, messages: [] })
      },
    }),
    {
      name: "claude-message-storage",
      version: 1,
      partialize: state => ({
        conversationId: state.conversationId,
        messages: state.messages,
      }),
    },
  ),
)

// Atomic selector: current messages (Guide §14.1)
export const useMessages = () => useMessageStore(state => state.messages)

// Atomic selector: current conversation ID (Guide §14.1)
export const useCurrentConversationId = () => useMessageStore(state => state.conversationId)

// Actions hook - returns all action methods (Guide §14.3)
export const useMessageActions = () =>
  useMessageStore(state => ({
    initializeConversation: state.initializeConversation,
    addMessage: state.addMessage,
    setMessages: state.setMessages,
    clearForNewConversation: state.clearForNewConversation,
  }))
