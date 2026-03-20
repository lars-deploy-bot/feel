"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface OnboardingActions {
  setSiteIdea: (idea: string) => void
  setTemplateId: (templateId: string | null) => void
  reset: () => void
}

interface OnboardingState {
  // User selections
  siteIdea: string
  templateId: string | null

  // Stable actions object (never changes identity)
  actions: OnboardingActions
}

const initialState: Pick<OnboardingState, "siteIdea" | "templateId"> = {
  siteIdea: "",
  templateId: null,
}

/**
 * Onboarding Store - User selections during site creation flow.
 *
 * skipHydration: true - Prevents automatic hydration on store creation.
 * Hydration is coordinated by HydrationManager to ensure all stores
 * hydrate together, eliminating race conditions in E2E tests.
 */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    set => ({
      ...initialState,

      actions: {
        setSiteIdea: (idea: string) => set({ siteIdea: idea }),
        setTemplateId: (templateId: string | null) => set({ templateId }),
        reset: () => set(initialState),
      },
    }),
    {
      name: "onboarding-storage",
      skipHydration: true,
      partialize: state => ({ siteIdea: state.siteIdea, templateId: state.templateId }),
    },
  ),
)

// Atomic selector hooks
export const useSiteIdea = () => useOnboardingStore(state => state.siteIdea)
export const useTemplateId = () => useOnboardingStore(state => state.templateId)
export const useOnboardingActions = () => useOnboardingStore(state => state.actions)
