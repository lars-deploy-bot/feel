"use client"

import { useEffect, useCallback, useRef } from "react"
import { useTabs, useActiveTab, useTabsExpanded, useTabActions } from "@/lib/stores/tabStore"
import { useStreamingActions, getAbortController, clearAbortController } from "@/lib/stores/streamingStore"

interface UseTabsOptions {
  workspace: string | null
  conversationId: string | null
  onSwitchConversation: (id: string) => void
  onInitializeConversation: (id: string, workspace: string) => void
  onStartNewConversation?: () => string
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
  conversationId,
  onSwitchConversation,
  onInitializeConversation,
  onStartNewConversation,
  currentInput,
  onInputRestore,
}: UseTabsOptions) {
  const tabs = useTabs(workspace)
  const activeTab = useActiveTab(workspace)
  const tabsExpanded = useTabsExpanded(workspace)
  const {
    addTab,
    removeTab,
    setActiveTab,
    renameTab,
    toggleTabsExpanded,
    collapseTabsAndClear,
    openConversationInTab,
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
    if (!workspace) return

    // Save current input to active tab before creating new tab
    if (activeTab && currentInput !== undefined) {
      setTabInputDraft(workspace, activeTab.id, currentInput)
    }

    const convoId = onStartNewConversation?.() ?? genConvoId()
    console.log("[AddTab]", {
      previousActiveTabConversationId: activeTab?.conversationId,
      newConversationId: convoId,
      usingStartNewConversation: !!onStartNewConversation,
    })
    const tab = addTab(workspace, convoId)
    if (tab) {
      onInitializeConversation(convoId, workspace)
      // Clear input for new tab
      if (onInputRestore) {
        onInputRestore("")
      }
    }
  }, [
    workspace,
    activeTab,
    currentInput,
    addTab,
    onStartNewConversation,
    onInitializeConversation,
    setTabInputDraft,
    onInputRestore,
  ])

  const handleTabSelect = useCallback(
    (tabId: string) => {
      const tab = tabs.find(t => t.id === tabId)
      if (tab && workspace) {
        // Debug logging
        console.log("[TabSelect]", {
          fromTabId: activeTab?.id,
          fromConversationId: activeTab?.conversationId,
          toTabId: tab.id,
          toConversationId: tab.conversationId,
        })

        // Save current input to the previous tab before switching
        if (activeTab && currentInput !== undefined) {
          setTabInputDraft(workspace, activeTab.id, currentInput)
        }

        setActiveTab(workspace, tabId)
        onSwitchConversation(tab.conversationId)

        // Restore input from the new tab's draft
        if (onInputRestore) {
          onInputRestore(tab.inputDraft ?? "")
        }
      }
    },
    [tabs, workspace, activeTab, currentInput, setActiveTab, onSwitchConversation, setTabInputDraft, onInputRestore],
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

  const handleOpenConversationInTab = useCallback(
    (convoId: string, name?: string) => {
      if (!workspace || !tabsExpanded) return

      // Save current input to active tab before opening conversation in new/existing tab
      if (activeTab && currentInput !== undefined) {
        setTabInputDraft(workspace, activeTab.id, currentInput)
      }

      const tab = openConversationInTab(workspace, convoId, name)
      if (tab) {
        onSwitchConversation(convoId)
        // Restore input from the tab's draft (empty for new tabs)
        if (onInputRestore) {
          onInputRestore(tab.inputDraft ?? "")
        }
      }
    },
    [
      workspace,
      tabsExpanded,
      activeTab,
      currentInput,
      openConversationInTab,
      onSwitchConversation,
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
    prevActiveTabRef.current = activeTab

    // Only sync if the activeTab itself changed (not just conversationId)
    if (activeTab && prevActiveTab?.id !== activeTab.id && activeTab.conversationId !== conversationId) {
      onSwitchConversation(activeTab.conversationId)
      // Restore input from the new active tab
      if (onInputRestore) {
        onInputRestore(activeTab.inputDraft ?? "")
      }
    }
  }, [activeTab, conversationId, onSwitchConversation, onInputRestore])

  // Auto-create first tab when tabs expanded but empty
  useEffect(() => {
    if (workspace && tabsExpanded && tabs.length === 0 && conversationId) {
      addTab(workspace, conversationId) // Name auto-generated as "Tab N"
    }
  }, [workspace, tabsExpanded, tabs.length, conversationId, addTab])

  return {
    tabs,
    activeTab,
    tabsExpanded,
    handleAddTab,
    handleTabSelect,
    handleTabClose,
    handleTabRename,
    handleToggleTabs,
    handleCollapseTabsAndClear,
    handleOpenConversationInTab,
  }
}
