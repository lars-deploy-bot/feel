"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

const isDev = process.env.NODE_ENV === "development"

// State interface
interface DebugState {
  isDebugView: boolean
  showSSETerminal: boolean
  isSSETerminalMinimized: boolean
  showSandbox: boolean
  isSandboxMinimized: boolean
}

// Actions interface - grouped under stable object (Guide §14.3)
interface DebugActions {
  actions: {
    toggleView: () => void
    toggleSSETerminal: () => void
    toggleSSETerminalMinimized: () => void
    toggleSandbox: () => void
    toggleSandboxMinimized: () => void
    setDebugView: (show: boolean) => void
    setSSETerminal: (show: boolean) => void
    setSSETerminalMinimized: (minimized: boolean) => void
    setSandbox: (show: boolean) => void
    setSandboxMinimized: (minimized: boolean) => void
  }
}

// Extended type for backwards compatibility
export type DebugStore = DebugState &
  DebugActions & {
    // Legacy direct action exports for backwards compatibility
    toggleView: () => void
    toggleSSETerminal: () => void
    toggleSSETerminalMinimized: () => void
    toggleSandbox: () => void
    toggleSandboxMinimized: () => void
    setDebugView: (show: boolean) => void
    setSSETerminal: (show: boolean) => void
    setSSETerminalMinimized: (minimized: boolean) => void
    setSandbox: (show: boolean) => void
    setSandboxMinimized: (minimized: boolean) => void
  }

/**
 * Persisted store for debug UI visibility.
 *
 * Two separate debug controls:
 * - Debug View: shows metadata, tool details in chat messages
 * - SSE Terminal: shows dev terminal sidebar for event logging
 *
 * Follows Guide §14.3: actions grouped in stable object
 */
const useDebugStoreBase = create<DebugStore>()(
  persist(
    set => {
      const actions = {
        toggleView: () => set(state => ({ isDebugView: !state.isDebugView })),
        toggleSSETerminal: () => set(state => ({ showSSETerminal: !state.showSSETerminal })),
        toggleSSETerminalMinimized: () => set(state => ({ isSSETerminalMinimized: !state.isSSETerminalMinimized })),
        toggleSandbox: () => set(state => ({ showSandbox: !state.showSandbox })),
        toggleSandboxMinimized: () => set(state => ({ isSandboxMinimized: !state.isSandboxMinimized })),
        setDebugView: (show: boolean) => set({ isDebugView: show }),
        setSSETerminal: (show: boolean) => set({ showSSETerminal: show }),
        setSSETerminalMinimized: (minimized: boolean) => set({ isSSETerminalMinimized: minimized }),
        setSandbox: (show: boolean) => set({ showSandbox: show }),
        setSandboxMinimized: (minimized: boolean) => set({ isSandboxMinimized: minimized }),
      }
      return {
        isDebugView: false,
        showSSETerminal: false,
        isSSETerminalMinimized: false,
        showSandbox: false,
        isSandboxMinimized: false,
        actions,
        // Legacy direct exports for backwards compatibility
        ...actions,
      }
    },
    {
      name: "claude-bridge-debug-view-v5",
      partialize: state => ({
        isDebugView: state.isDebugView,
        showSSETerminal: state.showSSETerminal,
        isSSETerminalMinimized: state.isSSETerminalMinimized,
        showSandbox: state.showSandbox,
        isSandboxMinimized: state.isSandboxMinimized,
      }),
    },
  ),
)

// Atomic selector: debug view state (Guide §14.1)
export const useDebugView = () => useDebugStoreBase(state => state.isDebugView)

// Atomic selector: SSE terminal visibility (Guide §14.1)
export const useSSETerminal = () => useDebugStoreBase(state => state.showSSETerminal)

// Atomic selector: SSE terminal minimized state (Guide §14.1)
export const useSSETerminalMinimized = () => useDebugStoreBase(state => state.isSSETerminalMinimized)

// Atomic selector: Sandbox visibility (Guide §14.1)
export const useSandbox = () => useDebugStoreBase(state => state.showSandbox)

// Atomic selector: Sandbox minimized state (Guide §14.1)
export const useSandboxMinimized = () => useDebugStoreBase(state => state.isSandboxMinimized)

// Actions hook - stable reference (Guide §14.3)
export const useDebugActions = () => useDebugStoreBase(state => state.actions)

// Helper: Check if debug view should be visible
export function isDevelopment(): boolean {
  return isDev
}

/**
 * Check if debug view should be visible
 * Only shows in development mode when user has enabled debug view
 */
export function useDebugVisible(): boolean {
  const debugView = useDebugView()
  return isDev && debugView
}
