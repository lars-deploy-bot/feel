"use client"
import { useCallback, useState } from "react"
import { type ViewStateMap, useWorkbenchContext } from "@/features/chat/lib/workbench-context"

/**
 * Typed, persistent view state that survives view switches.
 *
 * - `value` — current state, fully typed from ViewStateMap
 * - `set(newValue)` — replace state with a direct value
 * - `update(fn)` — derive next state from previous (like React's functional setState)
 *
 * Two methods instead of one eliminates the `T | ((prev: T) => T)` union
 * that would require an `as` assertion to narrow.
 */
export interface ViewState<T> {
  readonly value: T
  set: (value: T) => void
  update: (fn: (prev: T) => T) => void
}

/**
 * Persist view-specific state through the workbench context.
 * State survives view switches (component unmount/remount) because it's stored
 * in the workbench provider, not in the component's local state.
 *
 * The `viewName` must be a key declared in `ViewStateMap` — the compiler
 * enforces both the key name and the state shape. No assertions anywhere.
 *
 * @param viewName - Must be a key in ViewStateMap (compiler-enforced)
 * @param defaultState - Initial state when no persisted state exists
 *
 * @example
 * // 1. In workbench-context.tsx, declare the shape:
 * //    export interface ViewStateMap { drive: { selectedFile: string | null } }
 * //
 * // 2. In the view component:
 * const driveState = useViewState("drive", { selectedFile: null })
 * driveState.value.selectedFile  // string | null
 * driveState.set({ selectedFile: "foo.ts" })
 * driveState.update(prev => ({ ...prev, selectedFile: null }))
 */
export function useViewState<K extends keyof ViewStateMap>(
  viewName: K,
  defaultState: ViewStateMap[K],
): ViewState<ViewStateMap[K]> {
  const { viewStatesRef } = useWorkbenchContext()

  const [value, setLocal] = useState<ViewStateMap[K]>(() => viewStatesRef.current[viewName] ?? defaultState)

  const set = useCallback(
    (next: ViewStateMap[K]) => {
      viewStatesRef.current[viewName] = next
      setLocal(() => next)
    },
    [viewName, viewStatesRef],
  )

  const update = useCallback(
    (fn: (prev: ViewStateMap[K]) => ViewStateMap[K]) => {
      setLocal(prev => {
        const next = fn(prev)
        viewStatesRef.current[viewName] = next
        return next
      })
    },
    [viewName, viewStatesRef],
  )

  return { value, set, update }
}
