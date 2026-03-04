"use client"

import { SUPERADMIN_WORKSPACE_NAME } from "@webalive/shared/constants"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useCurrentWorkspace } from "@/lib/stores/workspaceStore"

const isDev = process.env.NODE_ENV === "development"

// Check if running on dev/staging environment (client-side check)
function isDevOrStaging(): boolean {
  if (typeof window === "undefined") return false
  const hostname = window.location.hostname
  return (
    hostname.startsWith("staging.") ||
    hostname.includes(".staging.") ||
    hostname.startsWith("dev.") ||
    hostname === "localhost"
  )
}

// State interface
interface DebugState {
  isDebugView: boolean
  showWorkbench: boolean
  isWorkbenchMinimized: boolean
  isWorkbenchFullscreen: boolean
  workbenchWidth: number | null // null = use default (half viewport)
}

// Actions interface - grouped under stable object (Guide §14.3)
interface DebugActions {
  actions: {
    toggleView: () => void
    toggleWorkbench: () => void
    toggleWorkbenchMinimized: () => void
    toggleWorkbenchFullscreen: () => void
    setDebugView: (show: boolean) => void
    setWorkbench: (show: boolean) => void
    setWorkbenchMinimized: (minimized: boolean) => void
    setWorkbenchFullscreen: (fullscreen: boolean) => void
    setWorkbenchWidth: (width: number) => void
  }
}

export type DebugStore = DebugState & DebugActions

/**
 * Persisted store for debug UI visibility.
 *
 * Follows Guide §14.3: actions grouped in stable object
 *
 * skipHydration: true - Prevents automatic hydration on store creation.
 * Hydration is coordinated by HydrationManager to ensure all stores
 * hydrate together, eliminating race conditions in E2E tests.
 */
export const useDebugStoreBase = create<DebugStore>()(
  persist(
    set => {
      const actions = {
        toggleView: () => set(state => ({ isDebugView: !state.isDebugView })),
        toggleWorkbench: () =>
          set(state => ({
            showWorkbench: !state.showWorkbench,
            isWorkbenchMinimized: state.showWorkbench ? state.isWorkbenchMinimized : false,
          })),
        toggleWorkbenchMinimized: () => set(state => ({ isWorkbenchMinimized: !state.isWorkbenchMinimized })),
        toggleWorkbenchFullscreen: () => set(state => ({ isWorkbenchFullscreen: !state.isWorkbenchFullscreen })),
        setDebugView: (show: boolean) => set({ isDebugView: show }),
        setWorkbench: (show: boolean) => set({ showWorkbench: show }),
        setWorkbenchMinimized: (minimized: boolean) => set({ isWorkbenchMinimized: minimized }),
        setWorkbenchFullscreen: (fullscreen: boolean) => set({ isWorkbenchFullscreen: fullscreen }),
        setWorkbenchWidth: (width: number) => set({ workbenchWidth: width }),
      }
      return {
        isDebugView: false,
        showWorkbench: true,
        isWorkbenchMinimized: true,
        isWorkbenchFullscreen: false,
        workbenchWidth: null,
        actions,
      }
    },
    {
      name: "alive-debug-view-v9",
      partialize: state => ({
        isDebugView: state.isDebugView,
        showWorkbench: state.showWorkbench,
        isWorkbenchMinimized: state.isWorkbenchMinimized,
        isWorkbenchFullscreen: state.isWorkbenchFullscreen,
        workbenchWidth: state.workbenchWidth,
      }),
      skipHydration: true,
    },
  ),
)

// Atomic selector: debug view state (Guide §14.1)
export const useDebugView = () => useDebugStoreBase(state => state.isDebugView)

// Atomic selector: Workbench visibility (Guide §14.1)
export const useWorkbench = () => useDebugStoreBase(state => state.showWorkbench)

// Atomic selector: Workbench minimized state (Guide §14.1)
export const useWorkbenchMinimized = () => useDebugStoreBase(state => state.isWorkbenchMinimized)

// Atomic selector: Workbench fullscreen state (Guide §14.1)
export const useWorkbenchFullscreen = () => useDebugStoreBase(state => state.isWorkbenchFullscreen)

// Atomic selector: Workbench width (Guide §14.1)
export const useWorkbenchWidth = () => useDebugStoreBase(state => state.workbenchWidth)

// Actions hook - stable reference (Guide §14.3)
export const useDebugActions = () => useDebugStoreBase(state => state.actions)

// Helper: Check if debug tools should be available
// Available in development mode OR on dev/staging environments
export function isDevelopment(): boolean {
  return isDev || isDevOrStaging()
}

/**
 * Check if debug view should be visible
 * Shows ONLY when:
 * - User explicitly enabled debug view (toggleView in UI) AND
 * - Either in local development (localhost) OR in superadmin workspace
 *
 * This ensures regular users on prod/staging never see debug UI,
 * even if running a dev build.
 */
export function useDebugVisible(): boolean {
  const debugView = useDebugView()
  const workspace = useCurrentWorkspace()
  const isSuperadminWorkspace = workspace === SUPERADMIN_WORKSPACE_NAME
  const isLocalDev = typeof window !== "undefined" && window.location.hostname === "localhost"

  // Only show if user enabled it AND (localhost OR superadmin)
  return debugView && (isLocalDev || isSuperadminWorkspace)
}
