import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { isTerminalMode } from "@/features/workspace/types/workspace"

interface WorkspaceState {
  workspace: string
  isTerminal: boolean
  mounted: boolean
}

interface UseWorkspaceOptions {
  redirectOnMissing?: string
}

interface UseWorkspaceReturn extends WorkspaceState {
  setWorkspace: (workspace: string) => void
}

export function useWorkspace(options: UseWorkspaceOptions = {}): UseWorkspaceReturn {
  const { redirectOnMissing = "/workspace" } = options
  const router = useRouter()
  const [state, setState] = useState<WorkspaceState>({
    workspace: "",
    isTerminal: false,
    mounted: false,
  })

  useEffect(() => {
    const terminal = isTerminalMode(window.location.hostname)
    let workspace = ""

    if (terminal) {
      const savedWorkspace = sessionStorage.getItem("workspace")
      if (savedWorkspace) {
        workspace = savedWorkspace
      } else {
        router.push(redirectOnMissing)
        return
      }
    }

    setState({ mounted: true, isTerminal: terminal, workspace })
  }, [router, redirectOnMissing])

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
