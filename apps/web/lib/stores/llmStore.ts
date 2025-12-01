"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { CLAUDE_MODELS, type ClaudeModel, DEFAULT_MODEL, isValidClaudeModel } from "@/lib/models/claude-models"
import { validateApiKey } from "@/lib/utils/api-key-validation"
import { secureStorage } from "@/lib/utils/secure-storage"

export { CLAUDE_MODELS, DEFAULT_MODEL, type ClaudeModel }

interface LLMState {
  apiKey: string | null
  model: ClaudeModel
  error: string | null
}

// Actions interface - grouped under stable object (Guide §14.3)
interface LLMActions {
  actions: {
    setApiKey: (key: string | null) => void
    setModel: (model: ClaudeModel) => void
    setError: (error: string | null) => void
    clearApiKey: () => void
  }
}

// Extended type for backwards compatibility
type LLMStoreWithCompat = LLMState &
  LLMActions & {
    // Legacy direct action exports for backwards compatibility
    setApiKey: (key: string | null) => void
    setModel: (model: ClaudeModel) => void
    setError: (error: string | null) => void
    clearApiKey: () => void
  }

export type LLMStore = LLMStoreWithCompat

const API_KEY_STORAGE_KEY = "llm-api-key-obf"

/**
 * Persist API key to secure storage
 * Separated from store for better testability
 */
function persistApiKey(key: string): void {
  secureStorage.setItem(API_KEY_STORAGE_KEY, key)
}

/**
 * Remove API key from secure storage
 */
function removeApiKey(): void {
  secureStorage.removeItem(API_KEY_STORAGE_KEY)
}

/**
 * Load API key from secure storage
 */
function loadApiKey(): string | null {
  return secureStorage.getItem(API_KEY_STORAGE_KEY)
}

const useLLMStoreBase = create<LLMStore>()(
  persist(
    set => {
      const actions = {
        setApiKey: (key: string | null) => {
          // Handle clearing
          if (!key) {
            try {
              removeApiKey()
              set({ apiKey: null, error: null })
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Failed to clear API key"
              set({ error: errorMessage })
            }
            return
          }

          // Validate key
          const validation = validateApiKey(key)
          if (!validation.valid) {
            set({ error: validation.error ?? "Invalid API key", apiKey: null })
            return
          }

          // Persist and update state
          try {
            persistApiKey(key)
            set({ apiKey: key, error: null })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to save API key"
            set({ error: errorMessage })
          }
        },

        setModel: (model: ClaudeModel) => {
          set({ model, error: null })
        },

        setError: (error: string | null) => {
          set({ error })
        },

        clearApiKey: () => {
          try {
            removeApiKey()
            set({ apiKey: null, error: null })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to clear API key"
            set({ error: errorMessage })
          }
        },
      }

      return {
        apiKey: null,
        model: DEFAULT_MODEL, // Default model for credit users
        error: null,
        actions,
        // Legacy direct exports for backwards compatibility
        ...actions,
      }
    },
    {
      name: "llm-config",
      partialize: state => ({ model: state.model }),
      onRehydrateStorage: () => state => {
        if (!state) return

        // Validate persisted model and reset to default if invalid
        if (!isValidClaudeModel(state.model)) {
          console.warn(`Invalid model "${state.model}", resetting to default`)
          state.model = DEFAULT_MODEL
        }

        // Load API key from secure storage
        // Note: Model enforcement is handled by the backend (unrestricted users can choose any model)
        try {
          state.apiKey = loadApiKey()
        } catch (error) {
          console.error("Failed to load API key:", error)
          state.apiKey = null
        }
      },
    },
  ),
)

// Atomic selector: API key (Guide §14.1)
export const useApiKey = () => useLLMStoreBase(state => state.apiKey)

// Atomic selector: model selection (Guide §14.1)
export const useModel = () => useLLMStoreBase(state => state.model)

// Atomic selector: error state (Guide §14.1)
export const useLLMError = () => useLLMStoreBase(state => state.error)

// Actions hook - stable reference (Guide §14.3)
export const useLLMActions = () => useLLMStoreBase(state => state.actions)

// Legacy export for backwards compatibility
export const useLLMStore = useLLMStoreBase
