"use client"
import { useCallback, useState } from "react"
import { type WorkbenchView, useWorkbenchContext } from "@/features/chat/lib/workbench-context"

/**
 * Persist view-specific state through the workbench context.
 * State survives view switches (component unmount/remount) because it's stored
 * in the workbench provider, not in the component's local state.
 *
 * The `viewName` parameter is typed as `WorkbenchView` — only registered view names are valid.
 * The state type `T` is inferred from `defaultState`, so the returned state and setter are fully typed.
 *
 * @param viewName - Must be a valid WorkbenchView (compiler-enforced, no typos)
 * @param defaultState - Initial state when no persisted state exists — its type becomes T
 *
 * @example
 * const [state, setState] = useViewState("drive", { selectedFile: null as string | null, treeWidth: 240 })
 * // state is typed as { selectedFile: string | null; treeWidth: number }
 * // setState only accepts that shape
 */
export function useViewState<T>(viewName: WorkbenchView, defaultState: T): [T, (update: T | ((prev: T) => T)) => void] {
  const { getViewState, setViewState } = useWorkbenchContext()

  const [state, setLocalState] = useState<T>(() => getViewState<T>(viewName) ?? defaultState)

  const setState = useCallback(
    (update: T | ((prev: T) => T)) => {
      setLocalState(prev => {
        const next = typeof update === "function" ? (update as (prev: T) => T)(prev) : update
        setViewState(viewName, next)
        return next
      })
    },
    [viewName, setViewState],
  )

  return [state, setState]
}
