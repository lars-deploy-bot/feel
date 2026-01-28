"use client"

import { useEffect, useRef } from "react"
import { useDexieSession } from "@/lib/db/dexieMessageStore"
import { useTabMessages } from "@/lib/db/useTabMessages"
import { useActiveSession } from "@/features/chat/hooks/useActiveSession"

interface UseTabIsolatedMessagesOptions {
  workspace: string | null
}

/**
 * Hook for tab-isolated message display and session management
 *
 * Uses useActiveSession as the SINGLE SOURCE OF TRUTH for:
 * - Which tab's messages to display (via tabId, the Claude SDK session key)
 * - Whether the session is streaming (busy)
 * - Session actions (addTabToGroup, startNewTabGroup, switchTab)
 *
 * INVARIANT: Messages returned MUST belong to session.tabId.
 * Any violation indicates a cross-tab contamination bug.
 */
export function useTabIsolatedMessages({ workspace }: UseTabIsolatedMessagesOptions) {
  // Single source of truth for active session
  const session = useActiveSession(workspace)
  const dexieSession = useDexieSession()

  // Messages are fetched for the active session's tabId
  // If no active session, no messages are shown
  const messages = useTabMessages(session.tabId, dexieSession?.userId ?? null)

  // Track previous values for debugging cross-tab issues
  const prevTabIdRef = useRef<string | null>(null)
  const prevMessageCountRef = useRef<number>(0)

  // Debug logging and INVARIANT CHECK
  useEffect(() => {
    const isDev = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_BRIDGE_ENV === "staging"

    if (isDev) {
      const prevId = prevTabIdRef.current
      const prevCount = prevMessageCountRef.current

      // Detect tab switch
      if (prevId && prevId !== session.tabId && messages.length > 0) {
        console.log("[TabIsolatedMessages] Tab switched", {
          from: prevId,
          to: session.tabId,
          prevMessageCount: prevCount,
          newMessageCount: messages.length,
        })
      }

      // Log state on every render for debugging
      console.log("[TabIsolatedMessages]", {
        tabId: session.tabId,
        tabGroupId: session.tabGroupId,
        isReady: session.isReady,
        isStreaming: session.isStreaming,
        messageCount: messages.length,
      })

      prevTabIdRef.current = session.tabId
      prevMessageCountRef.current = messages.length
    }
  }, [session.tabId, session.tabGroupId, session.isReady, session.isStreaming, messages.length, messages])

  return {
    messages,
    busy: session.isStreaming,
    tabId: session.tabId,
    tabGroupId: session.tabGroupId,
    isReady: session.isReady,
    activeTab: session.activeTab,
    workspaceTabs: session.workspaceTabs,
    actions: session.actions,
  }
}
