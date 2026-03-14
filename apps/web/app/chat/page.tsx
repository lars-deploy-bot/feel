"use client"
import { type QueryClient, useQueryClient } from "@tanstack/react-query"
import { SUPERADMIN_WORKSPACE_NAME } from "@webalive/shared/constants"
import { AnimatePresence, motion } from "framer-motion"
import { useQueryState } from "nuqs"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FeedbackModal } from "@/components/modals/FeedbackModal"
import { GithubImportModal } from "@/components/modals/GithubImportModal"
import { InviteModal } from "@/components/modals/InviteModal"
import { SessionExpiredModal } from "@/components/modals/SessionExpiredModal"
import { SuperTemplatesModal } from "@/components/modals/SuperTemplatesModal"
import { ChatDropOverlay } from "@/features/chat/components/ChatDropOverlay"
import { ChatInput } from "@/features/chat/components/ChatInput"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import { CollapsibleToolGroup } from "@/features/chat/components/message-renderers/CollapsibleToolGroup"
import { MessageWrapper } from "@/features/chat/components/message-renderers/MessageWrapper"
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
import { groupToolMessages, type RenderItem } from "@/features/chat/lib/group-tool-messages"
import { renderMessage, shouldRenderMessage } from "@/features/chat/lib/message-renderer"
import { RetryProvider, useRetry } from "@/features/chat/lib/retry-context"
import { useWorkbenchContext, WorkbenchProvider } from "@/features/chat/lib/workbench-context"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { SettingsContent } from "@/features/settings/SettingsContent"
import { SettingsTabProvider } from "@/features/settings/SettingsTabProvider"
import { ConversationSidebar } from "@/features/sidebar/ConversationSidebar"
import { useSidebarActions, useSidebarOpen } from "@/features/sidebar/sidebarStore"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { validateWorktreeSlug } from "@/features/workspace/lib/worktree-utils"
import { useRedeemReferral } from "@/hooks/useRedeemReferral"
import {
  trackChatPageViewed,
  trackConversationArchived,
  trackConversationCreated,
  trackConversationRenamed,
  trackConversationSwitched,
  trackConversationUnarchived,
  trackGithubImportCompleted,
  trackWorkspaceSelected,
} from "@/lib/analytics/events"
import {
  useDexieCurrentConversationId,
  useDexieCurrentTabId,
  useDexieMessageActions,
  useDexieSession,
} from "@/lib/db/dexieMessageStore"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { useSessionHeartbeat } from "@/lib/hooks/useSessionHeartbeat"
import { useAllWorkspacesQuery, type WorkspaceInfo } from "@/lib/hooks/useSettingsQueries"
import { validateOAuthToastParams } from "@/lib/integrations/toast-validation"
import { useIsSessionExpired } from "@/lib/stores/authStore"
import { useDebugVisible, useWorkbench, useWorkbenchFullscreen } from "@/lib/stores/debug-store"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"
import { useAppHydrated } from "@/lib/stores/HydrationBoundary"
import { useLastSeenStreamSeq, useStreamingActions } from "@/lib/stores/streamingStore"
import { useTabActions, useTabDataStore } from "@/lib/stores/tabStore"
import { useSelectedOrgId, useWorkspaceActions, useWorkspaceStoreBase } from "@/lib/stores/workspaceStore"
import { queryKeys } from "@/lib/tanstack/queryKeys"
import { QUERY_KEYS } from "@/lib/url/queryState"
// Local components
import { AgentManagerIndicator, ChatEmptyState, Nav, OfflineBanner, TabBar } from "./components"
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
  const [msg, setMsg] = useState("")
  const storeTabId = useDexieCurrentTabId()
  const storeTabGroupId = useDexieCurrentConversationId()
  const {
    ensureTabGroupWithTab,
    addMessage,
    switchTab: switchDexieTab,
    archiveConversation,
    unarchiveConversation,
    renameConversation,
    setSession: setDexieSession,
    reopenTab: dexieReopenTab,
  } = useDexieMessageActions()
  const dexieSession = useDexieSession()
  const { createTabGroupWithTab, removeTabGroup, setActiveTab, reopenTab } = useTabActions()

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

  // Smart scroll using Intersection Observer
  const { containerRef, anchorRef, isScrolledAway, scrollToBottom, forceScrollToBottom } = useChatScroll({
    threshold: 100,
    debounceMs: 150,
  })

  const { user } = useAuth()
  const selectedOrgId = useSelectedOrgId()
  const { setSelectedOrg } = useWorkspaceActions()
  const _isAdmin = user?.isAdmin ?? false

  // Tabs are on by default for all users
  const chatInputRef = useRef<ChatInputHandle | null>(null)
  const photoButtonRef = useRef<HTMLButtonElement>(null)
  const showWorkbenchRaw = useWorkbench()
  const isWorkbenchFullscreen = useWorkbenchFullscreen()
  const isDebugMode = useDebugVisible()
  const { addEvent: addDevEvent } = useDevTerminal()
  const { workspace, worktree, workspaceKey, isTerminal, mounted, setWorkspace, setWorktree } = useWorkspace({
    allowEmpty: true,
  })
  const tabWorkspace = workspaceKey

  // Tab-isolated messages, busy state, and session actions from single source of truth
  const {
    messages,
    busy,
    tabId: sessionTabId,
    tabGroupId: sessionTabGroupId,
    isReady: sessionReady,
    activeTab,
    workspaceTabs,
    actions: sessionActions,
    conversation,
    userId: dexieUserId,
  } = useTabIsolatedMessages({ workspace: tabWorkspace })

  // Automation transcript polling — automation runs write to app.messages directly
  // (not via Redis stream buffer), so we poll fetchTabMessages() instead.
  const isAutomationRun = conversation?.source === "automation_run"
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
  const wkConsumedRef = useRef(false)
  const queryClient = useQueryClient()
  const { setSelectedOrg, setDeepLinkPending } = useWorkspaceActions()
  useEffect(() => {
    if (!mounted || !wkParam || wkConsumedRef.current) return
    wkConsumedRef.current = true
    if (wkParam !== workspace) {
      console.log("[ChatPage] Setting workspace from URL param:", wkParam)

      // Resolve orgId for this workspace so the org picker updates correctly
      const resolvedOrgId = resolveOrgForWorkspace(wkParam, queryClient)

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
  }, [mounted, wkParam, workspace, setWorkspace, setWkParam, queryClient, setSelectedOrg, setDeepLinkPending])

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

  // Superadmin workspace (alive) shows terminal & code views only
  const isSuperadminWorkspace = workspace === SUPERADMIN_WORKSPACE_NAME
  const showWorkbench = showWorkbenchRaw // Show for all workspaces

  const streamingActions = useStreamingActions()
  const lastSeenStreamSeq = useLastSeenStreamSeq(sessionTabId)
  const { registerElementSelectHandler } = useWorkbenchContext()

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
      setMsg(prev => (prev.trim() ? `${prev} ${reference}` : reference))
      setTimeout(() => chatInputRef.current?.focus(), 0)
    })
  }, [registerElementSelectHandler])

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
  useEffect(() => {
    if (!deepLinkPending || !allWorkspaces) return

    for (const [orgId, workspaces] of Object.entries(allWorkspaces)) {
      if (workspaces.some(w => w.hostname === deepLinkPending)) {
        setSelectedOrg(orgId)
        setWorkspace(deepLinkPending, orgId)
        setDeepLinkPending(null)
        return
      }
    }
    // allWorkspaces loaded but workspace not found — workspace genuinely doesn't exist.
    // Clear the pending flag so validateWorkspaceAvailability can clean up.
    setDeepLinkPending(null)
  }, [deepLinkPending, allWorkspaces, setSelectedOrg, setWorkspace, setDeepLinkPending])

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
    msg,
    setMsg,
    addMessage,
    chatInputRef,
    forceScrollToBottom,
    setShowCompletionDots,
  })

  // Stream cancellation hook - must be after useChatMessaging to get the refs
  // Uses sessionTabId from useTabIsolatedMessages (single source of truth)
  const { stopStreaming, isStopping } = useStreamCancellation({
    tabId: sessionTabId ?? "",
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
  const handleSwitchConversationForTabs = useCallback(
    (id: string) => {
      switchTab(id)
      switchDexieTab(id)
    },
    [switchTab, switchDexieTab],
  )

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
    onSwitchTab: handleSwitchConversationForTabs,
    onInitializeTab: initializeTab,
    currentInput: msg,
    onInputRestore: setMsg,
  })

  // Ensure the session tab is mapped to Dexie (for message persistence)
  // activeTab is now the single source of truth from useActiveSession
  useEffect(() => {
    if (!mounted || !tabWorkspace || !dexieSession || !activeTab) return

    // Sync Dexie store if it doesn't match the active tab
    // Tab.id IS the conversation key
    if (storeTabId === activeTab.id && storeTabGroupId === activeTab.tabGroupId) return
    void ensureTabGroupWithTab(tabWorkspace, activeTab.tabGroupId, activeTab.id)
  }, [
    mounted,
    tabWorkspace,
    dexieSession,
    activeTab?.id,
    activeTab?.tabGroupId,
    ensureTabGroupWithTab,
    storeTabId,
    storeTabGroupId,
  ])

  // Image upload handler
  const handleAttachmentUpload = useImageUpload({
    workspace: workspace ?? undefined,
    worktree: requestWorktree,
    worktreesEnabled,
    isTerminal,
  })

  // Calculate total domain count from organizations
  const totalDomainCount = organizations.reduce((sum, org) => sum + (org.workspace_count || 0), 0)

  // Auto-scroll to bottom when new messages arrive (unless user scrolled away)
  // Uses Intersection Observer under the hood - more reliable than scroll position math
  useEffect(() => {
    if (!isScrolledAway && messages.length > 0) {
      scrollToBottom("auto")
    }
  }, [messages, isScrolledAway, scrollToBottom])

  // Handle OAuth callback success/error params
  const urlSearchParams = typeof window !== "undefined" ? window.location.search : ""
  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams)
    if (!params.has("integration") && !params.has("status")) return
    const validated = validateOAuthToastParams(params)

    if (validated) {
      if (validated.status === "success" && validated.successMessage) {
        toast.success(validated.successMessage)
      } else if (validated.status === "error" && validated.errorMessage) {
        toast.error(validated.errorMessage)
      }
      const cleanUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, "", cleanUrl)
    }
  }, [urlSearchParams])

  const handleSubdomainInitialize = (initialMessage: string, initialWorkspace: string) => {
    setMsg(initialMessage)
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
      toast.success(`Opened ${newWorkspace}`)
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
      toast.error("Tab limit reached. Close a tab to open a new one.", { id: "tab-limit" })
      return
    }

    if (previousTabId) {
      streamingActions.clearTab(previousTabId)
    }
    setMsg("")
    setTimeout(() => chatInputRef.current?.focus(), 0)
  }, [tabId, streamingActions, startNewTabGroup, tabWorkspace])

  const handleNewWorktree = useCallback(() => {
    if (!workspace) {
      toast.error("Select a site before creating a worktree.")
      return
    }
    if (isSuperadminWorkspace) {
      toast.error("Worktrees are not available in the Alive workspace.")
      return
    }
    setWorktreeModalOpen(true)
  }, [workspace, isSuperadminWorkspace])

  const handleInsertTemplate = useCallback((prompt: string) => {
    setMsg(prompt)
  }, [])

  const handleTabGroupSelect = useCallback(
    (selectedTabGroupId: string) => {
      if (!selectedTabGroupId) return
      trackConversationSwitched()
      handleOpenTabGroupInTab(selectedTabGroupId)
    },
    [handleOpenTabGroupInTab],
  )

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
        setMsg("")
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

  const handleUnarchiveTabGroup = useCallback(
    async (tabGroupIdToUnarchive: string) => {
      if (!tabGroupIdToUnarchive) return
      trackConversationUnarchived()
      await unarchiveConversation(tabGroupIdToUnarchive)
    },
    [unarchiveConversation],
  )

  const settingsInitialTab = modals.settings?.initialTab

  const handleNavSettingsClick = useCallback(() => {
    if (modals.settings) {
      modals.closeSettings()
    } else {
      openSidebar()
      modals.openSettings()
    }
  }, [modals, openSidebar])

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
        onUnarchiveTabGroup={handleUnarchiveTabGroup}
        onRenameTabGroup={handleRenameTabGroup}
        onNewConversation={handleNewTabGroup}
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
        onPhotosClick={modals.togglePhotoMenu}
      />

      {/* Main content column: nav + chat + workbench */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Nav
          onFeedbackClick={modals.openFeedback}
          onTemplatesClick={modals.openTemplates}
          showPhotoMenu={modals.photoMenu}
          onPhotoMenuToggle={modals.togglePhotoMenu}
          onPhotoMenuClose={modals.closePhotoMenu}
          photoButtonRef={photoButtonRef}
          chatInputRef={chatInputRef}
          workspace={workspace}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          settingsMode={!!modals.settings}
          onSettingsClick={handleNavSettingsClick}
        />

        {/* Content area: chat + workbench side by side (or settings content) */}
        <div className="flex-1 flex flex-row overflow-hidden min-h-0 relative">
          {/* Settings content — shown when sidebar is in settings mode */}
          {modals.settings && (
            <section
              className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain bg-zinc-50 dark:bg-zinc-950"
              aria-label="Settings"
              data-testid="settings-overlay"
            >
              <Suspense fallback={null}>
                <SettingsContent />
              </Suspense>
            </section>
          )}

          <section
            className={`flex-1 flex flex-col overflow-hidden relative min-w-0 ${modals.settings || (showWorkbench && isWorkbenchFullscreen) ? "hidden" : ""}`}
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
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Tabs - shown when there are tabs, or when there are closed tabs to reopen */}
              {(tabs.length > 0 || closedTabs.length > 0) && (
                <TabBar
                  tabs={tabs}
                  closedTabs={closedTabs}
                  activeTabId={activeTabInGroup?.id ?? null}
                  onTabSelect={handleTabSelect}
                  onTabClose={handleTabClose}
                  onTabRename={handleTabRename}
                  onTabReopen={handleTabReopen}
                  onAddTab={handleAddTab}
                />
              )}

              {/* Messages */}
              <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-8 flex flex-col">
                <div className="p-4 mx-auto w-full md:max-w-[calc(42rem+2rem)] min-w-0 flex-1">
                  {messages.length === 0 && !busy && (
                    <ChatEmptyState
                      workspace={workspace}
                      totalDomainCount={totalDomainCount}
                      isLoading={organizationsLoading}
                      onImportGithub={() => setGithubImportOpen(true)}
                      onSelectSite={() => modals.openSettings("websites")}
                    />
                  )}

                  {(() => {
                    const filteredMessages = messages.filter((message, idx) => {
                      // Hide "compacting" spinner once its compaction cycle completes
                      // (a compact_boundary exists AFTER this compacting message)
                      if (message.type === "compacting") {
                        const nextBoundary = messages.findIndex((m, i) => i > idx && m.type === "compact_boundary")
                        if (nextBoundary >= 0) return false
                      }
                      return shouldRenderMessage(message, isDebugMode)
                    })

                    // Group consecutive exploration tool results (Read, Glob, Grep)
                    const renderItems: RenderItem[] = groupToolMessages(filteredMessages)

                    return renderItems.map(item => {
                      if (item.type === "group") {
                        return (
                          <MessageWrapper
                            key={`group-${item.messages[0].id}`}
                            messageId={item.messages[0].id}
                            tabId={sessionTabId ?? ""}
                            canDelete={false}
                          >
                            <CollapsibleToolGroup
                              messages={item.messages}
                              trailingTaskResult={item.trailingTaskResult}
                              subagentSummary={item.subagentSummary}
                              tabId={sessionTabId ?? undefined}
                              onSubmitAnswer={sendMessage}
                            />
                          </MessageWrapper>
                        )
                      }

                      const { message, index } = item
                      const content = renderMessage(message, {
                        onSubmitAnswer: sendMessage,
                        tabId: sessionTabId ?? undefined,
                      })
                      // Skip rendering wrapper if component returns null
                      if (!content) return null

                      // Determine if this message can be deleted:
                      // - Must have a previous assistant message with UUID to resume from
                      // - Only user messages and assistant messages with visible content can be deleted
                      // - NEVER deletable in read-only automation transcripts
                      const canDelete =
                        !isAutomationRun &&
                        sessionTabId != null &&
                        index > 0 &&
                        (message.type === "user" || message.type === "sdk_message") &&
                        // Check if there's any previous assistant message with a UUID
                        filteredMessages.slice(0, index).some(m => {
                          if (m.type !== "sdk_message") return false
                          const sdkContent = m.content
                          if (typeof sdkContent !== "object" || sdkContent === null) return false
                          return (
                            "type" in sdkContent &&
                            sdkContent.type === "assistant" &&
                            "uuid" in sdkContent &&
                            !!sdkContent.uuid
                          )
                        })

                      const isTextMessage =
                        message.type === "user" ||
                        (message.type === "sdk_message" &&
                          typeof message.content === "object" &&
                          message.content !== null &&
                          "type" in message.content &&
                          message.content.type === "assistant")

                      return (
                        <MessageWrapper
                          key={message.id}
                          messageId={message.id}
                          tabId={sessionTabId ?? ""}
                          canDelete={canDelete}
                          align={message.type === "user" ? "right" : "left"}
                          showActions={isTextMessage}
                        >
                          {content}
                        </MessageWrapper>
                      )
                    })
                  })()}

                  {/* Show pending tools (currently executing) - replaces generic "thinking" when tools are running */}
                  <PendingToolsIndicator tabId={sessionTabId} suppressThinking={isCompactionInProgress} />

                  {!isAutomationRun && (
                    <AgentManagerIndicator
                      isEvaluating={isEvaluatingProgress}
                      message={msg}
                      workspace={workspace}
                      agentManagerAbortRef={agentManagerAbortRef}
                      agentManagerTimeoutRef={agentManagerTimeoutRef}
                      onCancel={() => {
                        if (msg.startsWith("agentmanager>")) setMsg("")
                        // isEvaluatingProgress is managed by useChatMessaging hook
                      }}
                    />
                  )}

                  {/* Scroll anchor - Intersection Observer watches this to detect if user is at bottom */}
                  <div ref={anchorRef} className="h-px" />
                </div>
              </div>

              {/* Input */}
              <div className="relative mx-auto w-full md:max-w-2xl">
                {/* Jump to bottom button - positioned above input, transparent background */}
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
                          className="pointer-events-auto px-3 py-1.5 rounded-full bg-black/80 dark:bg-white/90 text-white dark:text-black text-sm font-medium shadow-lg hover:bg-black dark:hover:bg-white transition-colors active:scale-95"
                        >
                          ↓ New messages
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
                {isAutomationRun ? (
                  <ReadOnlyTranscriptBar />
                ) : (
                  <ChatInput
                    ref={chatInputRef}
                    message={msg}
                    setMessage={setMsg}
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
                )}
              </div>
            </div>
          </section>

          {/* Workbench - desktop only, hidden when settings open */}
          {showWorkbench && !modals.settings && (
            <div className={`hidden md:flex h-full overflow-hidden ${isWorkbenchFullscreen ? "flex-1" : ""}`}>
              <Workbench />
            </div>
          )}
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
              ) : (
                <ChatInput
                  ref={chatInputRef}
                  message={msg}
                  setMessage={setMsg}
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
              )}
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
          duration: 5000,
          error: {
            className:
              "!bg-red-50 !text-red-900 !border !border-red-200 dark:!bg-red-950/90 dark:!text-red-100 dark:!border-red-800/50",
            iconTheme: { primary: "#dc2626", secondary: "#fff" },
          },
        }}
      />
      <Suspense fallback={null}>
        <ChatPageWrapper />
      </Suspense>
    </>
  )
}
