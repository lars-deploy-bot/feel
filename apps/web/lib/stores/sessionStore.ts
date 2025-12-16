"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Session Store - Manages conversation sessions with persistence
 *
 * Enables session resumption across page reloads by persisting conversationId
 * per workspace. Works with backend SessionStoreMemory for full resume capability.
 */

export interface ConversationSession {
  conversationId: string
  workspace: string
  lastActivity: number
}

interface SessionState {
  currentConversationId: string | null
  currentWorkspace: string | null
  sessions: ConversationSession[]
}

interface SessionActions {
  actions: {
    initConversation: (workspace: string) => string
    newConversation: (workspace: string) => string
    switchToConversation: (conversationId: string, workspace: string) => void
    clearWorkspaceConversation: (workspace: string) => void
    clearAll: () => void
  }
}

type SessionStore = SessionState & SessionActions

const MAX_SESSIONS = 10

/**
 * Session Store - Manages conversation sessions with persistence
 *
 * Enables session resumption across page reloads by persisting conversationId
 * per workspace. Works with backend SessionStoreMemory for full resume capability.
 *
 * skipHydration: true - Prevents automatic hydration on store creation.
 * Hydration is coordinated by HydrationManager to ensure all stores
 * hydrate together, eliminating race conditions in E2E tests.
 */
export const useSessionStoreBase = create<SessionStore>()(
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
            // Add new session (keep other workspace sessions)
            const newSession: ConversationSession = {
              conversationId: newId,
              workspace,
              lastActivity: Date.now(),
            }

            // Keep all sessions, prune globally if needed
            return {
              currentConversationId: newId,
              currentWorkspace: workspace,
              sessions: [newSession, ...state.sessions].slice(0, MAX_SESSIONS),
            }
          })

          return newId
        },

        switchToConversation: (conversationId: string, workspace: string) => {
          set(state => {
            const existingSession = state.sessions.find(s => s.conversationId === conversationId)

            if (existingSession) {
              return {
                currentConversationId: conversationId,
                currentWorkspace: workspace,
                sessions: state.sessions.map(s =>
                  s.conversationId === conversationId ? { ...s, lastActivity: Date.now() } : s,
                ),
              }
            }

            const newSession: ConversationSession = {
              conversationId,
              workspace,
              lastActivity: Date.now(),
            }

            return {
              currentConversationId: conversationId,
              currentWorkspace: workspace,
              sessions: [newSession, ...state.sessions].slice(0, MAX_SESSIONS),
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
      migrate: (persistedState: unknown, _version: number) => {
        // Simple pass-through migration - no schema changes needed
        return persistedState as SessionState
      },
      skipHydration: true,
    },
  ),
)

export const useConversationId = () => useSessionStoreBase(state => state.currentConversationId)

export const useCurrentWorkspace = () => useSessionStoreBase(state => state.currentWorkspace)

export const useSessions = () => useSessionStoreBase(state => state.sessions)

export const useSessionActions = () => useSessionStoreBase(state => state.actions)
