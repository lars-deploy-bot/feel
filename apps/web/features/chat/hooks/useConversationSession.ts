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
  const { initConversation, newConversation, updateActivity } = useSessionActions()
  const prevWorkspaceRef = useRef<string | null>(null)

  // Initialize synchronously with fallback UUID to prevent race conditions
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID())

  // Update conversation when workspace changes (after mount)
  useEffect(() => {
    if (!workspace || !mounted) return

    // Only update if workspace actually changed
    if (prevWorkspaceRef.current === workspace) return

    const id = initConversation(workspace)
    setConversationId(id)
    prevWorkspaceRef.current = workspace
  }, [workspace, mounted, initConversation])

  // Start new conversation (clears session)
  const startNewConversation = () => {
    if (!workspace) return ""

    const newId = newConversation(workspace)
    setConversationId(newId)
    return newId
  }

  return {
    conversationId,
    startNewConversation,
    markActivity: updateActivity,
  }
}
