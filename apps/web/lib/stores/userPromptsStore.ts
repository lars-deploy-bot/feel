import { createJSONStorage, persist } from "zustand/middleware"
import { createStore } from "zustand/vanilla"
import { ORGANIZE_PROMPT_DEFAULT, REVISE_PROMPT_DEFAULT } from "./userPromptsDefaults"

/**
 * User Prompts Store - Manage saved user prompts
 *
 * Uses vanilla store pattern for SSR-safety with Provider initialization
 * Persists prompts to localStorage
 */

export interface UserPrompt {
  id: string
  promptType: string // e.g., "revise-code", "organize-code"
  data: string // The actual prompt text (sent to Claude SDK)
  displayName: string // e.g., "Revise Code", "Organize Code"
  userFacingDescription?: string // Short description shown to user in UI (instead of full prompt)
  createdAt: number
}

export interface UserPromptsState {
  prompts: UserPrompt[]
}

export interface UserPromptsActions {
  addPrompt: (promptType: string, data: string, displayName: string, userFacingDescription?: string) => void
  updatePrompt: (id: string, data: string, displayName: string, userFacingDescription?: string) => void
  removePrompt: (id: string) => void
  reset: () => void
}

export type UserPromptsStore = UserPromptsState & { actions: UserPromptsActions }

// Default prompts
const defaultPrompts: UserPrompt[] = [
  {
    id: "default-revise",
    promptType: "revise-code",
    data: REVISE_PROMPT_DEFAULT.data,
    displayName: "Revise Code",
    userFacingDescription: REVISE_PROMPT_DEFAULT.userFacingDescription,
    createdAt: Date.now(),
  },
  {
    id: "default-organize",
    promptType: "organize-code",
    data: ORGANIZE_PROMPT_DEFAULT.data,
    displayName: "Organize Code",
    userFacingDescription: ORGANIZE_PROMPT_DEFAULT.userFacingDescription,
    createdAt: Date.now(),
  },
]

export const defaultInitState: UserPromptsState = {
  prompts: defaultPrompts,
}

export const createUserPromptsStore = (initState: UserPromptsState = defaultInitState) => {
  return createStore<UserPromptsStore>()(
    persist(
      set => ({
        // Ensure prompts is always an array (protect against corrupted localStorage)
        prompts: initState.prompts ?? defaultPrompts,
        actions: {
          addPrompt: (promptType: string, data: string, displayName: string, userFacingDescription?: string) => {
            const newPrompt: UserPrompt = {
              id: `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              promptType,
              data,
              displayName,
              userFacingDescription,
              createdAt: Date.now(),
            }
            set(state => ({
              prompts: [...state.prompts, newPrompt],
            }))
          },

          updatePrompt: (id: string, data: string, displayName: string, userFacingDescription?: string) => {
            set(state => ({
              prompts: state.prompts.map(prompt =>
                prompt.id === id ? { ...prompt, data, displayName, userFacingDescription } : prompt,
              ),
            }))
          },

          removePrompt: (id: string) => {
            set(state => ({
              prompts: state.prompts.filter(prompt => prompt.id !== id),
            }))
          },

          reset: () => {
            set(defaultInitState)
          },
        },
      }),
      {
        name: "user-prompts-store",
        storage: createJSONStorage(() => {
          // Client-only: localStorage
          if (typeof window === "undefined") return undefined as any
          return localStorage
        }),
      },
    ),
  )
}
