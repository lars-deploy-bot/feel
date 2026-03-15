"use client"
import { useEffect } from "react"
import { useWorkbenchContext, type WorkbenchShortcut } from "@/features/chat/lib/workbench-context"

/**
 * Register keyboard shortcuts scoped to the workbench.
 * Shortcuts auto-unregister when the component unmounts (i.e., when the view switches away),
 * so only the active view's shortcuts fire.
 *
 * @example
 * useWorkbenchShortcuts([
 *   { id: "myview-escape", key: "Escape", handler: () => closePanel() },
 *   { id: "myview-save", key: "s", ctrlOrMeta: true, handler: (e) => { e.preventDefault(); save() } },
 * ])
 */
export function useWorkbenchShortcuts(shortcuts: WorkbenchShortcut[]) {
  const { registerShortcuts } = useWorkbenchContext()

  useEffect(() => {
    if (shortcuts.length === 0) return
    return registerShortcuts(shortcuts)
    // Re-register when shortcut handlers change — callers should memoize handlers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerShortcuts, ...shortcuts.map(s => s.handler)])
}
