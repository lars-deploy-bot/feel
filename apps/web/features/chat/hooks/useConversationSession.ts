import { useEffect, useRef, useState } from "react"
import { useSessionActions } from "@/lib/stores/sessionStore"

/**
 * Custom hook for managing conversation sessions with workspace-scoped persistence
 *
 * Handles:
 * - Automatic session resumption on workspace change
 * - Activity tracking
 * - New conversation creation
 *
 * @param workspace - Current workspace identifier
 * @param mounted - Whether workspace is initialized (from useWorkspace)
 * @returns conversationId and control functions
 */
export function useConversationSession(workspace: string | null, mounted: boolean) {
  const { initConversation, newConversation, switchToConversation } = useSessionActions()
  const prevWorkspaceRef = useRef<string | null>(null)

  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID())

  useEffect(() => {
    if (!workspace || !mounted) return

    if (prevWorkspaceRef.current === workspace) return

    const id = initConversation(workspace)
    setConversationId(id)
    prevWorkspaceRef.current = workspace
  }, [workspace, mounted, initConversation])

  const startNewConversation = () => {
    if (!workspace) return ""

    const newId = newConversation(workspace)
    setConversationId(newId)
    return newId
  }

  const switchConversation = (id: string) => {
    if (!workspace) return

    switchToConversation(id, workspace)
    setConversationId(id)
  }

  return {
    conversationId,
    startNewConversation,
    switchConversation,
  }
}
