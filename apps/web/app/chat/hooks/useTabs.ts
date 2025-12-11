"use client"

import { useEffect, useMemo } from "react"
import { useTabs as useTabsStore, useActiveTab, useTabsExpanded, useTabActions } from "@/lib/stores/tabStore"

interface UseTabsOptions {
  workspace: string | null
  conversationId: string | null
  onSwitchConversation: (id: string) => void
  onInitializeConversation: (id: string, workspace: string) => void
}

// Helper to generate unique conversation IDs
const generateConvoId = () => `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Custom hook for managing conversation tabs
 * Handles tab creation, selection, closing, renaming, and syncing with conversations
 */
export function useTabsManagement({
  workspace,
  conversationId,
  onSwitchConversation,
  onInitializeConversation,
}: UseTabsOptions) {
  const tabs = useTabsStore(workspace)
  const activeTab = useActiveTab(workspace)
  const tabsExpanded = useTabsExpanded(workspace)
  const actions = useTabActions()

  // Create workspace-bound handlers
  const handlers = useMemo(() => {
    if (!workspace) {
      return {
        handleAddTab: () => {},
        handleTabSelect: (_: string) => {},
        handleTabClose: (_: string) => {},
        handleTabRename: (_: string, __: string) => {},
        handleToggleTabs: () => {},
      }
    }

    return {
      handleAddTab: () => {
        const newConvoId = generateConvoId()
        const tab = actions.addTab(workspace, newConvoId)
        if (tab) onInitializeConversation(newConvoId, workspace)
      },
      handleTabSelect: (tabId: string) => {
        const tab = tabs.find(t => t.id === tabId)
        if (tab) {
          actions.setActiveTab(workspace, tabId)
          onSwitchConversation(tab.conversationId)
        }
      },
      handleTabClose: (tabId: string) => actions.removeTab(workspace, tabId),
      handleTabRename: (tabId: string, name: string) => actions.renameTab(workspace, tabId, name),
      handleToggleTabs: () => actions.toggleTabsExpanded(workspace),
    }
  }, [workspace, tabs, actions, onSwitchConversation, onInitializeConversation])

  // Sync tab's conversation when conversation changes
  useEffect(() => {
    if (workspace && activeTab && conversationId && activeTab.conversationId !== conversationId) {
      actions.updateTabConversation(workspace, activeTab.id, conversationId)
    }
  }, [workspace, activeTab, conversationId, actions])

  return {
    tabs,
    activeTab,
    tabsExpanded,
    ...handlers,
  }
}
