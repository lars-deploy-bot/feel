"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

const isDev = process.env.NODE_ENV === "development"

// State interface
interface DebugState {
  isDebugView: boolean
  showSSETerminal: boolean
}

// Actions interface - grouped under stable object (Guide §14.3)
interface DebugActions {
  actions: {
    toggleView: () => void
    toggleSSETerminal: () => void
    setDebugView: (show: boolean) => void
    setSSETerminal: (show: boolean) => void
  }
}

// Extended type for backwards compatibility
type DebugStoreWithCompat = DebugState & DebugActions & {
  // Legacy direct action exports for backwards compatibility
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
 *
 * Follows Guide §14.3: actions grouped in stable object with backwards compatibility
 */
const useDebugStoreBase = create<DebugStoreWithCompat>()(
  persist(
    set => {
      const actions = {
        toggleView: () => set(state => ({ isDebugView: !state.isDebugView })),
        toggleSSETerminal: () => set(state => ({ showSSETerminal: !state.showSSETerminal })),
        setDebugView: (show: boolean) => set({ isDebugView: show }),
        setSSETerminal: (show: boolean) => set({ showSSETerminal: show }),
      }
      return {
        isDebugView: false,
        showSSETerminal: false,
        actions,
        // Legacy direct exports for backwards compatibility
        ...actions,
      }
    },
    {
      name: "claude-bridge-debug-view-v3",
    },
  ),
)

// Atomic selector: debug view state (Guide §14.1)
export const useDebugView = () => useDebugStoreBase(state => state.isDebugView)

// Atomic selector: SSE terminal visibility (Guide §14.1)
export const useSSETerminal = () => useDebugStoreBase(state => state.showSSETerminal)

// Actions hook - stable reference (Guide §14.3)
export const useDebugActions = () => useDebugStoreBase(state => state.actions)

// Legacy export for backwards compatibility
export const useDebugStore = useDebugStoreBase

// Helper: Check if debug view should be visible
export function isDevelopment(): boolean {
  return isDev
}

/**
 * Check if debug view should be visible
 * Only shows in development mode when user has enabled debug view
 */
export function useDebugVisible(): boolean {
  return isDev && useDebugView()
}
