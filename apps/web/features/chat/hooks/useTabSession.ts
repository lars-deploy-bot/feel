import { useEffect, useRef, useState } from "react"
import { useSessionActions } from "@/lib/stores/sessionStore"

/**
 * Custom hook for managing tab sessions with workspace-scoped persistence
 *
 * Handles:
 * - Automatic session resumption on workspace change
 * - Activity tracking
 * - New tab session creation
 *
 * Note: The session store persists conversationIds internally, but this hook
 * returns them as `tabId` since they serve as the Claude SDK session key (resume parameter).
 *
 * @param workspace - Current workspace identifier
 * @param mounted - Whether workspace is initialized (from useWorkspace)
 * @returns tabId and control functions
 */
export function useTabSession(workspace: string | null, mounted: boolean) {
  const { initConversation, newConversation, switchToConversation } = useSessionActions()
  const prevWorkspaceRef = useRef<string | null>(null)

  const [tabId, setTabId] = useState<string>(() => crypto.randomUUID())

  useEffect(() => {
    if (!workspace || !mounted) return

    // Skip if workspace hasn't changed
    if (prevWorkspaceRef.current === workspace) return

    console.log(`[useTabSession] Workspace changed: ${prevWorkspaceRef.current} → ${workspace}`)

    const id = initConversation(workspace)
    console.log(`[useTabSession] TabId for workspace "${workspace}": ${id}`)

    setTabId(id)
    prevWorkspaceRef.current = workspace
  }, [workspace, mounted, initConversation])

  const startNewTab = () => {
    if (!workspace) return ""

    const newId = newConversation(workspace)
    setTabId(newId)
    return newId
  }

  const switchTab = (id: string) => {
    if (!workspace) return

    switchToConversation(id, workspace)
    setTabId(id)
  }

  return {
    tabId,
    startNewTab,
    switchTab,
  }
}
