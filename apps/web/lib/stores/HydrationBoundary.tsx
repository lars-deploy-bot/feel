"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
// Direct imports - these are all client-only stores
import { useLLMStoreBase } from "./llmStore"
import { useMessageStore } from "./messageStore"
import { useTabStore } from "./tabStore"
import { useWorkspaceStoreBase } from "./workspaceStore"

/**
 * Persisted stores that need coordinated hydration.
 *
 * Each store has `skipHydration: true` to prevent automatic hydration.
 * HydrationManager calls rehydrate() for all stores together.
 */
const PERSISTED_STORES = [
  { name: "workspace", store: useWorkspaceStoreBase },
  { name: "message", store: useMessageStore },
  { name: "tab", store: useTabStore },
  { name: "llm", store: useLLMStoreBase },
] as const

// Global hydration state - shared across all components
let _appHydrated = false
const hydrationListeners = new Set<() => void>()

function setAppHydrated(value: boolean): void {
  _appHydrated = value
  // Set window flag for E2E tests (explicit synchronization primitive)
  if (typeof window !== "undefined") {
    ;(window as unknown as { __APP_HYDRATED__: boolean }).__APP_HYDRATED__ = value
  }
  // Notify all listeners
  Array.from(hydrationListeners).forEach(listener => {
    listener()
  })
}

/**
 * Hook to check if all persisted stores have hydrated.
 * Uses useSyncExternalStore for tear-safe concurrent rendering.
 *
 * @returns true when all persisted stores have completed hydration
 */
export function useAppHydrated(): boolean {
  return useSyncExternalStore(
    callback => {
      hydrationListeners.add(callback)
      return () => hydrationListeners.delete(callback)
    },
    () => _appHydrated,
    () => false, // Server always returns false
  )
}

/**
 * HydrationManager - Coordinates hydration of ALL persisted stores
 *
 * Place this component once in the root layout. It:
 * 1. Calls persist.rehydrate() for every registered store
 * 2. Waits for all stores to finish hydrating
 * 3. Sets global _appHydrated flag + window.__APP_HYDRATED__ for E2E
 *
 * Why coordinated hydration:
 * - All stores hydrate together (no partial state)
 * - Single synchronization point for tests
 * - No per-component "mounted" hacks needed
 *
 * @see https://zustand.docs.pmnd.rs/integrations/persisting-store-data
 */
export function HydrationManager(): null {
  const hasStarted = useRef(false)

  useEffect(() => {
    // Only run once, even in StrictMode
    if (hasStarted.current) return
    hasStarted.current = true

    // Rehydrate all stores synchronously (they're already imported)
    const rehydrationPromises = PERSISTED_STORES.map(async ({ name, store }) => {
      if (!store.persist.hasHydrated()) {
        console.log(`[HydrationManager] Rehydrating ${name}`)
        await store.persist.rehydrate()
      }
    })

    Promise.all(rehydrationPromises).then(() => {
      console.log("[HydrationManager] All stores hydrated")
      setAppHydrated(true)
    })
  }, [])

  return null
}

/**
 * @deprecated Use HydrationManager instead
 * Kept for backwards compatibility during migration
 */
export const StoreHydrator = HydrationManager
