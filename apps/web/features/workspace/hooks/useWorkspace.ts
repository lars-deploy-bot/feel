import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

interface WorkspaceState {
  workspace: string | null
  isTerminal: boolean
  mounted: boolean
}

interface UseWorkspaceOptions {
  redirectOnMissing?: string | null
  allowEmpty?: boolean
}

interface UseWorkspaceReturn extends WorkspaceState {
  setWorkspace: (workspace: string) => void
}

export function useWorkspace(options: UseWorkspaceOptions = {}): UseWorkspaceReturn {
  const { redirectOnMissing = "/", allowEmpty = false } = options
  const router = useRouter()
  const [state, setState] = useState<WorkspaceState>({
    workspace: null,
    isTerminal: false,
    mounted: false,
  })

  useEffect(() => {
    // Always terminal mode
    const terminal = true
    let workspace: string | null = null

    const savedWorkspace = sessionStorage.getItem("workspace")
    if (savedWorkspace) {
      workspace = savedWorkspace
    } else if (!allowEmpty && redirectOnMissing) {
      router.push(redirectOnMissing)
      return
    }

    setState({ mounted: true, isTerminal: terminal, workspace })
  }, [router, redirectOnMissing, allowEmpty])

  const setWorkspace = useCallback(
    (workspace: string) => {
      setState(prev => {
        // Use prev state to avoid dependency on state
        if (prev.isTerminal) {
          sessionStorage.setItem("workspace", workspace)
        }
        return { ...prev, workspace }
      })
    },
    [], // No dependencies needed - uses prev state
  )

  return { ...state, setWorkspace }
}
