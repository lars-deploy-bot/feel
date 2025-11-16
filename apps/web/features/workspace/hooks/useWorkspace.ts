import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { isTerminalMode } from "@/features/workspace/types/workspace"

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
    const terminal = isTerminalMode(window.location.hostname)
    let workspace: string | null = null

    if (terminal) {
      const savedWorkspace = sessionStorage.getItem("workspace")
      if (savedWorkspace) {
        workspace = savedWorkspace
      } else if (!allowEmpty && redirectOnMissing) {
        router.push(redirectOnMissing)
        return
      }
    }

    setState({ mounted: true, isTerminal: terminal, workspace })
  }, [router, redirectOnMissing, allowEmpty])

  const setWorkspace = useCallback(
    (workspace: string) => {
      if (state.isTerminal) {
        sessionStorage.setItem("workspace", workspace)
      }
      setState(prev => ({ ...prev, workspace }))
    },
    [state.isTerminal],
  )

  return { ...state, setWorkspace }
}
