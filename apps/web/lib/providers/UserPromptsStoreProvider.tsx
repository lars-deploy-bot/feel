"use client"

import { createContext, type ReactNode, useContext, useRef } from "react"
import { useStore } from "zustand"
import { createUserPromptsStore, type UserPromptsState, type UserPromptsStore } from "@/lib/stores/userPromptsStore"

export type UserPromptsStoreApi = ReturnType<typeof createUserPromptsStore>

const UserPromptsStoreContext = createContext<UserPromptsStoreApi | undefined>(undefined)

export interface UserPromptsStoreProviderProps {
  children: ReactNode
  /** Initial state (SSR-safe) */
  initialState?: Partial<UserPromptsState>
}

export function UserPromptsStoreProvider({ children, initialState }: UserPromptsStoreProviderProps) {
  const storeRef = useRef<UserPromptsStoreApi | undefined>(undefined)

  if (!storeRef.current) {
    storeRef.current = createUserPromptsStore({
      ...initialState,
    } as UserPromptsState)
  }

  return <UserPromptsStoreContext.Provider value={storeRef.current}>{children}</UserPromptsStoreContext.Provider>
}

export function useUserPromptsStore<T>(selector: (store: UserPromptsStore) => T): T {
  const ctx = useContext(UserPromptsStoreContext)
  if (!ctx) throw new Error("useUserPromptsStore must be used within UserPromptsStoreProvider")
  return useStore(ctx, selector)
}

// ============================================================================
// Atomic selector hooks (follow Zustand best practices)
// ============================================================================

/** All prompts */
export const useUserPrompts = () => useUserPromptsStore(s => s.prompts ?? [])

/** All actions (stable reference - won't cause re-renders) */
export const useUserPromptsActions = () => useUserPromptsStore(s => s.actions)
