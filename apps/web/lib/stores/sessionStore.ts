"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Session Store - Manages conversation sessions with persistence
 *
 * Enables session resumption across page reloads by persisting conversationId
 * per workspace. Works with backend SessionStoreMemory for full resume capability.
 *
 * Pattern follows Guide §14.1-14.3:
 * - State + Actions separation
 * - Atomic selectors
 * - Stable actions object
 * - Backwards compatibility
 */

export interface ConversationSession {
  conversationId: string
  workspace: string
  lastActivity: number
}

// State interface
interface SessionState {
  currentConversationId: string | null
  currentWorkspace: string | null
  sessions: ConversationSession[]
}

// Actions interface - grouped under stable object (Guide §14.3)
interface SessionActions {
  actions: {
    /**
     * Initialize or resume a conversation for a workspace
     * Returns conversationId (existing or new)
     */
    initConversation: (workspace: string) => string
    /**
     * Create a new conversation (resets current conversation)
     */
    newConversation: (workspace: string) => string
    /**
     * Update last activity timestamp for current conversation
     */
    updateActivity: () => void
    /**
     * Clear conversation for specific workspace
     */
    clearWorkspaceConversation: (workspace: string) => void
    /**
     * Clear all conversations
     */
    clearAll: () => void
  }
}

// Extended type for backwards compatibility
type SessionStoreWithCompat = SessionState &
  SessionActions & {
    // Legacy direct action exports for backwards compatibility
    initConversation: (workspace: string) => string
    newConversation: (workspace: string) => string
    updateActivity: () => void
    clearWorkspaceConversation: (workspace: string) => void
    clearAll: () => void
  }

const MAX_SESSIONS = 10 // Keep last 10 workspace conversations

const useSessionStoreBase = create<SessionStoreWithCompat>()(
  persist(
    (set, get) => {
      const actions = {
        initConversation: (workspace: string): string => {
          const state = get()

          // If already on this workspace, return existing conversationId
          if (state.currentWorkspace === workspace && state.currentConversationId) {
            return state.currentConversationId
          }

          // Look for existing session for this workspace
          const existingSession = state.sessions.find(s => s.workspace === workspace)

          if (existingSession) {
            // Resume existing conversation
            set({
              currentConversationId: existingSession.conversationId,
              currentWorkspace: workspace,
            })
            return existingSession.conversationId
          }

          // Create new conversation
          return actions.newConversation(workspace)
        },

        newConversation: (workspace: string): string => {
          const newId = crypto.randomUUID()

          set(state => {
            // Remove old session for this workspace if exists
            const filteredSessions = state.sessions.filter(s => s.workspace !== workspace)

            // Add new session
            const newSession: ConversationSession = {
              conversationId: newId,
              workspace,
              lastActivity: Date.now(),
            }

            return {
              currentConversationId: newId,
              currentWorkspace: workspace,
              sessions: [newSession, ...filteredSessions].slice(0, MAX_SESSIONS),
            }
          })

          return newId
        },

        updateActivity: () => {
          set(state => {
            if (!state.currentConversationId || !state.currentWorkspace) {
              return state
            }

            return {
              sessions: state.sessions.map(s =>
                s.conversationId === state.currentConversationId ? { ...s, lastActivity: Date.now() } : s,
              ),
            }
          })
        },

        clearWorkspaceConversation: (workspace: string) => {
          set(state => ({
            sessions: state.sessions.filter(s => s.workspace !== workspace),
            // Clear current if it matches
            currentConversationId: state.currentWorkspace === workspace ? null : state.currentConversationId,
            currentWorkspace: state.currentWorkspace === workspace ? null : state.currentWorkspace,
          }))
        },

        clearAll: () => {
          set({
            currentConversationId: null,
            currentWorkspace: null,
            sessions: [],
          })
        },
      }

      return {
        currentConversationId: null,
        currentWorkspace: null,
        sessions: [],
        actions,
        // Legacy direct exports for backwards compatibility
        ...actions,
      }
    },
    {
      name: "claude-session-storage",
      version: 1,
      partialize: state => ({
        sessions: state.sessions,
        currentConversationId: state.currentConversationId,
        currentWorkspace: state.currentWorkspace,
      }),
    },
  ),
)

// Atomic selector: current conversationId (Guide §14.1)
export const useConversationId = () => useSessionStoreBase(state => state.currentConversationId)

// Atomic selector: current workspace (Guide §14.1)
export const useCurrentWorkspace = () => useSessionStoreBase(state => state.currentWorkspace)

// Atomic selector: all sessions (Guide §14.1)
export const useSessions = () => useSessionStoreBase(state => state.sessions)

// Actions hook - stable reference (Guide §14.3)
export const useSessionActions = () => useSessionStoreBase(state => state.actions)

// Legacy export for backwards compatibility
export const useSessionStore = useSessionStoreBase
