/**
 * Store Registrations - Centralized registration of all persisted stores
 *
 * This file imports all stores and registers them with the hydration registry.
 * Import this file once at app initialization to register all stores.
 *
 * Why a separate file:
 * - Avoids circular imports (stores don't import registry, this file does both)
 * - Single place to manage store registration order/priority
 * - Easy to see all persisted stores at a glance
 *
 * Priority levels:
 * - 10-19: Core stores (workspace, session) - must hydrate first
 * - 20-49: Data stores (messages, tabs, llm)
 * - 50-99: UI preference stores (debug, feature flags, goal)
 * - 100+: Low priority (deploy, onboarding)
 */

import { registerStore } from "./hydration-registry"

// Import all stores that need coordinated hydration
// These imports are type-only initially, we access .persist at runtime
import { useWorkspaceStoreBase } from "./workspaceStore"
import { useMessageStore } from "./messageStore"
import { useTabStore } from "./tabStore"
import { useLLMStoreBase } from "./llmStore"
import { useDebugStoreBase } from "./debug-store"
import { useFeatureFlagStoreBase } from "./featureFlagStore"
import { useSessionStoreBase } from "./sessionStore"
import { useGoalStoreBase } from "./goalStore"
import { useOnboardingStoreBase } from "./onboardingStore"
import { useDeployStoreBase } from "./deployStore"

/**
 * Register all persisted stores.
 * Called once when this module is imported.
 */
function registerAllStores(): void {
  // Helper to ensure rehydrate always returns a Promise
  // (persist.rehydrate returns void | Promise<void> depending on state)
  const wrapRehydrate = (fn: () => void | Promise<void>): (() => Promise<void>) => {
    return async () => {
      await fn()
    }
  }

  // Core stores (highest priority - other stores may depend on these)
  registerStore({
    name: "workspace",
    rehydrate: wrapRehydrate(() => useWorkspaceStoreBase.persist.rehydrate()),
    hasHydrated: () => useWorkspaceStoreBase.persist.hasHydrated(),
    priority: 10,
  })

  registerStore({
    name: "session",
    rehydrate: wrapRehydrate(() => useSessionStoreBase.persist.rehydrate()),
    hasHydrated: () => useSessionStoreBase.persist.hasHydrated(),
    priority: 15,
  })

  // Data stores (medium-high priority)
  registerStore({
    name: "message",
    rehydrate: wrapRehydrate(() => useMessageStore.persist.rehydrate()),
    hasHydrated: () => useMessageStore.persist.hasHydrated(),
    priority: 20,
  })

  registerStore({
    name: "tab",
    rehydrate: wrapRehydrate(() => useTabStore.persist.rehydrate()),
    hasHydrated: () => useTabStore.persist.hasHydrated(),
    priority: 25,
  })

  registerStore({
    name: "llm",
    rehydrate: wrapRehydrate(() => useLLMStoreBase.persist.rehydrate()),
    hasHydrated: () => useLLMStoreBase.persist.hasHydrated(),
    priority: 30,
  })

  // UI preference stores (medium priority)
  registerStore({
    name: "debug",
    rehydrate: wrapRehydrate(() => useDebugStoreBase.persist.rehydrate()),
    hasHydrated: () => useDebugStoreBase.persist.hasHydrated(),
    priority: 50,
  })

  registerStore({
    name: "featureFlag",
    rehydrate: wrapRehydrate(() => useFeatureFlagStoreBase.persist.rehydrate()),
    hasHydrated: () => useFeatureFlagStoreBase.persist.hasHydrated(),
    priority: 55,
  })

  registerStore({
    name: "goal",
    rehydrate: wrapRehydrate(() => useGoalStoreBase.persist.rehydrate()),
    hasHydrated: () => useGoalStoreBase.persist.hasHydrated(),
    priority: 60,
  })

  // Low priority stores (deploy, onboarding - not needed for chat)
  registerStore({
    name: "deploy",
    rehydrate: wrapRehydrate(() => useDeployStoreBase.persist.rehydrate()),
    hasHydrated: () => useDeployStoreBase.persist.hasHydrated(),
    priority: 100,
  })

  registerStore({
    name: "onboarding",
    rehydrate: wrapRehydrate(() => useOnboardingStoreBase.persist.rehydrate()),
    hasHydrated: () => useOnboardingStoreBase.persist.hasHydrated(),
    priority: 105,
  })

  console.log("[StoreRegistrations] All 10 stores registered for coordinated hydration")
}

// Auto-register when this module is imported
registerAllStores()

// Export for explicit initialization if needed
export { registerAllStores }
