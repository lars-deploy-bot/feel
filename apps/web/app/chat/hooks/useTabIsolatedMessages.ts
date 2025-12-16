"use client"

import { useActiveTab, useTabsExpanded } from "@/lib/stores/tabStore"
import { useCurrentConversationId, useMessages, useMessagesForConversation } from "@/lib/stores/messageStore"
import { useIsStreamActive } from "@/lib/stores/streamingStore"

interface UseTabIsolatedMessagesOptions {
  workspace: string | null
  showTabs: boolean
}

/**
 * Hook for tab-isolated message display
 *
 * Handles the complexity of determining which conversation's messages to show:
 * - When tabs are expanded: shows the active tab's conversation messages
 * - When tabs are collapsed: shows the globally active conversation messages
 *
 * Also scopes the busy (streaming) state to the displayed conversation.
 */
export function useTabIsolatedMessages({ workspace, showTabs }: UseTabIsolatedMessagesOptions) {
  // Get tab state
  const activeTab = useActiveTab(workspace)
  const tabsExpanded = useTabsExpanded(workspace)

  // Get store's global conversation state (fallback when tabs not active)
  const storeConversationId = useCurrentConversationId()
  const defaultMessages = useMessages()

  // Determine which conversation to display
  const isTabMode = showTabs && tabsExpanded && activeTab
  const displayConversationId = isTabMode ? activeTab.conversationId : storeConversationId

  // Get messages for the display conversation
  const tabMessages = useMessagesForConversation(displayConversationId)
  const messages = isTabMode ? tabMessages : defaultMessages

  // Scope busy state to the display conversation
  const busy = useIsStreamActive(displayConversationId)

  return {
    messages,
    busy,
    displayConversationId,
    /** Whether currently in tab isolation mode */
    isTabMode,
  }
}
