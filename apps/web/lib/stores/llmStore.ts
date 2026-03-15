"use client"

import {
  type ClaudeModel,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_VOICE_LANGUAGE,
  isValidClaudeModel,
  isValidVoiceLanguage,
  type VoiceLanguage,
} from "@webalive/shared"
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface LLMState {
  model: ClaudeModel
  /** ISO 639-1 language code for voice transcription and Claude responses */
  voiceLanguage: VoiceLanguage
  /** Tab ID where voice was last used (null = no pending voice input). Not persisted. */
  voiceUsedTabId: string | null
}

// Actions interface - grouped under stable object (Guide §14.3)
interface LLMActions {
  actions: {
    setModel: (model: ClaudeModel) => void
    setVoiceLanguage: (lang: VoiceLanguage) => void
    /** Mark that voice input was used for a specific tab */
    markVoiceUsed: (tabId: string) => void
    /** Clear the voice-used flag (e.g. when user types manually) */
    clearVoiceUsed: () => void
    /** Consume the voiceUsed flag for a tab (reads + resets). Returns true if voice was used on that tab. */
    consumeVoiceUsed: (tabId: string) => boolean
  }
}

export type LLMStore = LLMState & LLMActions

const useLLMStoreBase = create<LLMStore>()(
  persist(
    (set, get) => {
      const actions = {
        setModel: (model: ClaudeModel) => {
          set({ model })
        },
        setVoiceLanguage: (voiceLanguage: VoiceLanguage) => {
          set({ voiceLanguage })
        },
        markVoiceUsed: (tabId: string) => {
          set({ voiceUsedTabId: tabId })
        },
        clearVoiceUsed: () => {
          set({ voiceUsedTabId: null })
        },
        consumeVoiceUsed: (tabId: string): boolean => {
          const was = get().voiceUsedTabId === tabId
          if (was) set({ voiceUsedTabId: null })
          return was
        },
      }

      return {
        model: DEFAULT_CLAUDE_MODEL,
        voiceLanguage: DEFAULT_VOICE_LANGUAGE,
        voiceUsedTabId: null,
        actions,
      }
    },
    {
      name: "llm-config",
      /**
       * skipHydration: true - Prevents automatic hydration on store creation
       *
       * HydrationManager calls rehydrate() for all persisted stores together,
       * ensuring coordinated hydration and eliminating race conditions.
       *
       * @see HydrationBoundary.tsx
       */
      skipHydration: true,
      partialize: state => ({ model: state.model, voiceLanguage: state.voiceLanguage }),
      // onRehydrateStorage: validate persisted values after hydration.
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error("[LLMStore] Hydration error:", error)
          return
        }

        // Use setState for post-hydration modifications (not direct mutation)
        const currentState = useLLMStoreBase.getState()

        // Validate persisted model and reset to default if invalid
        let model = currentState.model
        if (!isValidClaudeModel(model)) {
          console.warn(`[LLMStore] Invalid model "${model}", resetting to default`)
          model = DEFAULT_CLAUDE_MODEL
        }

        // Validate persisted voiceLanguage and reset to default if invalid
        let voiceLanguage = currentState.voiceLanguage
        if (!isValidVoiceLanguage(voiceLanguage)) {
          console.warn(`[LLMStore] Invalid voiceLanguage "${voiceLanguage}", resetting to default`)
          voiceLanguage = DEFAULT_VOICE_LANGUAGE
        }

        // Atomic state update via setState (not mutation)
        useLLMStoreBase.setState({ model, voiceLanguage })
      },
    },
  ),
)

// Export base store for HydrationManager (needs access to persist.rehydrate())
export { useLLMStoreBase }

// Atomic selectors (Guide §14.1)
export const useModel = () => useLLMStoreBase(state => state.model)
export const useVoiceLanguage = () => useLLMStoreBase(state => state.voiceLanguage)

// Actions hook - stable reference (Guide §14.3)
export const useLLMActions = () => useLLMStoreBase(state => state.actions)

// Combined hook for components that need multiple values
// Returns flattened object with state + actions for convenience
export const useLLMStore = () => {
  const model = useLLMStoreBase(state => state.model)
  const actions = useLLMStoreBase(state => state.actions)

  return {
    model,
    ...actions,
  }
}

// Direct store access for getState() calls
useLLMStore.getState = () => {
  const state = useLLMStoreBase.getState()
  return {
    ...state,
    ...state.actions,
  }
}
