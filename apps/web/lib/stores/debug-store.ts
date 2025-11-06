"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface DebugStore {
  isDebugView: boolean
  showSSETerminal: boolean
  toggleView: () => void
  toggleSSETerminal: () => void
  setDebugView: (show: boolean) => void
  setSSETerminal: (show: boolean) => void
}

/**
 * Persisted store for debug UI visibility.
 *
 * Two separate debug controls:
 * - Debug View: shows metadata, tool details in chat messages
 * - SSE Terminal: shows dev terminal sidebar for event logging
 */
export const useDebugStore = create<DebugStore>()(
  persist(
    set => ({
      isDebugView: false,
      showSSETerminal: false,
      toggleView: () => set(state => ({ isDebugView: !state.isDebugView })),
      toggleSSETerminal: () => set(state => ({ showSSETerminal: !state.showSSETerminal })),
      setDebugView: show => set({ isDebugView: show }),
      setSSETerminal: show => set({ showSSETerminal: show }),
    }),
    {
      name: "claude-bridge-debug-view-v3",
    },
  ),
)

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development"
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

export function useDebugVisible() {
  const isDebugView = useDebugStore(state => state.isDebugView)
  return isDevelopment() && isDebugView
}

export function useSSETerminalVisible() {
  const showSSETerminal = useDebugStore(state => state.showSSETerminal)
  return isDevelopment() && showSSETerminal
}
