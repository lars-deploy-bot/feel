import { useEffect, useRef, useState } from "react"
import { useSessionActions } from "@/lib/stores/sessionStore"

/**
 * Custom hook for managing tab sessions with workspace-scoped persistence
 *
 * Handles:
 * - Automatic session resumption on workspace change
 * - Activity tracking
 * - New session creation
 *
 * @param workspace - Current workspace identifier
 * @param mounted - Whether workspace is initialized (from useWorkspace)
 * @returns sessionId (Claude SDK session key) and control functions
 */
export function useConversationSession(workspace: string | null, mounted: boolean) {
  const { initSession, newSession, switchToSession } = useSessionActions()
  const prevWorkspaceRef = useRef<string | null>(null)

  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())

  useEffect(() => {
    if (!workspace || !mounted) return

    // Skip if workspace hasn't changed
    if (prevWorkspaceRef.current === workspace) return

    console.log(`[useConversationSession] Workspace changed: ${prevWorkspaceRef.current} → ${workspace}`)

    const id = initSession(workspace)
    console.log(`[useConversationSession] SessionId for workspace "${workspace}": ${id}`)

    setSessionId(id)
    prevWorkspaceRef.current = workspace
  }, [workspace, mounted, initSession])

  const startNewSession = () => {
    if (!workspace) return ""

    const newId = newSession(workspace)
    setSessionId(newId)
    return newId
  }

  const switchSession = (id: string) => {
    if (!workspace) return

    switchToSession(id, workspace)
    setSessionId(id)
  }

  return {
    sessionId,
    startNewSession,
    switchSession,
  }
}
