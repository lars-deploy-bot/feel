"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface OnboardingState {
  // User selections
  siteIdea: string
  selectedTemplate: "landing" | "recipe" | null

  // Actions
  setSiteIdea: (idea: string) => void
  setSelectedTemplate: (template: "landing" | "recipe" | null) => void
  reset: () => void
}

const initialState = {
  siteIdea: "",
  selectedTemplate: null as "landing" | "recipe" | null,
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    set => ({
      ...initialState,

      setSiteIdea: (idea: string) => set({ siteIdea: idea }),
      setSelectedTemplate: (template: "landing" | "recipe" | null) => set({ selectedTemplate: template }),
      reset: () => set(initialState),
    }),
    {
      name: "onboarding-storage",
    },
  ),
)

// Atomic selector hooks
export const useSiteIdea = () => useOnboardingStore(state => state.siteIdea)
export const useSelectedTemplate = () => useOnboardingStore(state => state.selectedTemplate)
export const useOnboardingActions = () =>
  useOnboardingStore(state => ({
    setSiteIdea: state.setSiteIdea,
    setSelectedTemplate: state.setSelectedTemplate,
    reset: state.reset,
  }))
