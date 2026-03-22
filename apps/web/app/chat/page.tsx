"use client"
import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import { SUPERADMIN_WORKSPACE_NAME } from "@webalive/shared/constants"
import { AnimatePresence, motion } from "framer-motion"
import { useQueryState } from "nuqs"
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  Panel,
  Group as PanelGroup,
  type PanelImperativeHandle,
  Separator as PanelResizeHandle,
} from "react-resizable-panels"
import { FeedbackModal } from "@/components/modals/FeedbackModal"
import { GithubImportModal } from "@/components/modals/GithubImportModal"
import { InviteModal } from "@/components/modals/InviteModal"
import { SessionExpiredModal } from "@/components/modals/SessionExpiredModal"
import { SuperTemplatesModal } from "@/components/modals/SuperTemplatesModal"
import { ChatDropOverlay } from "@/features/chat/components/ChatDropOverlay"
import { ChatInput } from "@/features/chat/components/ChatInput"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import { PendingToolsIndicator } from "@/features/chat/components/PendingToolsIndicator"
import { ReadOnlyTranscriptBar } from "@/features/chat/components/ReadOnlyTranscriptBar"
import { SubdomainInitializer } from "@/features/chat/components/SubdomainInitializer"
import { Workbench } from "@/features/chat/components/workbench/Workbench"
import { WorkbenchMobile } from "@/features/chat/components/workbench/WorkbenchMobile"
// useTabSession removed - now using useActiveSession via useTabIsolatedMessages
import { useAutomationTranscriptPoll } from "@/features/chat/hooks/useAutomationTranscriptPoll"
import { useBrowserCleanup } from "@/features/chat/hooks/useBrowserCleanup"
import { useImageUpload } from "@/features/chat/hooks/useImageUpload"
import { useStreamCancellation } from "@/features/chat/hooks/useStreamCancellation"
import { useStreamReconnect } from "@/features/chat/hooks/useStreamReconnect"
import { ClientRequest, DevTerminalProvider, useDevTerminal } from "@/features/chat/lib/dev-terminal-context"
import { RetryProvider, useRetry } from "@/features/chat/lib/retry-context"
import { useWorkbenchContext, WorkbenchProvider } from "@/features/chat/lib/workbench-context"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { SettingsContent } from "@/features/settings/SettingsContent"
import { SettingsTabProvider } from "@/features/settings/SettingsTabProvider"
import { ConversationSidebar } from "@/features/sidebar/ConversationSidebar"
import { useSidebarActions, useSidebarOpen } from "@/features/sidebar/sidebarStore"
import { useSandboxEnsure } from "@/features/workspace/hooks/useSandboxEnsure"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { validateWorktreeSlug } from "@/features/workspace/lib/worktree-utils"
import { useRedeemReferral } from "@/hooks/useRedeemReferral"
import {
  trackChatPageViewed,
  trackConversationArchived,
  trackConversationCreated,
  trackConversationRenamed,
  trackConversationSwitched,
  trackGithubImportCompleted,
  trackWorkspaceSelected,
} from "@/lib/analytics/events"
import { useDexieMessageActions, useDexieSession } from "@/lib/db/dexieMessageStore"
import { AUTOMATION_RUN_SOURCE, getMessageDb } from "@/lib/db/messageDb"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { useSessionHeartbeat } from "@/lib/hooks/useSessionHeartbeat"
import { useAllWorkspacesQuery, type WorkspaceInfo } from "@/lib/hooks/useSettingsQueries"
import { validateOAuthToastParams } from "@/lib/integrations/toast-validation"
import { CHAT_PANEL, RESIZE_HANDLE_ID, WORKBENCH_PANEL } from "@/lib/layout"
import { NAVIGATE_TO_CONVERSATION_EVENT, parseNavigateEvent } from "@/lib/navigation/conversation-navigation"
import { stripOAuthCallbackParams } from "@/lib/oauth/popup-constants"
import { useIsSessionExpired } from "@/lib/stores/authStore"
import { useDebugVisible, useWorkbench, useWorkbenchFullscreen } from "@/lib/stores/debug-store"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"
import { useAppHydrated } from "@/lib/stores/HydrationBoundary"
import { appendInput, clearInput, getInputValue, setInput } from "@/lib/stores/inputStore"
import { useLastSeenStreamSeq, useStreamingActions } from "@/lib/stores/streamingStore"
import { useTabActions, useTabDataStore } from "@/lib/stores/tabStore"
import { useSelectedOrgId, useWorkspaceActions, useWorkspaceStoreBase } from "@/lib/stores/workspaceStore"
import { queryKeys } from "@/lib/tanstack/queryKeys"
import { QUERY_KEYS } from "@/lib/url/queryState"
// Local components
import { AgentManagerIndicator, ChatEmptyState, MessageList, OfflineBanner, TabBar } from "./components"
import {
  useChatDragDrop,
  useChatMessaging,
  useChatScroll,
  useModals,
  useOnlineStatus,
  useStatusText,
  useTabIsolatedMessages,
  useTabsManagement,
} from "./hooks"

/** Synchronously resolve orgId for a workspace from local caches (store + TanStack). */
function resolveOrgForWorkspace(domain: string, queryClient: QueryClient): string | null {
  // Source 1: recentWorkspaces in workspace store (sync, fast)
  const recent = useWorkspaceStoreBase.getState().recentWorkspaces.find(r => r.domain === domain)
  if (recent) return recent.orgId

  // Source 2: TanStack cache for all-workspaces (already fetched by useOrganizationsQuery)
  const cached = queryClient.getQueryData<Record<string, WorkspaceInfo[]>>(queryKeys.workspaces.allForUser())
  if (cached) {
    for (const [orgId, workspaces] of Object.entries(cached)) {
      if (workspaces.some(w => w.hostname === domain)) return orgId
    }
  }
  return null
}

function ChatPageContent() {
  const {
    ensureTabGroupWithTab,
    addMessage,
    archiveConversation,
    renameConversation,
    setSession: setDexieSession,
    reopenTab: dexieReopenTab,
    loadTabMessages: dexieLoadTabMessages,
  } = useDexieMessageActions()
  const dexieSession = useDexieSession()
  const {
    createTabGroupWithTab,
    removeTabGroup,
    setActiveTab,
    reopenTab,
    openTabGroupInTab: openTabGroupInTargetWs,
  } = useTabActions()

  // Ensures Dexie has a tabgroup+tab for the session key (tabId)
  const initializeTab = useCallback(
    (tabId: string, tabGroupId: string, targetWorkspace: string) => {
      if (!dexieSession) return
      void ensureTabGroupWithTab(targetWorkspace, tabGroupId, tabId)
    },
    [dexieSession, ensureTabGroupWithTab],
  )
  const { toggleSidebar, openSidebar } = useSidebarActions()
  const isSidebarOpen = useSidebarOpen()
  const isHydrated = useAppHydrated()
  const [subdomainInitialized, setSubdomainInitialized] = useState(false)
  const [worktreeModalOpen, setWorktreeModalOpen] = useState(false)
  const [githubImportOpen, setGithubImportOpen] = useState(false)
  const [_showCompletionDots, setShowCompletionDots] = useState(false)
  const modals = useModals()

  // Measure input height so messages get enough bottom padding to scroll past it
  const inputWrapperRef = useRef<HTMLDivElement | null>(null)
  const [inputHeight, setInputHeight] = useState(0)

  useEffect(() => {
    const el = inputWrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setInputHeight(entry.contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Smart scroll using Intersection Observer
  const { containerRef, anchorRef, isScrolledAway, scrollToBottom, forceScrollToBottom } = useChatScroll({
    threshold: 100,
    debounceMs: 150,
  })

  const { user } = useAuth()
  const selectedOrgId = useSelectedOrgId()
  const _isAdmin = user?.isAdmin ?? false

  // Tabs are on by default for all users
  const chatInputRef = useRef<ChatInputHandle | null>(null)
  const workbenchPanelRef = useRef<PanelImperativeHandle>(null)
  const showWorkbenchRaw = useWorkbench()
  const isWorkbenchFullscreen = useWorkbenchFullscreen()
  const isDebugMode = useDebugVisible()
  const { addEvent: addDevEvent } = useDevTerminal()
  const { workspace, worktree, workspaceKey, isTerminal, mounted, setWorkspace, setWorktree } = useWorkspace({
    allowEmpty: true,
  })
  useSandboxEnsure(workspace)
  const tabWorkspace = workspaceKey

  // Tab-isolated messages, busy state, and session actions from single source of truth
  const {
    messages,
    busy,
    tabId: sessionTabId,
    tabGroupId: sessionTabGroupId,
    isReady: sessionReady,
    isLoadingMessages,
    activeTab: _activeTab,
    workspaceTabs,
    actions: sessionActions,
    conversation,
    userId: dexieUserId,
  } = useTabIsolatedMessages({ workspace: tabWorkspace })

  // Automation transcript polling — automation runs write to app.messages directly
  // (not via Redis stream buffer), so we poll fetchTabMessages() instead.
  const isAutomationRun = conversation?.source === AUTOMATION_RUN_SOURCE
  const automationMeta = isAutomationRun ? conversation?.sourceMetadata : undefined
  useAutomationTranscriptPoll({
    isAutomationRun,
    tabId: sessionTabId,
    userId: dexieUserId,
    jobId: automationMeta?.job_id ?? null,
    claimRunId: automationMeta?.claim_run_id ?? null,
  })

  // Handle ?wk= and ?org= URL parameters to pre-select workspace (e.g., from deploy or widget "Edit me" button)
  // Consume-once per value: tracks consumed wk value so a second deep link with a different workspace takes effect.
  const [wkParam, setWkParam] = useQueryState(QUERY_KEYS.workspace)
  const [wtParam, setWtParam] = useQueryState(QUERY_KEYS.worktree)
  const worktreesEnabled = useFeatureFlag("WORKTREES")
  const requestWorktree = worktreesEnabled ? worktree : null
  const wkConsumedRef = useRef<string | null>(null)
  const queryClient = useQueryClient()
  const [orgParam, setOrgParam] = useQueryState(QUERY_KEYS.org)
  const { setSelectedOrg, setDeepLinkPending } = useWorkspaceActions()
  useEffect(() => {
    if (!mounted || !wkParam || wkConsumedRef.current === wkParam) return
    wkConsumedRef.current = wkParam
    if (wkParam !== workspace) {
      console.log("[ChatPage] Setting workspace from URL param:", wkParam)

      // If ?org= is provided (e.g., from deploy flow), use it directly (I3).
      // Otherwise, attempt to resolve from cached data.
      const resolvedOrgId = orgParam || resolveOrgForWorkspace(wkParam, queryClient)

      if (resolvedOrgId) {
        setSelectedOrg(resolvedOrgId)
        setWorkspace(wkParam, resolvedOrgId)
      } else {
        // Set workspace immediately, protect from validateWorkspaceAvailability,
        // defer org resolution until all-workspaces data arrives.
        setWorkspace(wkParam)
        setDeepLinkPending(wkParam)
      }
    }
    void setWkParam(null, { shallow: true })
    if (orgParam) void setOrgParam(null, { shallow: true })
  }, [
    mounted,
    wkParam,
    orgParam,
    workspace,
    setWorkspace,
    setWkParam,
    setOrgParam,
    queryClient,
    setSelectedOrg,
    setDeepLinkPending,
  ])

  // Bidirectional sync between ?wt= URL param and worktree store.
  // Refs track previous values so each effect only reacts to its own source changing,
  // preventing infinite loops when one side updates the other.
  const prevWtParamRef = useRef<string | null | undefined>(undefined)
  const prevWorktreeRef = useRef<string | null | undefined>(undefined)

  // URL → Store: sync ?wt= param into worktree store
  useEffect(() => {
    if (!mounted || !worktreesEnabled) return
    // Only react when wtParam actually changed (not when worktree changed)
    if (prevWtParamRef.current === wtParam) return
    prevWtParamRef.current = wtParam

    // Normalize and validate the URL param
    let normalizedParam: string | null = null
    if (wtParam && wtParam.length > 0) {
      const validation = validateWorktreeSlug(wtParam)
      if (validation.valid) {
        normalizedParam = validation.slug
      } else {
        console.warn(`[ChatPage] Invalid worktree in URL rejected: "${wtParam}" - ${validation.reason}`)
        void setWtParam(null, { shallow: true })
        return
      }
    }

    if (normalizedParam !== worktree) {
      prevWorktreeRef.current = normalizedParam
      setWorktree(normalizedParam)
    }
  }, [mounted, worktreesEnabled, wtParam, worktree, setWorktree, setWtParam])

  // Store → URL: sync worktree store into ?wt= param
  useEffect(() => {
    if (!mounted || !worktreesEnabled) return
    // Only react when worktree actually changed (not when wtParam changed)
    if (prevWorktreeRef.current === worktree) return
    prevWorktreeRef.current = worktree

    const desired = worktree && worktree.length > 0 ? worktree : null
    if (wtParam !== desired) {
      prevWtParamRef.current = desired
      void setWtParam(desired, { shallow: true })
    }
  }, [mounted, worktreesEnabled, worktree, wtParam, setWtParam])

  // Sync tab ID to URL for shareable links and browser history
  const [tabParam, setTabParam] = useQueryState(QUERY_KEYS.chatTab)
  const { setActiveTab: setStoreActiveTab } = useTabActions()
  const initialTabRestored = useRef(false)
  const previousWorkspaceKeyRef = useRef<string | null>(null)
  const [tabRestoreTimedOut, setTabRestoreTimedOut] = useState(false)
  const TAB_RESTORE_TIMEOUT_MS = 5000

  useEffect(() => {
    if (!mounted) return
    if (previousWorkspaceKeyRef.current && previousWorkspaceKeyRef.current !== tabWorkspace) {
      initialTabRestored.current = false
      setTabRestoreTimedOut(false)
      if (tabParam) {
        void setTabParam(null, { shallow: true })
      }
    }
    previousWorkspaceKeyRef.current = tabWorkspace ?? null
  }, [mounted, tabWorkspace, tabParam, setTabParam])

  // Guaranteed timeout for tab restore — fires regardless of whether the
  // main effect's dependencies change, so we never get stuck waiting forever.
  useEffect(() => {
    if (!mounted || !tabParam || initialTabRestored.current) return
    const timer = setTimeout(() => {
      if (!initialTabRestored.current) {
        console.warn("[ChatPage] Tab restore timed out, tab not found:", tabParam)
        initialTabRestored.current = true
        setTabRestoreTimedOut(true)
      }
    }, TAB_RESTORE_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [mounted, tabParam])

  // On mount: if URL has a tab param, restore it.
  // Waits for syncFromServer to populate stores — the timeout effect above
  // guarantees we give up after TAB_RESTORE_TIMEOUT_MS even if deps stop changing.
  // Checks both open and closed tabs — reopens closed tabs so shared URLs always work.
  useEffect(() => {
    if (!mounted || !tabWorkspace || !dexieSession || initialTabRestored.current || tabRestoreTimedOut) return
    if (!tabParam) {
      initialTabRestored.current = true
      return
    }

    // Check open tabs first
    const openTab = workspaceTabs.find(t => t.id === tabParam)
    if (openTab && sessionTabId !== tabParam) {
      console.log("[ChatPage] Restoring tab from URL param:", tabParam)
      setStoreActiveTab(tabWorkspace, tabParam)
      initialTabRestored.current = true
      return
    }

    // Check closed tabs — reopen if found (shared URLs should always work)
    if (!openTab) {
      const allTabs = useTabDataStore.getState().tabsByWorkspace[tabWorkspace] ?? []
      const closedTab = allTabs.find(t => t.id === tabParam && t.closedAt !== undefined)
      if (closedTab) {
        console.log("[ChatPage] Reopening closed tab from URL param:", tabParam)
        reopenTab(tabWorkspace, tabParam)
        void dexieReopenTab(tabParam)
        setStoreActiveTab(tabWorkspace, tabParam)
        initialTabRestored.current = true
        return
      }
    }
    // Tab not found yet — syncFromServer may still be populating stores.
    // Effect re-runs when workspaceTabs changes; timeout effect handles the give-up.
  }, [
    mounted,
    tabWorkspace,
    dexieSession,
    tabParam,
    tabRestoreTimedOut,
    workspaceTabs,
    sessionTabId,
    setStoreActiveTab,
    reopenTab,
    dexieReopenTab,
  ])

  // When active tab changes, update URL (shallow, no navigation)
  useEffect(() => {
    if (!mounted || !sessionTabId || !initialTabRestored.current) return

    // Only update if different to avoid loops
    if (tabParam !== sessionTabId) {
      void setTabParam(sessionTabId, { shallow: true })
    }
  }, [mounted, sessionTabId, tabParam, setTabParam])

  // Navigate to a conversation from elsewhere (e.g. agent runs panel).
  // Closes settings, switches workspace if needed, and activates the target tab.
  useEffect(() => {
    const handler = (e: Event) => {
      const nav = parseNavigateEvent(e)
      if (!nav) return

      // Close settings overlay
      modals.closeSettings()

      // Switch workspace if different
      if (nav.workspace !== workspace) {
        const orgId = resolveOrgForWorkspace(nav.workspace, queryClient)
        if (orgId) setSelectedOrg(orgId)
        setWorkspace(nav.workspace)
      }

      // Reset tab restore state so the URL ?tab= param triggers tab activation
      initialTabRestored.current = false
      void setTabParam(nav.tabId, { shallow: true })
    }

    window.addEventListener(NAVIGATE_TO_CONVERSATION_EVENT, handler)
    return () => window.removeEventListener(NAVIGATE_TO_CONVERSATION_EVENT, handler)
  }, [modals.closeSettings, workspace, queryClient, setSelectedOrg, setWorkspace, setTabParam])

  // Superadmin workspace (alive) shows terminal & code views only
  const isSuperadminWorkspace = workspace === SUPERADMIN_WORKSPACE_NAME
  const showWorkbench = showWorkbenchRaw // Show for all workspaces

  // Sync workbench toggle → panel collapse/expand.
  // The PanelGroup is only mounted after hydration (isHydrated gate below),
  // so defaultSize already has the correct persisted value on first render.
  // This effect only handles runtime toggles after mount.
  useLayoutEffect(() => {
    const panel = workbenchPanelRef.current
    if (!panel) return
    if (showWorkbench) {
      if (panel.isCollapsed()) {
        panel.resize(WORKBENCH_PANEL.default)
      }
    } else {
      panel.collapse()
    }
  }, [showWorkbench])

  const streamingActions = useStreamingActions()
  const lastSeenStreamSeq = useLastSeenStreamSeq(sessionTabId)
  const { registerElementSelectHandler, registerAddImageToChat, registerOpenConversation } = useWorkbenchContext()

  // Context compaction state — tracks whether compaction is in progress
  // by comparing positions of the last "compacting" vs "compact_boundary" messages.
  // Handles multiple compaction cycles correctly (each cycle: compacting → compact_boundary).
  const isCompactionInProgress = useMemo(() => {
    const lastCompactingIdx = messages.findLastIndex(m => m.type === "compacting")
    if (lastCompactingIdx < 0) return false
    const lastBoundaryIdx = messages.findLastIndex(m => m.type === "compact_boundary")
    return lastCompactingIdx > lastBoundaryIdx
  }, [messages])

  // Custom hooks
  const statusText = useStatusText(busy, messages)
  const { isDragging, handleChatDragEnter, handleChatDragLeave, handleChatDragOver, handleChatDrop } = useChatDragDrop({
    chatInputRef,
    disabled: isAutomationRun,
  })

  // Register element selection handler to insert selected element into chat input
  useEffect(() => {
    registerElementSelectHandler(element => {
      const shortPath = element.fileName.replace(/^.*\/src\//, "src/")
      const reference = `@${element.displayName} in ${shortPath}:${element.lineNumber}`
      appendInput(reference)
      setTimeout(() => chatInputRef.current?.focus(), 0)
    })
  }, [registerElementSelectHandler])

  // Register image-to-chat handler so WorkbenchPhotos can add images to the input
  useEffect(() => {
    registerAddImageToChat(imageKey => {
      chatInputRef.current?.addPhotobookImage(imageKey)
    })
  }, [registerAddImageToChat])

  // Re-focus the message input when the user returns to this browser tab,
  // but only if nothing meaningful is focused (avoid stealing from modals/tool inputs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return
      const active = document.activeElement
      // Only re-focus if focus was lost to body (browser dropped it on tab switch)
      if (!active || active === document.body) {
        requestAnimationFrame(() => chatInputRef.current?.focus())
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // Redeem referral code if stored (from invite link flow)
  useRedeemReferral()

  // Update page title with workspace name & track
  useEffect(() => {
    if (workspace) {
      const projectName = workspace.split(".")[0]
      const capitalized = projectName.charAt(0).toUpperCase() + projectName.slice(1)
      document.title = `${capitalized} - Alive`
      trackWorkspaceSelected(workspace)
    } else {
      document.title = "Alive"
    }
  }, [workspace])

  // Track chat page view once on mount
  useEffect(() => {
    trackChatPageViewed({ workspace })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch organizations and auto-select if none selected
  const { organizations, currentUserId, loading: organizationsLoading } = useOrganizations()

  // Fetch all workspaces — used for deferred deep link org resolution.
  // Enabled only when orgs are loaded; shares cache with useOrganizationsQuery's fire-and-forget fetch.
  const { data: allWorkspaces } = useAllWorkspacesQuery(organizations)
  const deepLinkPending = useWorkspaceStoreBase(s => s.deepLinkPending)
  const intentVersion = useWorkspaceStoreBase(s => s.intentVersion)
  const intentVersionAtLoad = useRef(intentVersion)

  // Sync Dexie session once we have a user + org (required before storing messages)
  useEffect(() => {
    const resolvedUserId = user?.id ?? currentUserId
    if (!resolvedUserId) return

    const orgId = selectedOrgId || organizations[0]?.org_id
    if (!orgId) return

    if (dexieSession?.userId === resolvedUserId && dexieSession?.orgId === orgId) return

    setDexieSession({ userId: resolvedUserId, orgId })
  }, [user?.id, currentUserId, selectedOrgId, organizations, dexieSession, setDexieSession])

  // Deferred deep link org resolution: when ?wk= was consumed before org data was
  // available, resolve the orgId once the all-workspaces query completes.
  //
  // Also corrects org-workspace coherence: if ?org= hint was wrong (tampering,
  // stale link, project transfer), the authoritative allWorkspaces data wins.
  //
  // Intent versioning: the coherence correction (Case 2) only applies if no
  // newer user intent has occurred since this effect last captured the version.
  // This prevents a slow allWorkspaces response from overwriting a manual switch
  // that happened while the fetch was in flight.
  useEffect(() => {
    if (!allWorkspaces) return

    // Case 1: deepLinkPending — resolve deferred intent (always applies)
    if (deepLinkPending) {
      for (const [orgId, workspaces] of Object.entries(allWorkspaces)) {
        if (workspaces.some(w => w.hostname === deepLinkPending)) {
          setSelectedOrg(orgId)
          setWorkspace(deepLinkPending, orgId)
          setDeepLinkPending(null)
          return
        }
      }
      // Workspace not found in any org — clear pending so validator can clean up.
      setDeepLinkPending(null)
      return
    }

    // Case 2: no pending, but check coherence of current pair.
    // Only apply if no newer user intent has occurred since the query was triggered.
    const currentVersion = useWorkspaceStoreBase.getState().intentVersion
    if (currentVersion !== intentVersionAtLoad.current) {
      // User acted since allWorkspaces was fetched — their intent wins.
      intentVersionAtLoad.current = currentVersion
      return
    }

    if (workspace && selectedOrgId) {
      for (const [orgId, workspaces] of Object.entries(allWorkspaces)) {
        if (workspaces.some(w => w.hostname === workspace)) {
          if (orgId !== selectedOrgId) {
            console.log(`[ChatPage] Correcting org mismatch: ${selectedOrgId} → ${orgId} for ${workspace}`)
            setSelectedOrg(orgId)
          }
          return
        }
      }
      // Workspace not found in any org — let validateWorkspaceAvailability handle it.
    }
  }, [deepLinkPending, allWorkspaces, workspace, selectedOrgId, setSelectedOrg, setWorkspace, setDeepLinkPending])

  // Fetch conversations from server when workspace changes
  const { syncFromServer } = useDexieMessageActions()
  useEffect(() => {
    if (!mounted || !tabWorkspace || !dexieSession) return

    // Fetch server conversations in background (non-blocking)
    void syncFromServer(tabWorkspace)
  }, [mounted, tabWorkspace, dexieSession, syncFromServer])

  // Check for session expiry (reactive) + proactive heartbeat
  const isSessionExpired = useIsSessionExpired()
  useSessionHeartbeat()

  // Track online/offline status for user feedback
  const isOnline = useOnlineStatus()

  // Session values from useTabIsolatedMessages (single source of truth)
  // sessionTabId is the primary session key for Claude SDK (resume parameter)
  const tabId = sessionTabId
  const tabGroupId = sessionTabGroupId
  const { startNewTabGroup, switchTab } = sessionActions
  // isChatReady derives from tabStore (sessionReady) only - Dexie is for persistence, not readiness
  const isChatReady = !!dexieSession && sessionReady

  // Chat messaging hook - handles sendMessage, streaming, agent supervisor
  const {
    sendMessage,
    isEvaluatingProgress,
    agentManagerAbortRef,
    agentManagerTimeoutRef,
    abortControllerRef,
    currentRequestIdRef,
    isSubmittingByTabRef,
  } = useChatMessaging({
    workspace,
    worktree: requestWorktree,
    worktreesEnabled,
    tabId,
    tabGroupId,
    isTerminal,
    busy,
    addMessage,
    chatInputRef,
    forceScrollToBottom,
    setShowCompletionDots,
  })

  // Stream cancellation hook - must be after useChatMessaging to get the refs
  // Uses sessionTabId from useTabIsolatedMessages (single source of truth)
  const { stopStreaming, isStopping } = useStreamCancellation({
    tabId: sessionTabId,
    tabGroupId: sessionTabGroupId,
    workspace,
    worktree: requestWorktree,
    worktreesEnabled,
    addMessage,
    setShowCompletionDots,
    abortControllerRef,
    currentRequestIdRef,
    isSubmittingByTabRef,
    onDevEvent: event => {
      addDevEvent({
        eventName: ClientRequest.INTERRUPT,
        event: {
          type: ClientRequest.INTERRUPT,
          requestId: currentRequestIdRef.current ?? "unknown",
          timestamp: new Date().toISOString(),
          data: event.data,
        },
        rawSSE: JSON.stringify(event),
      })
    },
  })

  // Stream reconnection - recovers buffered messages when tab becomes visible
  // Uses sessionTabId from useTabIsolatedMessages (single source of truth)
  useStreamReconnect({
    tabId: sessionTabId,
    tabGroupId: sessionTabGroupId,
    workspace,
    worktree: requestWorktree,
    worktreesEnabled,
    isStreaming: busy,
    addMessage,
    mounted,
  })

  // Browser cleanup - sends unload-time cursor ack for reconnect consistency
  // (no cancel beacon on unload; reload should keep background stream running)
  useBrowserCleanup({
    tabId: sessionTabId,
    tabGroupId: sessionTabGroupId,
    workspace,
    worktree: requestWorktree,
    worktreesEnabled,
    lastSeenStreamSeq,
    isStreaming: busy,
    isStopping,
  })

  // Register retry handler for error recovery (no-op for read-only automation transcripts)
  const { registerRetryHandler } = useRetry()
  useEffect(() => {
    if (isAutomationRun) return
    registerRetryHandler(() => {
      // Find the last user message to retry
      const lastUserMessage = [...messages].reverse().find(m => m.type === "user")
      if (lastUserMessage && typeof lastUserMessage.content === "string") {
        // Re-send the message
        sendMessage(lastUserMessage.content)
      }
    })
  }, [messages, sendMessage, registerRetryHandler, isAutomationRun])

  // Tab management - combined switch handler for both conversation hooks
  const {
    tabs,
    closedTabs,
    activeTab: activeTabInGroup,
    handleAddTab,
    handleTabSelect,
    handleTabClose,
    handleTabRename,
    handleTabReopen,
    handleOpenTabGroupInTab,
  } = useTabsManagement({
    workspace: tabWorkspace,
    tabGroupId,
    activeTabId: tabId,
    onSwitchTab: switchTab,
    onInitializeTab: initializeTab,
  })

  // Image upload handler
  const handleAttachmentUpload = useImageUpload({
    workspace: workspace ?? undefined,
    worktree: requestWorktree,
    worktreesEnabled,
    isTerminal,
  })

  // Calculate total domain count from organizations
  const totalDomainCount = organizations.reduce((sum, org) => sum + (org.workspace_count || 0), 0)

  // Auto-scroll to bottom when new messages arrive (unless user scrolled away).
  // Only reacts to `messages` changes — NOT `isScrolledAway` transitions.
  // Without this, when a user manually scrolls back to the bottom, the
  // isScrolledAway→false transition would trigger a redundant scrollIntoView
  // that causes a visible jump.
  const isScrolledAwayRef = useRef(isScrolledAway)
  isScrolledAwayRef.current = isScrolledAway

  useEffect(() => {
    if (!isScrolledAwayRef.current && messages.length > 0) {
      scrollToBottom("smooth")
    }
  }, [messages, scrollToBottom])

  // Handle OAuth callback success/error params
  const urlSearchParams = typeof window !== "undefined" ? window.location.search : ""
  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams)
    if (!params.has("integration") && !params.has("status")) return
    const validated = validateOAuthToastParams(params)

    if (validated) {
      if (validated.status === "success" && validated.successMessage) {
        toast(validated.successMessage)
      } else if (validated.status === "error" && validated.errorMessage) {
        toast(validated.errorMessage)
      }
      const url = new URL(window.location.href)
      stripOAuthCallbackParams(url)
      window.history.replaceState(window.history.state, "", url.toString())
    }
  }, [urlSearchParams])

  const handleSubdomainInitialize = (initialMessage: string, initialWorkspace: string) => {
    setInput(initialMessage)
    if (initialWorkspace) {
      setWorkspace(initialWorkspace)
    }
  }

  const handleSubdomainInitialized = () => {
    setSubdomainInitialized(true)
  }

  const handleGithubImported = useCallback(
    (newWorkspace: string) => {
      trackGithubImportCompleted(newWorkspace)
      const targetOrgId = selectedOrgId || organizations[0]?.org_id
      setWorkspace(newWorkspace, targetOrgId)
      setWorktree(null)
      setGithubImportOpen(false)
      toast(`Switched to ${newWorkspace}`)
    },
    [selectedOrgId, organizations, setWorkspace, setWorktree],
  )

  const handleNewTabGroup = useCallback(async () => {
    if (!tabWorkspace) return
    trackConversationCreated()

    const previousTabId = tabId
    // startNewTabGroup creates a new tabGroup + first tab in tabStore
    const newTabId = startNewTabGroup()
    if (!newTabId) {
      toast("You have 10 tabs open — close one to make room", { id: "tab-limit" })
      return
    }

    // Also create the conversation in Dexie so it appears in the sidebar immediately.
    // startNewTabGroup only writes to the localStorage tab store — the sidebar reads
    // from Dexie, so without this the conversation won't show until the first message.
    const tabs = useTabDataStore.getState().tabsByWorkspace[tabWorkspace] ?? []
    const newTab = tabs.find(t => t.id === newTabId)
    if (newTab) {
      await ensureTabGroupWithTab(tabWorkspace, newTab.tabGroupId, newTabId)
    }

    if (previousTabId) {
      streamingActions.clearTab(previousTabId)
    }
    clearInput()
    setTimeout(() => chatInputRef.current?.focus(), 0)
  }, [tabId, streamingActions, startNewTabGroup, tabWorkspace, ensureTabGroupWithTab])

  const handleNewTabGroupInWorkspace = useCallback(
    async (targetWorkspace: string) => {
      // Switch to the target workspace first
      const orgId = resolveOrgForWorkspace(targetWorkspace, queryClient)
      if (orgId) {
        setSelectedOrg(orgId)
      }
      setWorkspace(targetWorkspace, orgId ?? undefined)

      // Use createTabGroupWithTab directly with targetWorkspace — startNewTabGroup
      // reads workspace from its closure which hasn't updated yet after setWorkspace.
      trackConversationCreated()
      const { tabGroupId: newGroupId, tabId: newTabId } = createTabGroupWithTab(targetWorkspace)
      await ensureTabGroupWithTab(targetWorkspace, newGroupId, newTabId)

      if (tabId) {
        streamingActions.clearTab(tabId)
      }
      clearInput()
      setTimeout(() => chatInputRef.current?.focus(), 0)
    },
    [queryClient, setSelectedOrg, setWorkspace, createTabGroupWithTab, ensureTabGroupWithTab, tabId, streamingActions],
  )

  const handleNewWorktree = useCallback(() => {
    if (!workspace) {
      toast("Pick a site first")
      return
    }
    if (isSuperadminWorkspace) {
      toast("Worktrees aren't available here")
      return
    }
    setWorktreeModalOpen(true)
  }, [workspace, isSuperadminWorkspace])

  const handleInsertTemplate = useCallback((prompt: string) => {
    setInput(prompt)
  }, [])

  const handleTabGroupSelect = useCallback(
    async (selectedTabGroupId: string) => {
      if (!selectedTabGroupId) return
      trackConversationSwitched()

      // Check if the conversation belongs to a different workspace
      if (dexieSession?.userId) {
        const db = getMessageDb(dexieSession.userId)
        const conversation = await db.conversations.get(selectedTabGroupId)
        if (conversation && conversation.workspace !== tabWorkspace) {
          // Cross-workspace click: resolve org and switch workspace first
          const orgId = resolveOrgForWorkspace(conversation.workspace, queryClient) ?? conversation.orgId
          if (orgId) {
            setSelectedOrg(orgId)
          }
          setWorkspace(conversation.workspace, orgId ?? undefined)
          // Open the tab group in the target workspace directly
          // (handleOpenTabGroupInTab uses closure workspace which hasn't updated yet)
          const tab = openTabGroupInTargetWs(conversation.workspace, selectedTabGroupId)
          if (tab?.id) {
            initializeTab(tab.id, selectedTabGroupId, conversation.workspace)
            switchTab(tab.id)
            void dexieLoadTabMessages(tab.id)
            setInput(tab.inputDraft ?? "")
          }
          return
        }
      }

      handleOpenTabGroupInTab(selectedTabGroupId)
    },
    [
      handleOpenTabGroupInTab,
      dexieSession?.userId,
      tabWorkspace,
      queryClient,
      setSelectedOrg,
      setWorkspace,
      initializeTab,
      switchTab,
      openTabGroupInTargetWs,
      dexieLoadTabMessages,
    ],
  )

  // Register conversation opener so workbench agents can navigate to run conversations
  useEffect(() => {
    registerOpenConversation(handleTabGroupSelect)
  }, [registerOpenConversation, handleTabGroupSelect])

  const handleArchiveTabGroup = useCallback(
    async (tabGroupIdToArchive: string) => {
      if (!tabGroupIdToArchive) return
      trackConversationArchived()

      const nextTab =
        tabGroupIdToArchive === tabGroupId
          ? (workspaceTabs.find(tab => tab.tabGroupId !== tabGroupIdToArchive) ?? null)
          : null

      await archiveConversation(tabGroupIdToArchive)
      if (tabWorkspace) {
        removeTabGroup(tabWorkspace, tabGroupIdToArchive)
      }

      if (tabGroupIdToArchive === tabGroupId && tabWorkspace) {
        if (nextTab) {
          setActiveTab(tabWorkspace, nextTab.id)
          switchTab(nextTab.id)
          await ensureTabGroupWithTab(tabWorkspace, nextTab.tabGroupId, nextTab.id)
        } else {
          // Create a new tab group when archiving the current one
          const created = createTabGroupWithTab(tabWorkspace)
          if (created) {
            await ensureTabGroupWithTab(tabWorkspace, created.tabGroupId, created.tabId)
          }
        }
        clearInput()
      }
    },
    [
      archiveConversation,
      tabGroupId,
      workspaceTabs,
      tabWorkspace,
      removeTabGroup,
      setActiveTab,
      switchTab,
      ensureTabGroupWithTab,
      createTabGroupWithTab,
    ],
  )

  const handleRenameTabGroup = useCallback(
    async (tabGroupIdToRename: string, title: string) => {
      if (!tabGroupIdToRename || !title.trim()) return
      trackConversationRenamed()
      await renameConversation(tabGroupIdToRename, title)
    },
    [renameConversation],
  )

  const settingsInitialTab = modals.settings?.initialTab
  const isSettingsOpen = !!modals.settings

  // Both openSidebar (Zustand) and openSettings (useState) are synchronous —
  // React 18+ batches them into a single render. No flash.
  const handleNavSettingsClick = useCallback(() => {
    if (isSettingsOpen) {
      modals.closeSettings()
    } else {
      openSidebar()
      modals.openSettings()
    }
  }, [isSettingsOpen, modals.closeSettings, modals.openSettings, openSidebar])

  const layout = (
    <div
      className="h-[100dvh] flex flex-row overflow-hidden dark:bg-[#1a1a1a] dark:text-white"
      data-testid={mounted && workspace ? "workspace-ready" : "workspace-loading"}
      data-chat-ready={isChatReady}
    >
      {/* Full-height sidebar */}
      <ConversationSidebar
        workspace={tabWorkspace}
        worktree={worktree}
        isSuperadminWorkspace={isSuperadminWorkspace}
        activeTabGroupId={sessionTabGroupId}
        onTabGroupSelect={handleTabGroupSelect}
        onArchiveTabGroup={handleArchiveTabGroup}
        onRenameTabGroup={handleRenameTabGroup}
        onNewConversation={handleNewTabGroup}
        onNewConversationInWorkspace={handleNewTabGroupInWorkspace}
        onNewWorktree={handleNewWorktree}
        onSelectWorktree={setWorktree}
        worktreeModalOpen={worktreeModalOpen}
        onWorktreeModalOpenChange={setWorktreeModalOpen}
        onInvite={modals.openInvite}
        settingsMode={!!modals.settings}
        onToggleSettings={modals.toggleSettings}
        onSettingsClick={handleNavSettingsClick}
        onFeedbackClick={modals.openFeedback}
        onTemplatesClick={modals.openTemplates}
      />

      {/* Main content column: chat + workbench */}
      <div data-panel-role="chat-main-column" className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Content area: chat + workbench side by side (or settings content) */}
        <div data-panel-role="chat-content-area" className="flex-1 overflow-hidden min-h-0 relative">
          {/* Settings content — shown when sidebar is in settings mode */}
          {modals.settings && (
            <section
              className="absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-[#faf8f5] dark:bg-[#141311]"
              aria-label="Settings"
              data-panel-role="settings-overlay"
            >
              <Suspense fallback={null}>
                <SettingsContent />
              </Suspense>
            </section>
          )}

          <PanelGroup orientation="horizontal" className="h-full">
            {/* Chat panel — always present, always dominant */}
            <Panel
              id={CHAT_PANEL.id}
              minSize={CHAT_PANEL.min}
              defaultSize={CHAT_PANEL.default}
              className={modals.settings || (showWorkbench && isWorkbenchFullscreen) ? "hidden" : ""}
            >
              <section
                data-panel-role="chat-area"
                className="flex flex-col overflow-hidden relative h-full bg-[#faf8f5] dark:bg-[#1a1a1a]"
                aria-label="Chat area"
                onDragEnter={handleChatDragEnter}
                onDragLeave={handleChatDragLeave}
                onDragOver={handleChatDragOver}
                onDrop={handleChatDrop}
              >
                <OfflineBanner isOnline={isOnline} />
                <ChatDropOverlay isDragging={isDragging} />
                <Suspense fallback={null}>
                  <SubdomainInitializer
                    onInitialize={handleSubdomainInitialize}
                    onInitialized={handleSubdomainInitialized}
                    isInitialized={subdomainInitialized}
                    isMounted={mounted}
                  />
                </Suspense>
                <div
                  data-panel-role="chat-main-content"
                  className="flex-1 min-h-0 grid grid-rows-[auto_1fr_auto] grid-cols-[1fr]"
                >
                  {/* Tab bar — fixed header, outside scroll */}
                  {(tabs.length > 0 || closedTabs.length > 0) && (
                    <div className="row-start-1 bg-[#faf8f5]/80 dark:bg-[#1a1a1a]/80 backdrop-blur-xl z-10">
                      <TabBar
                        tabs={tabs}
                        closedTabs={closedTabs}
                        activeTabId={activeTabInGroup?.id ?? null}
                        onTabSelect={handleTabSelect}
                        onTabClose={handleTabClose}
                        onTabRename={handleTabRename}
                        onTabReopen={handleTabReopen}
                        onAddTab={handleAddTab}
                        workspace={workspace}
                        isSidebarOpen={isSidebarOpen}
                        onToggleSidebar={toggleSidebar}
                      />
                    </div>
                  )}

                  {/* Messages */}
                  <div
                    ref={containerRef}
                    data-panel-role="chat-messages-scroll"
                    className="row-start-2 row-end-4 col-start-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col scrollbar-thin overscroll-contain"
                    style={{ scrollPaddingBottom: inputHeight + 32 }}
                  >
                    <div
                      className="p-5 mx-auto w-full md:max-w-[calc(42rem+2rem)] min-w-0 flex-1"
                      style={{ paddingBottom: inputHeight + 32 }}
                    >
                      {messages.length === 0 && !busy && !isLoadingMessages && (
                        <ChatEmptyState
                          workspace={workspace}
                          totalDomainCount={totalDomainCount}
                          isLoading={organizationsLoading}
                          onImportGithub={() => setGithubImportOpen(true)}
                          onSelectSite={() => modals.openSettings("websites")}
                        />
                      )}

                      {sessionTabId && (
                        <MessageList
                          messages={messages}
                          tabId={sessionTabId}
                          isDebugMode={isDebugMode}
                          isAutomationRun={isAutomationRun}
                          onSubmitAnswer={sendMessage}
                        />
                      )}

                      {/* Show pending tools (currently executing) - replaces generic "thinking" when tools are running */}
                      <PendingToolsIndicator tabId={sessionTabId} suppressThinking={isCompactionInProgress} />

                      {!isAutomationRun && (
                        <AgentManagerIndicator
                          isEvaluating={isEvaluatingProgress}
                          workspace={workspace}
                          agentManagerAbortRef={agentManagerAbortRef}
                          agentManagerTimeoutRef={agentManagerTimeoutRef}
                          onCancel={() => {
                            if (getInputValue().startsWith("agentmanager>")) clearInput()
                            // isEvaluatingProgress is managed by useChatMessaging hook
                          }}
                        />
                      )}

                      {/* Scroll anchor - Intersection Observer watches this to detect if user is at bottom */}
                      <div ref={anchorRef} className="h-px" />
                    </div>
                  </div>

                  {/* Input — row 3, overlaps scroll area. Text peeks through rounded corners. */}
                  <div ref={inputWrapperRef} className="row-start-3 col-start-1 z-10">
                    <div className="relative mx-auto w-full md:max-w-2xl">
                      {/* Jump to bottom button */}
                      {isHydrated && (
                        <AnimatePresence>
                          {isScrolledAway && messages.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-0 right-0 bottom-full mb-2 z-10 flex justify-center pointer-events-none"
                            >
                              <button
                                type="button"
                                onClick={() => forceScrollToBottom()}
                                aria-label="Scroll to bottom"
                                className="pointer-events-auto size-8 flex items-center justify-center rounded-full bg-black/80 dark:bg-white/90 text-white dark:text-black shadow-lg hover:bg-black dark:hover:bg-white transition-colors duration-100 active:scale-95"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M12 5v14" />
                                  <path d="m19 12-7 7-7-7" />
                                </svg>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      )}
                      {isAutomationRun ? (
                        <ReadOnlyTranscriptBar />
                      ) : tabId ? (
                        <ChatInput
                          ref={chatInputRef}
                          busy={busy}
                          isReady={isChatReady && !!workspace}
                          isStopping={isStopping}
                          onSubmit={sendMessage}
                          onStop={stopStreaming}
                          onOpenTemplates={modals.openTemplates}
                          tabId={tabId}
                          config={{
                            enableAttachments: true,
                            enableCamera: true,
                            maxAttachments: 5,
                            maxFileSize: 20 * 1024 * 1024,
                            workspace: workspace ?? undefined,
                            worktree: requestWorktree,
                            placeholder:
                              !workspace && mounted && !organizationsLoading
                                ? "Select a site to start chatting..."
                                : "Tell me what to change...",
                            onAttachmentUpload: handleAttachmentUpload,
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            </Panel>

            {/* Resize handle */}
            <PanelResizeHandle
              id={RESIZE_HANDLE_ID}
              className={`hidden md:flex w-[2px] items-center justify-center cursor-col-resize transition-colors hover:bg-blue-500/40 data-[resize-handle-active]:bg-blue-500/60 ${!showWorkbench || modals.settings ? "!hidden" : ""}`}
              style={{ touchAction: "none" }}
            />

            {/* Workbench panel — always rendered, collapsed when hidden */}
            <Panel
              id={WORKBENCH_PANEL.id}
              panelRef={workbenchPanelRef}
              collapsible
              collapsedSize={WORKBENCH_PANEL.collapsedSize}
              minSize={WORKBENCH_PANEL.min}
              defaultSize={showWorkbench ? WORKBENCH_PANEL.default : WORKBENCH_PANEL.collapsedSize}
              className={`hidden md:flex h-full overflow-hidden border-l border-black/[0.08] dark:border-white/[0.04] ${isWorkbenchFullscreen ? "!flex flex-1" : ""}`}
            >
              <Workbench />
            </Panel>
          </PanelGroup>
        </div>
      </div>

      {/* Mobile preview overlay - not shown for alive workspace */}
      {isHydrated && (
        <AnimatePresence>
          {showWorkbench && modals.mobilePreview && !isSuperadminWorkspace && (
            <WorkbenchMobile
              onClose={modals.closeMobilePreview}
              busy={busy}
              statusText={statusText}
              onStop={stopStreaming}
            >
              {isAutomationRun ? (
                <ReadOnlyTranscriptBar />
              ) : tabId ? (
                <ChatInput
                  ref={chatInputRef}
                  busy={busy}
                  isReady={isChatReady && !!workspace}
                  isStopping={isStopping}
                  onSubmit={sendMessage}
                  onStop={stopStreaming}
                  hideToolbar
                  tabId={tabId}
                  config={{
                    enableAttachments: true,
                    enableCamera: false,
                    maxAttachments: 5,
                    maxFileSize: 20 * 1024 * 1024,
                    workspace: workspace ?? undefined,
                    worktree: requestWorktree,
                    placeholder: "Tell me what to change...",
                    onAttachmentUpload: handleAttachmentUpload,
                  }}
                />
              ) : null}
            </WorkbenchMobile>
          )}
        </AnimatePresence>
      )}

      {modals.feedback && (
        <FeedbackModal
          onClose={modals.closeFeedback}
          workspace={workspace ?? undefined}
          conversationId={tabId ?? undefined}
        />
      )}

      {modals.templates && (
        <SuperTemplatesModal onClose={modals.closeTemplates} onInsertTemplate={handleInsertTemplate} />
      )}
      {modals.invite && <InviteModal onClose={modals.closeInvite} />}
      {githubImportOpen && (
        <GithubImportModal
          onClose={() => {
            setGithubImportOpen(false)
          }}
          onImported={handleGithubImported}
          orgId={selectedOrgId || organizations[0]?.org_id}
        />
      )}
      {isSessionExpired && <SessionExpiredModal />}
    </div>
  )

  // Always wrap with SettingsTabProvider so the React tree is stable.
  // Toggling the provider conditionally would change the root element type,
  // causing React to unmount/remount the entire layout on settings open/close.
  return <SettingsTabProvider initialTab={settingsInitialTab}>{layout}</SettingsTabProvider>
}

function ChatPageWrapper() {
  return (
    <RetryProvider>
      <DevTerminalProvider>
        <WorkbenchProvider>
          <ChatPageContent />
        </WorkbenchProvider>
      </DevTerminalProvider>
    </RetryProvider>
  )
}

export default function ChatPage() {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { padding: "12px 16px", maxWidth: 420 },
          className:
            "!bg-white dark:!bg-zinc-900 !text-zinc-600 dark:!text-zinc-400 !text-[13px] !shadow-[0_2px_8px_rgba(0,0,0,0.06)] !border !border-zinc-200 dark:!border-zinc-800 !rounded-xl",
          success: {
            className:
              "!bg-white dark:!bg-zinc-900 !text-zinc-600 dark:!text-zinc-400 !text-[13px] !shadow-[0_2px_8px_rgba(0,0,0,0.06)] !border !border-zinc-200 dark:!border-zinc-800 !rounded-xl",
            iconTheme: { primary: "#a1a1aa", secondary: "#fff" },
          },
          error: {
            className:
              "!bg-white dark:!bg-zinc-900 !text-zinc-600 dark:!text-zinc-400 !text-[13px] !shadow-[0_2px_8px_rgba(0,0,0,0.06)] !border !border-zinc-200 dark:!border-zinc-800 !rounded-xl",
            iconTheme: { primary: "#a1a1aa", secondary: "#fff" },
          },
        }}
      />
      <Suspense fallback={null}>
        <ChatPageWrapper />
      </Suspense>
    </>
  )
}
