import { useRouter } from "next/navigation"
import { useCallback, useEffect } from "react"
import { useCurrentWorkspace, useHasHydrated, useWorkspaceActions } from "@/lib/stores/workspaceStore"

interface UseWorkspaceOptions {
  redirectOnMissing?: string | null
  allowEmpty?: boolean
}

interface UseWorkspaceReturn {
  workspace: string | null
  isTerminal: boolean
  mounted: boolean
  setWorkspace: (workspace: string, orgId?: string) => void
}

/**
 * Hook for accessing and managing the current workspace.
 *
 * Uses the workspaceStore as the single source of truth.
 * The workspace is persisted to localStorage and survives browser restarts.
 */
export function useWorkspace(options: UseWorkspaceOptions = {}): UseWorkspaceReturn {
  const { redirectOnMissing = "/", allowEmpty = false } = options
  const router = useRouter()

  // Read from store (single source of truth)
  const workspace = useCurrentWorkspace()
  const hasHydrated = useHasHydrated()
  const { setCurrentWorkspace } = useWorkspaceActions()

  // Derive mounted directly from hasHydrated - no extra state/render cycle
  const mounted = hasHydrated

  // Handle redirect separately (side effect only)
  useEffect(() => {
    if (!hasHydrated) return
    if (!workspace && !allowEmpty && redirectOnMissing) {
      router.push(redirectOnMissing)
    }
  }, [hasHydrated, workspace, allowEmpty, redirectOnMissing, router])

  const setWorkspace = useCallback(
    (newWorkspace: string, orgId?: string) => {
      setCurrentWorkspace(newWorkspace, orgId)
    },
    [setCurrentWorkspace],
  )

  return {
    workspace,
    isTerminal: true, // Always terminal mode now
    mounted,
    setWorkspace,
  }
}
