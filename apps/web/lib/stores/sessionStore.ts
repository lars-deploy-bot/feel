"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Session Store - Manages tab sessions with persistence
 *
 * Enables session resumption across page reloads by persisting sessionId
 * per workspace. Works with backend sessionStore for full resume capability.
 */

export interface TabSession {
  sessionId: string
  workspace: string
  lastActivity: number
}

interface SessionState {
  currentSessionId: string | null
  currentWorkspace: string | null
  sessions: TabSession[]
}

interface SessionActions {
  actions: {
    initSession: (workspace: string) => string
    newSession: (workspace: string) => string
    switchToSession: (sessionId: string, workspace: string) => void
    clearWorkspaceSession: (workspace: string) => void
    clearAll: () => void
  }
}

type SessionStore = SessionState & SessionActions

const MAX_SESSIONS = 10

/**
 * Session Store - Manages tab sessions with persistence
 *
 * Enables session resumption across page reloads by persisting sessionId
 * per workspace. Works with backend sessionStore for full resume capability.
 *
 * skipHydration: true - Prevents automatic hydration on store creation.
 * Hydration is coordinated by HydrationManager to ensure all stores
 * hydrate together, eliminating race conditions in E2E tests.
 */
export const useSessionStoreBase = create<SessionStore>()(
  persist(
    (set, get) => {
      const actions = {
        initSession: (workspace: string): string => {
          const state = get()

          // If already on this workspace, return existing sessionId
          if (state.currentWorkspace === workspace && state.currentSessionId) {
            return state.currentSessionId
          }

          // Look for existing session for this workspace
          const existingSession = state.sessions.find(s => s.workspace === workspace)

          if (existingSession) {
            // Resume existing session
            set({
              currentSessionId: existingSession.sessionId,
              currentWorkspace: workspace,
            })
            return existingSession.sessionId
          }

          // Create new session
          return actions.newSession(workspace)
        },

        newSession: (workspace: string): string => {
          const newId = crypto.randomUUID()

          set(state => {
            // Add new session (keep other workspace sessions)
            const newSession: TabSession = {
              sessionId: newId,
              workspace,
              lastActivity: Date.now(),
            }

            // Keep all sessions, prune globally if needed
            return {
              currentSessionId: newId,
              currentWorkspace: workspace,
              sessions: [newSession, ...state.sessions].slice(0, MAX_SESSIONS),
            }
          })

          return newId
        },

        switchToSession: (sessionId: string, workspace: string) => {
          set(state => {
            const existingSession = state.sessions.find(s => s.sessionId === sessionId)

            if (existingSession) {
              return {
                currentSessionId: sessionId,
                currentWorkspace: workspace,
                sessions: state.sessions.map(s => (s.sessionId === sessionId ? { ...s, lastActivity: Date.now() } : s)),
              }
            }

            const newSession: TabSession = {
              sessionId,
              workspace,
              lastActivity: Date.now(),
            }

            return {
              currentSessionId: sessionId,
              currentWorkspace: workspace,
              sessions: [newSession, ...state.sessions].slice(0, MAX_SESSIONS),
            }
          })
        },

        clearWorkspaceSession: (workspace: string) => {
          set(state => ({
            sessions: state.sessions.filter(s => s.workspace !== workspace),
            // Clear current if it matches
            currentSessionId: state.currentWorkspace === workspace ? null : state.currentSessionId,
            currentWorkspace: state.currentWorkspace === workspace ? null : state.currentWorkspace,
          }))
        },

        clearAll: () => {
          set({
            currentSessionId: null,
            currentWorkspace: null,
            sessions: [],
          })
        },
      }

      return {
        currentSessionId: null,
        currentWorkspace: null,
        sessions: [],
        actions,
      }
    },
    {
      name: "claude-session-storage",
      version: 2, // Bump for conversationId → sessionId rename
      partialize: state => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        currentWorkspace: state.currentWorkspace,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version === 1) {
          // v1 -> v2: rename conversationId → sessionId
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const old = persistedState as any
          return {
            currentSessionId: old.currentSessionId ?? old.currentConversationId ?? null,
            currentWorkspace: old.currentWorkspace ?? null,
            sessions: (old.sessions ?? []).map((s: Record<string, unknown>) => ({
              sessionId: s.sessionId ?? s.conversationId,
              workspace: s.workspace,
              lastActivity: s.lastActivity,
            })),
          } as SessionState
        }
        return persistedState as SessionState
      },
      skipHydration: true,
    },
  ),
)

export const useSessionId = () => useSessionStoreBase(state => state.currentSessionId)

export const useCurrentWorkspace = () => useSessionStoreBase(state => state.currentWorkspace)

export const useSessions = () => useSessionStoreBase(state => state.sessions)

export const useSessionActions = () => useSessionStoreBase(state => state.actions)
