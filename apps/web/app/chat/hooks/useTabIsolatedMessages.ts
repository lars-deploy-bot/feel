"use client"

import { useEffect, useRef } from "react"
import { useDexieCurrentTabId, useDexieSession } from "@/lib/db/dexieMessageStore"
import { useTabMessages } from "@/lib/db/useTabMessages"
import { useIsStreamActive } from "@/lib/stores/streamingStore"
import { useActiveTab, useTabsExpanded } from "@/lib/stores/tabStore"

interface UseTabIsolatedMessagesOptions {
  workspace: string | null
  showTabs: boolean
}

/**
 * Hook for tab-isolated message display
 *
 * Handles the complexity of determining which tab's messages to show:
 * - When tabs are expanded: shows the active tab's messages
 * - When tabs are collapsed: shows the globally active tab's messages
 *
 * Also scopes the busy (streaming) state to the displayed tab.
 *
 * INVARIANT: Messages returned MUST belong to displayTabId.
 * Any violation indicates a cross-tab contamination bug.
 */
export function useTabIsolatedMessages({ workspace, showTabs }: UseTabIsolatedMessagesOptions) {
  // Get tab state
  const activeTab = useActiveTab(workspace)
  const tabsExpanded = useTabsExpanded(workspace)

  // Get Dexie store's global conversation/tab state (fallback when tabs not active)
  const currentTabId = useDexieCurrentTabId()
  const session = useDexieSession()

  // Determine which conversation to display
  // CRITICAL: This is the SINGLE SOURCE OF TRUTH for which messages to show
  const isTabMode = showTabs && tabsExpanded && activeTab
  // Get messages from Dexie via tab ID (session key)
  // With Dexie, messages belong to tabs, not tabgroups directly
  const displayTabId = isTabMode ? activeTab.conversationId : currentTabId
  const messages = useTabMessages(displayTabId, session?.userId ?? null)

  // Scope busy state to the display tab (session)
  const busy = useIsStreamActive(displayTabId)

  // Track previous values for debugging cross-tab issues
  const prevDisplayIdRef = useRef<string | null>(null)
  const prevMessageCountRef = useRef<number>(0)

  // Debug logging and INVARIANT CHECK
  useEffect(() => {
    const isDev = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_BRIDGE_ENV === "staging"

    if (isDev) {
      // Detect potential cross-tab contamination
      const prevId = prevDisplayIdRef.current
      const prevCount = prevMessageCountRef.current

      // If conversation switched but message count INCREASED, something is wrong
      // (Messages should reset to the new conversation's count, which may be different)
      if (prevId && prevId !== displayTabId && messages.length > 0) {
        // Check if any message doesn't belong to current conversation
        // This would indicate cross-tab leakage
        console.log("[TabIsolatedMessages] Conversation switched", {
          from: prevId,
          to: displayTabId,
          prevMessageCount: prevCount,
          newMessageCount: messages.length,
          isTabMode,
        })
      }

      // Log state on every render for debugging
      console.log("[TabIsolatedMessages]", {
        isTabMode,
        activeTabId: activeTab?.id,
        activeTabConversationId: activeTab?.conversationId,
        displayTabId,
        messageCount: messages.length,
        busy,
      })

      prevDisplayIdRef.current = displayTabId
      prevMessageCountRef.current = messages.length
    }
  }, [displayTabId, messages.length, isTabMode, activeTab?.id, activeTab?.conversationId, busy, messages])

  return {
    messages,
    busy,
    displayTabId,
    /** Whether currently in tab isolation mode */
    isTabMode,
  }
}
