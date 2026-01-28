"use client"

import { useEffect, useCallback, useRef } from "react"
import {
  useTabs,
  useActiveTab,
  useTabsExpanded,
  useTabActions,
  useClosedTabs,
  useTabStore,
} from "@/lib/stores/tabStore"
import { useStreamingActions, getAbortController, clearAbortController } from "@/lib/stores/streamingStore"
import { useDexieMessageActions } from "@/lib/db/dexieMessageStore"

interface UseTabsOptions {
  workspace: string | null
  tabGroupId: string | null
  /** Active tab's session id (Claude SDK session key) */
  activeSessionId: string | null
  onSwitchSession: (id: string) => void
  onInitializeTab: (sessionId: string, tabGroupId: string, workspace: string) => void
  onCreateSessionId?: () => string
  /** Current input message - used to save draft on tab switch */
  currentInput?: string
  /** Callback to restore input when switching tabs */
  onInputRestore?: (input: string) => void
}

const genSessionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * Hook for managing tabs within a tab group
 *
 * Each tab = one session. Switching tabs switches sessions.
 * Closed tabs are removed from the bar but tab groups stay in sidebar history.
 */
export function useTabsManagement({
  workspace,
  tabGroupId,
  activeSessionId,
  onSwitchSession,
  onInitializeTab,
  onCreateSessionId,
  currentInput,
  onInputRestore,
}: UseTabsOptions) {
  const tabs = useTabs(workspace, tabGroupId)
  const closedTabs = useClosedTabs(workspace)
  const activeTab = useActiveTab(workspace)
  const activeTabInGroup = tabs.find(t => t.id === activeTab?.id) ?? tabs[0] ?? null
  const tabsExpanded = useTabsExpanded(workspace)
  const {
    addTab,
    removeTab,
    reopenTab,
    setActiveTab,
    renameTab,
    toggleTabsExpanded,
    collapseTabsAndClear,
    openTabGroupInTab,
    setTabInputDraft,
  } = useTabActions()
  const { reopenTab: dexieReopenTab, loadTabMessages } = useDexieMessageActions()
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

    const sessionId = onCreateSessionId?.() ?? genSessionId()
    console.log("[AddTab]", {
      previousActiveTabSessionId: activeTabInGroup?.sessionId,
      newSessionId: sessionId,
      usingCreateSessionId: !!onCreateSessionId,
    })
    const tab = addTab(workspace, tabGroupId, sessionId)
    if (tab) {
      onInitializeTab(sessionId, tabGroupId, workspace)
      onSwitchSession(sessionId)
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
    onCreateSessionId,
    onInitializeTab,
    onSwitchSession,
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
          fromSessionId: activeTabInGroup?.sessionId,
          toTabId: tab.id,
          toSessionId: tab.sessionId,
        })

        // Save current input to the previous tab before switching
        if (activeTabInGroup && currentInput !== undefined) {
          setTabInputDraft(workspace, activeTabInGroup.id, currentInput)
        }

        setActiveTab(workspace, tabId)
        onSwitchSession(tab.sessionId)

        // Restore input from the new tab's draft
        if (onInputRestore) {
          onInputRestore(tab.inputDraft ?? "")
        }
      }
    },
    [tabs, workspace, activeTabInGroup, currentInput, setActiveTab, onSwitchSession, setTabInputDraft, onInputRestore],
  )

  const handleTabClose = useCallback(
    (tabId: string) => {
      // Find the tab being closed to get its sessionId
      const closingTab = tabs.find(t => t.id === tabId)
      if (closingTab) {
        // Abort the HTTP request if there's an active stream
        const abortController = getAbortController(closingTab.sessionId)
        if (abortController) {
          console.log(`[TabClose] Aborting stream for tab ${tabId}, session ${closingTab.sessionId}`)
          abortController.abort()
          clearAbortController(closingTab.sessionId)
        }
        // End any active stream for this session to prevent orphaned busy state
        streamingActions.endStream(closingTab.sessionId)
      }
      if (!workspace) return
      removeTab(workspace, tabId)

      // Proactively switch to the new active tab to prevent effect cascades.
      // Without this, competing effects (activeTab sync + tabForSession null guard)
      // ping-pong state updates causing React error #185 (max update depth).
      const state = useTabStore.getState()
      const newActiveId = state.activeTabByWorkspace[workspace]
      if (newActiveId && newActiveId !== tabId) {
        const allTabs = state.tabsByWorkspace[workspace] ?? []
        const newActiveTab = allTabs.find(t => t.id === newActiveId)
        if (newActiveTab) {
          onSwitchSession(newActiveTab.sessionId)
          if (onInputRestore) {
            onInputRestore(newActiveTab.inputDraft ?? "")
          }
        }
      }
    },
    [tabs, workspace, streamingActions, removeTab, onSwitchSession, onInputRestore],
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

  const handleTabReopen = useCallback(
    (tabId: string) => {
      if (!workspace) return
      reopenTab(workspace, tabId)
      void dexieReopenTab(tabId)

      // Ensure tabs are expanded so the reopened tab is visible
      if (!tabsExpanded) {
        toggleTabsExpanded(workspace)
      }

      // Find the tab to get its sessionId and switch to it
      const tab = closedTabs.find(t => t.id === tabId)
      if (tab) {
        onSwitchSession(tab.sessionId)
        onInitializeTab(tab.sessionId, tab.tabGroupId, workspace)
        // loadTabMessages expects the Dexie tab key (sessionId)
        void loadTabMessages(tab.sessionId)
        if (onInputRestore) {
          onInputRestore(tab.inputDraft ?? "")
        }
      }
    },
    [
      workspace,
      closedTabs,
      tabsExpanded,
      reopenTab,
      dexieReopenTab,
      loadTabMessages,
      toggleTabsExpanded,
      onSwitchSession,
      onInitializeTab,
      onInputRestore,
    ],
  )

  const handleOpenTabGroupInTab = useCallback(
    (targetTabGroupId: string, name?: string) => {
      if (!workspace) return

      // Save current input to active tab before opening tab group in new/existing tab
      if (activeTabInGroup && currentInput !== undefined) {
        setTabInputDraft(workspace, activeTabInGroup.id, currentInput)
      }

      const tab = openTabGroupInTab(workspace, targetTabGroupId, name)
      if (tab) {
        onInitializeTab(tab.sessionId, tab.tabGroupId, workspace)
        onSwitchSession(tab.sessionId)
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
      onSwitchSession,
      onInitializeTab,
      setTabInputDraft,
      onInputRestore,
    ],
  )

  // Sync session when active tab changes (e.g., after tab close)
  // Use a ref to track the previous activeTab to only react to TAB changes,
  // not session changes (which would incorrectly switch back)
  const prevActiveTabRef = useRef<typeof activeTab>(null)
  useEffect(() => {
    const prevActiveTab = prevActiveTabRef.current
    prevActiveTabRef.current = activeTabInGroup

    // Only sync if the activeTab itself changed (not just sessionId)
    if (
      activeTabInGroup &&
      prevActiveTab?.id !== activeTabInGroup.id &&
      activeTabInGroup.sessionId !== activeSessionId
    ) {
      onSwitchSession(activeTabInGroup.sessionId)
      // Restore input from the new active tab
      if (onInputRestore) {
        onInputRestore(activeTabInGroup.inputDraft ?? "")
      }
    }
  }, [activeTabInGroup, activeSessionId, onSwitchSession, onInputRestore])

  // Auto-create first tab when tabs expanded but empty
  useEffect(() => {
    if (workspace && tabsExpanded && tabs.length === 0 && tabGroupId && activeSessionId) {
      addTab(workspace, tabGroupId, activeSessionId) // Name auto-generated as "Tab N"
      onInitializeTab(activeSessionId, tabGroupId, workspace)
    }
  }, [workspace, tabsExpanded, tabs.length, tabGroupId, activeSessionId, addTab, onInitializeTab])

  // Ensure store active tab belongs to current tabgroup
  useEffect(() => {
    if (!workspace || !tabGroupId || tabs.length === 0) return
    if (!activeTabInGroup) {
      setActiveTab(workspace, tabs[0].id)
    }
  }, [workspace, tabGroupId, tabs, activeTabInGroup, setActiveTab])

  return {
    tabs,
    closedTabs,
    activeTab: activeTabInGroup,
    tabsExpanded,
    handleAddTab,
    handleTabSelect,
    handleTabClose,
    handleTabRename,
    handleTabReopen,
    handleToggleTabs,
    handleCollapseTabsAndClear,
    handleOpenTabGroupInTab,
  }
}
