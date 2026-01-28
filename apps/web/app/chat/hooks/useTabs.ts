"use client"

import { useEffect, useCallback, useRef } from "react"
import { useTabs, useActiveTab, useTabsExpanded, useTabActions } from "@/lib/stores/tabStore"
import { useStreamingActions, getAbortController, clearAbortController } from "@/lib/stores/streamingStore"

interface UseTabsOptions {
  workspace: string | null
  tabGroupId: string | null
  /** Active tab's conversation/session id */
  activeConversationId: string | null
  onSwitchConversation: (id: string) => void
  onInitializeTab: (conversationId: string, tabGroupId: string, workspace: string) => void
  onStartNewTab?: () => string
  /** Current input message - used to save draft on tab switch */
  currentInput?: string
  /** Callback to restore input when switching tabs */
  onInputRestore?: (input: string) => void
}

const genConvoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Hook for managing conversation tabs
 *
 * Each tab = one conversation. Switching tabs switches conversations.
 * Closed tabs are removed from the bar but conversations stay in sidebar history.
 */
export function useTabsManagement({
  workspace,
  tabGroupId,
  activeConversationId,
  onSwitchConversation,
  onInitializeTab,
  onStartNewTab,
  currentInput,
  onInputRestore,
}: UseTabsOptions) {
  const tabs = useTabs(workspace, tabGroupId)
  const activeTab = useActiveTab(workspace)
  const activeTabInGroup = tabs.find(t => t.id === activeTab?.id) ?? tabs[0] ?? null
  const tabsExpanded = useTabsExpanded(workspace)
  const {
    addTab,
    removeTab,
    setActiveTab,
    renameTab,
    toggleTabsExpanded,
    collapseTabsAndClear,
    openTabGroupInTab,
    setTabInputDraft,
  } = useTabActions()
  const streamingActions = useStreamingActions()

  // Workspace-scoped action wrapper
  const withWorkspace = useCallback(
    <T extends unknown[], R>(fn: (ws: string, ...args: T) => R) =>
      (...args: T): R | undefined =>
        workspace ? fn(workspace, ...args) : undefined,
    [workspace],
  )

  const handleAddTab = useCallback(() => {
    if (!workspace || !tabGroupId) return

    // Save current input to active tab before creating new tab
    if (activeTabInGroup && currentInput !== undefined) {
      setTabInputDraft(workspace, activeTabInGroup.id, currentInput)
    }

    const convoId = onStartNewTab?.() ?? genConvoId()
    console.log("[AddTab]", {
      previousActiveTabConversationId: activeTabInGroup?.conversationId,
      newConversationId: convoId,
      usingStartNewTab: !!onStartNewTab,
    })
    const tab = addTab(workspace, tabGroupId, convoId)
    if (tab) {
      onInitializeTab(convoId, tabGroupId, workspace)
      onSwitchConversation(convoId)
      // Clear input for new tab
      if (onInputRestore) {
        onInputRestore("")
      }
    }
  }, [
    workspace,
    tabGroupId,
    activeTabInGroup,
    currentInput,
    addTab,
    onStartNewTab,
    onInitializeTab,
    onSwitchConversation,
    setTabInputDraft,
    onInputRestore,
  ])

  const handleTabSelect = useCallback(
    (tabId: string) => {
      const tab = tabs.find(t => t.id === tabId)
      if (tab && workspace) {
        // Debug logging
        console.log("[TabSelect]", {
          fromTabId: activeTabInGroup?.id,
          fromConversationId: activeTabInGroup?.conversationId,
          toTabId: tab.id,
          toConversationId: tab.conversationId,
        })

        // Save current input to the previous tab before switching
        if (activeTabInGroup && currentInput !== undefined) {
          setTabInputDraft(workspace, activeTabInGroup.id, currentInput)
        }

        setActiveTab(workspace, tabId)
        onSwitchConversation(tab.conversationId)

        // Restore input from the new tab's draft
        if (onInputRestore) {
          onInputRestore(tab.inputDraft ?? "")
        }
      }
    },
    [
      tabs,
      workspace,
      activeTabInGroup,
      currentInput,
      setActiveTab,
      onSwitchConversation,
      setTabInputDraft,
      onInputRestore,
    ],
  )

  const handleTabClose = useCallback(
    (tabId: string) => {
      // Find the tab being closed to get its conversationId
      const closingTab = tabs.find(t => t.id === tabId)
      if (closingTab) {
        // Abort the HTTP request if there's an active stream
        const abortController = getAbortController(closingTab.conversationId)
        if (abortController) {
          console.log(`[TabClose] Aborting stream for tab ${tabId}, conversation ${closingTab.conversationId}`)
          abortController.abort()
          clearAbortController(closingTab.conversationId)
        }
        // End any active stream for this conversation to prevent orphaned busy state
        streamingActions.endStream(closingTab.conversationId)
      }
      withWorkspace(removeTab)(tabId)
    },
    [tabs, streamingActions, withWorkspace, removeTab],
  )

  const handleTabRename = useCallback(
    (tabId: string, name: string) => withWorkspace(renameTab)(tabId, name),
    [withWorkspace, renameTab],
  )

  const handleToggleTabs = useCallback(() => withWorkspace(toggleTabsExpanded)(), [withWorkspace, toggleTabsExpanded])

  const handleCollapseTabsAndClear = useCallback(
    () => withWorkspace(collapseTabsAndClear)(),
    [withWorkspace, collapseTabsAndClear],
  )

  const handleOpenTabGroupInTab = useCallback(
    (targetTabGroupId: string, name?: string) => {
      if (!workspace) return

      // Save current input to active tab before opening conversation in new/existing tab
      if (activeTabInGroup && currentInput !== undefined) {
        setTabInputDraft(workspace, activeTabInGroup.id, currentInput)
      }

      const tab = openTabGroupInTab(workspace, targetTabGroupId, name)
      if (tab) {
        onInitializeTab(tab.conversationId, tab.tabGroupId, workspace)
        onSwitchConversation(tab.conversationId)
        // Restore input from the tab's draft (empty for new tabs)
        if (onInputRestore) {
          onInputRestore(tab.inputDraft ?? "")
        }
      }
    },
    [
      workspace,
      activeTabInGroup,
      currentInput,
      openTabGroupInTab,
      onSwitchConversation,
      onInitializeTab,
      setTabInputDraft,
      onInputRestore,
    ],
  )

  // Sync conversation when active tab changes (e.g., after tab close)
  // Use a ref to track the previous activeTab to only react to TAB changes,
  // not conversation changes (which would incorrectly switch back)
  const prevActiveTabRef = useRef<typeof activeTab>(null)
  useEffect(() => {
    const prevActiveTab = prevActiveTabRef.current
    prevActiveTabRef.current = activeTabInGroup

    // Only sync if the activeTab itself changed (not just conversationId)
    if (
      activeTabInGroup &&
      prevActiveTab?.id !== activeTabInGroup.id &&
      activeTabInGroup.conversationId !== activeConversationId
    ) {
      onSwitchConversation(activeTabInGroup.conversationId)
      // Restore input from the new active tab
      if (onInputRestore) {
        onInputRestore(activeTabInGroup.inputDraft ?? "")
      }
    }
  }, [activeTabInGroup, activeConversationId, onSwitchConversation, onInputRestore])

  // Auto-create first tab when tabs expanded but empty
  useEffect(() => {
    if (workspace && tabsExpanded && tabs.length === 0 && tabGroupId && activeConversationId) {
      addTab(workspace, tabGroupId, activeConversationId) // Name auto-generated as "Tab N"
      onInitializeTab(activeConversationId, tabGroupId, workspace)
    }
  }, [workspace, tabsExpanded, tabs.length, tabGroupId, activeConversationId, addTab, onInitializeTab])

  // Ensure store active tab belongs to current tabgroup
  useEffect(() => {
    if (!workspace || !tabGroupId || tabs.length === 0) return
    if (!activeTabInGroup) {
      setActiveTab(workspace, tabs[0].id)
    }
  }, [workspace, tabGroupId, tabs, activeTabInGroup, setActiveTab])

  return {
    tabs,
    activeTab: activeTabInGroup,
    tabsExpanded,
    handleAddTab,
    handleTabSelect,
    handleTabClose,
    handleTabRename,
    handleToggleTabs,
    handleCollapseTabsAndClear,
    handleOpenTabGroupInTab,
  }
}
