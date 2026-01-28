"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useActiveTab, useTabActions, useWorkspaceTabs, type Tab } from "@/lib/stores/tabStore"
import { useIsStreamActive } from "@/lib/stores/streamingStore"
import { useSessionActions } from "@/lib/stores/sessionStore"

/**
 * ActiveSession - Single source of truth for the current chat session
 *
 * PROBLEM THIS SOLVES:
 * Previously, 3 stores tracked "active tab" independently:
 * - sessionStore.currentSessionId (Claude SDK session key)
 * - tabStore.activeTabByWorkspace[workspace] (UI tab state)
 * - dexieMessageStore.currentTabId (message persistence)
 *
 * This caused race conditions when switching tabs, workspaces, or during
 * async operations like ensureTabGroupWithTab().
 *
 * SOLUTION:
 * This hook provides a single, typed interface to the active session.
 * All streaming, cancellation, and reconnection operations MUST use
 * values from this hook, not from individual stores.
 *
 * The source of truth is tabStore.activeTab because:
 * 1. useChatMessaging uses activeTab.sessionId for startStream()
 * 2. All UI rendering uses activeTab for display
 * 3. It's synchronous (no async hydration issues)
 *
 * USAGE:
 * ```tsx
 * const session = useActiveSession(workspace)
 *
 * // For streaming operations
 * streamingActions.startStream(session.tabId)  // Never use raw tabId!
 *
 * // For checking busy state
 * const busy = session.isStreaming  // Never use useIsStreamActive directly!
 *
 * // Guard before operations
 * if (!session.isReady) return  // Tab not yet available
 *
 * // For creating new tabs
 * const newTabId = session.actions.createSessionId()
 *
 * // For switching tabs
 * session.actions.switchTab(otherTabId)
 * ```
 */

export interface SessionActions {
  /**
   * Create a new sessionId in sessionStore only.
   * Use this when adding a tab to an EXISTING tabGroup.
   * Returns the new sessionId or empty string if failed.
   */
  createSessionId: () => string

  /**
   * Create a new tabGroup with its first tab.
   * Use this for "New Tab Group" - creates a fresh tab group.
   * Returns the new sessionId or empty string if failed.
   */
  startNewTabGroup: () => string

  /**
   * Switch to an existing tab by its sessionId.
   */
  switchTab: (sessionId: string) => void
}

export interface ActiveSession {
  /**
   * The session ID for Claude SDK session key.
   * Use this for: startStream, endStream, cancel, reconnect.
   * null if no active tab exists.
   */
  tabId: string | null

  /**
   * The tab group ID for grouping related tabs.
   * Use this for: API requests, server-side session lookup.
   * null if no active tab exists.
   */
  tabGroupId: string | null

  /**
   * Whether the session is ready for operations.
   * true when workspace has an active tab with valid sessionId.
   * Guard all streaming operations with this.
   */
  isReady: boolean

  /**
   * Whether there's an active stream for this session.
   * Derived from streamingStore using the correct tabId.
   * Use this instead of useIsStreamActive() directly.
   */
  isStreaming: boolean

  /**
   * The active tab object from tabStore.
   * Use for UI rendering (name, tabNumber, etc.)
   * null if no active tab exists.
   */
  activeTab: Tab | null

  /**
   * All open tabs for this workspace.
   * Use for tab management UI.
   */
  workspaceTabs: Tab[]

  /**
   * Actions for session management.
   * Use these instead of calling store actions directly.
   */
  actions: SessionActions
}

/**
 * Hook to get the active session for a workspace.
 *
 * @param workspace - The workspace domain (e.g., "example.com")
 * @returns ActiveSession with all values derived from single source of truth
 */
export function useActiveSession(workspace: string | null): ActiveSession {
  const activeTab = useActiveTab(workspace)
  const workspaceTabs = useWorkspaceTabs(workspace)
  const { setActiveTab, createTabGroupWithTab } = useTabActions()
  const { initSession, newSession, switchToSession } = useSessionActions()
  const prevWorkspaceRef = useRef<string | null>(null)

  // Initialize session when workspace changes and no active tab exists
  // This handles:
  // 1. First load: creates new tab
  // 2. Workspace switch: resumes existing session or creates new
  useEffect(() => {
    if (!workspace) return
    if (prevWorkspaceRef.current === workspace) return

    prevWorkspaceRef.current = workspace

    // If there's already an active tab for this workspace, use it
    if (activeTab) {
      return
    }

    // Initialize session from sessionStore (may resume existing or create new)
    const sessionId = initSession(workspace)

    // Create a tab in tabStore for this session
    createTabGroupWithTab(workspace, sessionId)
  }, [workspace, activeTab, initSession, createTabGroupWithTab])

  // CRITICAL: All streaming state must be read from the same tabId
  // that useChatMessaging uses for startStream().
  // activeTab.sessionId is that source of truth.
  const tabId = activeTab?.sessionId ?? null
  const tabGroupId = activeTab?.tabGroupId ?? null

  // Streaming state scoped to the active tab
  const isStreaming = useIsStreamActive(tabId)

  // Session is ready when we have a valid tab with sessionId
  const isReady = tabId !== null && tabGroupId !== null

  // Action: Create a new sessionId in sessionStore only
  // This is used by useTabsManagement when adding a tab to an EXISTING tabGroup
  // For creating a NEW tabGroup, use startNewTabGroup instead
  const createSessionId = useCallback((): string => {
    if (!workspace) {
      return ""
    }
    return newSession(workspace)
  }, [workspace, newSession])

  // Action: Create a new tabGroup with its first tab
  // This is used for "New Tab Group" button - creates a fresh tab group
  const startNewTabGroup = useCallback((): string => {
    if (!workspace) {
      return ""
    }
    const newId = newSession(workspace)
    createTabGroupWithTab(workspace, newId)
    return newId
  }, [workspace, newSession, createTabGroupWithTab])

  // Action: Switch to an existing tab (syncs sessionStore + tabStore)
  const switchTab = useCallback(
    (sessionId: string) => {
      if (!workspace) return
      // Update sessionStore
      switchToSession(sessionId, workspace)
      // Find and activate the tab in tabStore
      const tab = workspaceTabs.find(t => t.sessionId === sessionId)
      if (tab) {
        setActiveTab(workspace, tab.id)
      }
    },
    [workspace, switchToSession, workspaceTabs, setActiveTab],
  )

  const actions = useMemo(
    () => ({ createSessionId, startNewTabGroup, switchTab }),
    [createSessionId, startNewTabGroup, switchTab],
  )

  return useMemo(
    () => ({
      tabId,
      tabGroupId,
      isReady,
      isStreaming,
      activeTab,
      workspaceTabs,
      actions,
    }),
    [tabId, tabGroupId, isReady, isStreaming, activeTab, workspaceTabs, actions],
  )
}

/**
 * Type guard to assert session is ready.
 * Use in callbacks where you need non-null values.
 *
 * @example
 * ```tsx
 * const session = useActiveSession(workspace)
 *
 * const handleSend = () => {
 *   if (!assertSessionReady(session)) return
 *   // session.tabId is now string (not null)
 *   streamingActions.startStream(session.tabId)
 * }
 * ```
 */
export function assertSessionReady(
  session: ActiveSession,
): session is ActiveSession & { tabId: string; tabGroupId: string; isReady: true } {
  return session.isReady && session.tabId !== null && session.tabGroupId !== null
}
