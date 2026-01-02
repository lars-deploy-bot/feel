"use client"
import { SUPERADMIN } from "@webalive/shared"
import { AnimatePresence, motion } from "framer-motion"
import { PanelLeft } from "lucide-react"
import { useQueryState } from "nuqs"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FeedbackModal } from "@/components/modals/FeedbackModal"
import { InviteModal } from "@/components/modals/InviteModal"
import { SessionExpiredModal } from "@/components/modals/SessionExpiredModal"
import { SettingsModal } from "@/components/modals/SettingsModal"
import { SuperTemplatesModal } from "@/components/modals/SuperTemplatesModal"
import { ChatDropOverlay } from "@/features/chat/components/ChatDropOverlay"
import { ChatInput } from "@/features/chat/components/ChatInput"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import { ConversationSidebar } from "@/features/chat/components/ConversationSidebar"
import { DevTerminal } from "@/features/chat/components/DevTerminal"
import { Sandbox } from "@/features/chat/components/Sandbox"
import { SandboxMobile } from "@/features/chat/components/SandboxMobile"
import { SubdomainInitializer } from "@/features/chat/components/SubdomainInitializer"
import { PendingToolsIndicator } from "@/features/chat/components/PendingToolsIndicator"
import { ThinkingGroup } from "@/features/chat/components/ThinkingGroup"
import { useConversationSession } from "@/features/chat/hooks/useConversationSession"
import { useImageUpload } from "@/features/chat/hooks/useImageUpload"
import { useStreamCancellation } from "@/features/chat/hooks/useStreamCancellation"
import { useStreamReconnect } from "@/features/chat/hooks/useStreamReconnect"
import { ClientRequest, DevTerminalProvider, useDevTerminal } from "@/features/chat/lib/dev-terminal-context"
import { groupMessages } from "@/features/chat/lib/message-grouper"
import { renderMessage } from "@/features/chat/lib/message-renderer"
import { SandboxProvider, useSandboxContext } from "@/features/chat/lib/sandbox-context"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useRedeemReferral } from "@/hooks/useRedeemReferral"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { validateOAuthToastParams } from "@/lib/integrations/toast-validation"
import { useIsSessionExpired } from "@/lib/stores/authStore"
import { useSidebarActions, useSidebarOpen } from "@/lib/stores/conversationSidebarStore"
import { isDevelopment, useDebugActions, useSandbox, useSSETerminal } from "@/lib/stores/debug-store"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"
import { useApiKey, useModel } from "@/lib/stores/llmStore"
import { useCurrentConversationId, useMessageActions } from "@/lib/stores/messageStore"
import { useStreamingActions } from "@/lib/stores/streamingStore"
// Local components
import { AgentManagerIndicator, ChatEmptyState, ChatHeader, TabBar, WorkspaceInfoBar } from "./components"
import {
  useChatDragDrop,
  useChatMessaging,
  useModals,
  useStatusText,
  useTabIsolatedMessages,
  useTabsManagement,
} from "./hooks"

// Build version for deployment verification
const BUILD_VERSION = "2025-11-12-direct-execution"

function ChatPageContent() {
  const [msg, setMsg] = useState("")
  const storeConversationId = useCurrentConversationId()
  const {
    initializeConversation,
    addMessage,
    switchConversation: switchConversationInMessageStore,
    deleteConversation,
  } = useMessageActions()
  const { toggleSidebar } = useSidebarActions()
  const isSidebarOpen = useSidebarOpen()
  const [shouldForceScroll, setShouldForceScroll] = useState(false)
  const [userHasManuallyScrolled, setUserHasManuallyScrolled] = useState(false)
  const [subdomainInitialized, setSubdomainInitialized] = useState(false)
  const [_showCompletionDots, setShowCompletionDots] = useState(false)
  const modals = useModals()

  // Feature flags
  const tabsEnabled = useFeatureFlag("TABS")
  const { user } = useAuth()
  const isAdmin = user?.isAdmin ?? false

  // Tabs are admin-only feature: requires both admin status AND feature flag
  const showTabs = isAdmin && tabsEnabled
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)
  const chatInputRef = useRef<ChatInputHandle | null>(null)
  const photoButtonRef = useRef<HTMLButtonElement>(null)
  const { setSSETerminal, setSSETerminalMinimized, setSandbox, setSandboxMinimized } = useDebugActions()
  const showSSETerminal = useSSETerminal()
  const showSandboxRaw = useSandbox()
  const { addEvent: addDevEvent } = useDevTerminal()
  const { workspace, isTerminal, mounted, setWorkspace } = useWorkspace({
    allowEmpty: true,
  })

  // Tab-isolated messages and busy state
  // When tabs are expanded, shows the active tab's conversation; otherwise shows global active conversation
  const { messages, busy } = useTabIsolatedMessages({ workspace, showTabs })

  // Handle ?wk= URL parameter to pre-select workspace (e.g., from widget "Edit me" button)
  const [wkParam] = useQueryState("wk")
  useEffect(() => {
    if (mounted && wkParam && wkParam !== workspace) {
      console.log("[ChatPage] Setting workspace from URL param:", wkParam)
      setWorkspace(wkParam)
    }
  }, [mounted, wkParam, workspace, setWorkspace])

  // Superadmin workspace (claude-bridge) has no preview/sandbox
  const isSuperadminWorkspace = workspace === SUPERADMIN.WORKSPACE_NAME
  const showSandbox = showSandboxRaw && !isSuperadminWorkspace

  const _userApiKey = useApiKey()
  const _userModel = useModel()
  const streamingActions = useStreamingActions()
  const { registerElementSelectHandler } = useSandboxContext()

  // Custom hooks
  const statusText = useStatusText(busy, messages)
  const { isDragging, handleChatDragEnter, handleChatDragLeave, handleChatDragOver, handleChatDrop } = useChatDragDrop({
    chatInputRef,
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

  // Redeem referral code if stored (from invite link flow)
  useRedeemReferral()

  // Update page title with workspace name
  useEffect(() => {
    if (workspace) {
      const projectName = workspace.split(".")[0]
      const capitalized = projectName.charAt(0).toUpperCase() + projectName.slice(1)
      document.title = `${capitalized} - Alive`
    } else {
      document.title = "Alive"
    }
  }, [workspace])

  // Fetch organizations and auto-select if none selected
  const { organizations, loading: organizationsLoading } = useOrganizations()

  // Check for session expiry
  const isSessionExpired = useIsSessionExpired()

  // Session management with workspace-scoped persistence
  const { conversationId, startNewConversation, switchConversation } = useConversationSession(workspace, mounted)

  // Chat messaging hook - handles sendMessage, streaming, agent supervisor
  const {
    sendMessage,
    isEvaluatingProgress,
    agentManagerAbortRef,
    agentManagerTimeoutRef,
    abortControllerRef,
    currentRequestIdRef,
    isSubmittingRef,
  } = useChatMessaging({
    workspace,
    conversationId,
    isTerminal,
    busy,
    msg,
    setMsg,
    addMessage,
    chatInputRef,
    setShouldForceScroll,
    setShowCompletionDots,
  })

  // Stream cancellation hook - must be after useChatMessaging to get the refs
  const { stopStreaming, isStopping } = useStreamCancellation({
    conversationId: storeConversationId ?? "",
    workspace,
    addMessage,
    setShowCompletionDots,
    abortControllerRef,
    currentRequestIdRef,
    isSubmittingRef,
    onDevEvent: isDevelopment()
      ? event => {
          addDevEvent({
            eventName: ClientRequest.INTERRUPT,
            event: {
              type: ClientRequest.INTERRUPT,
              requestId: storeConversationId ?? "unknown",
              timestamp: new Date().toISOString(),
              data: event.data,
            },
            rawSSE: JSON.stringify(event),
          })
        }
      : undefined,
  })

  // Stream reconnection - recovers buffered messages when tab becomes visible
  useStreamReconnect({
    conversationId,
    workspace,
    isStreaming: busy,
    addMessage,
    mounted,
  })

  // Tab management - combined switch handler for both conversation hooks
  const handleSwitchConversationForTabs = useCallback(
    (id: string) => {
      switchConversation(id)
      switchConversationInMessageStore(id)
    },
    [switchConversation, switchConversationInMessageStore],
  )

  const {
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
  } = useTabsManagement({
    workspace,
    conversationId,
    onSwitchConversation: handleSwitchConversationForTabs,
    onInitializeConversation: initializeConversation,
    onStartNewConversation: startNewConversation,
    currentInput: msg,
    onInputRestore: setMsg,
  })

  // Initialize message store when conversation OR workspace changes
  useEffect(() => {
    if (conversationId && workspace) {
      if (storeConversationId !== conversationId) {
        initializeConversation(conversationId, workspace)
      }
    }
  }, [conversationId, workspace, storeConversationId, initializeConversation])

  // Image upload handler
  const handleAttachmentUpload = useImageUpload({ workspace: workspace ?? undefined, isTerminal })

  // Show SSE terminal minimized on staging
  useEffect(() => {
    console.log(`%c[Chat] BUILD VERSION: ${BUILD_VERSION}`, "color: #00ff00; font-weight: bold; font-size: 14px")
    if (isDevelopment()) {
      setSSETerminal(true)
      setSSETerminalMinimized(true)
    }
    // Only auto-open sandbox on large screens (desktops), not tablets
    if (window.innerWidth >= 1280) {
      setSandbox(true)
      setSandboxMinimized(false)
    }
  }, [setSSETerminal, setSSETerminalMinimized, setSandbox, setSandboxMinimized])

  // Calculate total domain count from organizations
  const totalDomainCount = organizations.reduce((sum, org) => sum + (org.workspace_count || 0), 0)

  // Track manual scrolling
  useEffect(() => {
    const messagesContainer = messagesEndRef.current?.parentElement
    if (!messagesContainer) return

    const handleScroll = () => {
      if (!isAutoScrolling.current) {
        setUserHasManuallyScrolled(true)
      }
    }

    messagesContainer.addEventListener("scroll", handleScroll)
    return () => messagesContainer.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const messagesContainer = messagesEndRef.current?.parentElement
    if (!messagesContainer) return

    let timeoutId: NodeJS.Timeout | null = null

    const performScroll = () => {
      isAutoScrolling.current = true
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
      timeoutId = setTimeout(() => {
        isAutoScrolling.current = false
      }, 300)
    }

    if (shouldForceScroll) {
      performScroll()
      setShouldForceScroll(false)
      setUserHasManuallyScrolled(false)
    } else if (!userHasManuallyScrolled) {
      performScroll()
    } else {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      if (isNearBottom) {
        performScroll()
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [messages, shouldForceScroll, userHasManuallyScrolled])

  // Handle OAuth callback success/error params
  const urlSearchParams = typeof window !== "undefined" ? window.location.search : ""
  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams)
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

  const handleNewConversation = useCallback(() => {
    if (storeConversationId) {
      streamingActions.clearConversation(storeConversationId)
    }
    // Collapse and clear tabs - a new conversation is a fresh start
    handleCollapseTabsAndClear()
    // Create a new conversation
    const newId = startNewConversation()
    // Initialize the new conversation in message store immediately
    // (don't rely on useEffect timing)
    if (newId && workspace) {
      initializeConversation(newId, workspace)
    }
    // Clear input for new conversation
    setMsg("")
    setTimeout(() => chatInputRef.current?.focus(), 0)
  }, [
    storeConversationId,
    streamingActions,
    handleCollapseTabsAndClear,
    startNewConversation,
    workspace,
    initializeConversation,
  ])

  const handleInsertTemplate = useCallback((prompt: string) => {
    setMsg(prompt)
  }, [])

  const handleConversationSelect = useCallback(
    (selectedConversationId: string) => {
      if (!selectedConversationId) return
      // If tabs are active, open in tab (finds existing or creates new)
      // handleOpenConversationInTab is a no-op when tabs are not expanded
      handleOpenConversationInTab(selectedConversationId)
      switchConversation(selectedConversationId)
      switchConversationInMessageStore(selectedConversationId)
    },
    [switchConversation, switchConversationInMessageStore, handleOpenConversationInTab],
  )

  const handleDeleteConversation = useCallback(
    (conversationIdToDelete: string) => {
      if (!conversationIdToDelete) return
      deleteConversation(conversationIdToDelete)
      if (conversationIdToDelete === conversationId) {
        const newId = startNewConversation()
        // Initialize the new conversation in message store
        if (newId && workspace) {
          initializeConversation(newId, workspace)
        }
        setMsg("")
      }
    },
    [deleteConversation, conversationId, startNewConversation, workspace, initializeConversation],
  )

  return (
    <div
      className="h-[100dvh] flex flex-row overflow-hidden dark:bg-[#1a1a1a] dark:text-white"
      data-testid={mounted && workspace ? "workspace-ready" : "workspace-loading"}
    >
      <ConversationSidebar
        workspace={workspace}
        onConversationSelect={handleConversationSelect}
        onDeleteConversation={handleDeleteConversation}
        onOpenSettings={modals.openSettings}
        onOpenInvite={modals.openInvite}
      />

      {!isSidebarOpen && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="fixed top-3 left-3 z-50 p-2 border border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors hidden md:flex"
          aria-label="Open conversations"
        >
          <PanelLeft size={18} className="text-black/70 dark:text-white/70" />
        </button>
      )}

      <div
        className="flex-1 flex flex-col overflow-hidden relative min-w-0"
        role="application"
        aria-label="Chat area"
        onDragEnter={handleChatDragEnter}
        onDragLeave={handleChatDragLeave}
        onDragOver={handleChatDragOver}
        onDrop={handleChatDrop}
      >
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
          <ChatHeader
            isSuperadminWorkspace={isSuperadminWorkspace}
            onFeedbackClick={modals.openFeedback}
            onTemplatesClick={modals.openTemplates}
            onSettingsClick={modals.openSettings}
            showPhotoMenu={modals.photoMenu}
            onPhotoMenuToggle={modals.togglePhotoMenu}
            onPhotoMenuClose={modals.closePhotoMenu}
            photoButtonRef={photoButtonRef}
            chatInputRef={chatInputRef}
          />

          <WorkspaceInfoBar
            workspace={workspace}
            mounted={mounted}
            isTerminal={isTerminal}
            isSuperadminWorkspace={isSuperadminWorkspace}
            onSelectSite={() => modals.openSettings("websites")}
            onNewConversation={handleNewConversation}
            onMobilePreview={modals.openMobilePreview}
            onToggleTabs={handleToggleTabs}
            showTabsToggle={showTabs && !!workspace}
            tabsExpanded={tabsExpanded}
          />

          {/* Tabs - shown when expanded (desktop only, admin-only feature) */}
          {showTabs && tabsExpanded && (
            <TabBar
              tabs={tabs}
              activeTabId={activeTab?.id ?? null}
              onTabSelect={handleTabSelect}
              onTabClose={handleTabClose}
              onTabRename={handleTabRename}
              onAddTab={handleAddTab}
            />
          )}

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="p-4 space-y-1 mx-auto w-full md:max-w-2xl min-w-0">
              {messages.length === 0 && !busy && (
                <ChatEmptyState
                  workspace={workspace}
                  totalDomainCount={totalDomainCount}
                  isLoading={organizationsLoading}
                  onTemplatesClick={modals.openTemplates}
                />
              )}

              {groupMessages(messages).map((group, index) => {
                if (group.type === "text") {
                  return (
                    <div key={`group-${index}`}>
                      {group.messages.map(message => (
                        <div key={message.id}>{renderMessage(message)}</div>
                      ))}
                    </div>
                  )
                }
                return <ThinkingGroup key={`group-${index}`} messages={group.messages} isComplete={group.isComplete} />
              })}

              {/* Show pending tools (currently executing) - replaces generic "thinking" when tools are running */}
              <PendingToolsIndicator conversationId={storeConversationId} />

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

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="mx-auto w-full md:max-w-2xl">
            <ChatInput
              ref={chatInputRef}
              message={msg}
              setMessage={setMsg}
              busy={busy || (!workspace && mounted && !organizationsLoading)}
              isStopping={isStopping}
              onSubmit={sendMessage}
              onStop={stopStreaming}
              onOpenTemplates={modals.openTemplates}
              config={{
                enableAttachments: true,
                enableCamera: true,
                maxAttachments: 5,
                maxFileSize: 20 * 1024 * 1024,
                placeholder:
                  !workspace && mounted && !organizationsLoading
                    ? "Select a site to start chatting..."
                    : "Tell me what to change...",
                onAttachmentUpload: handleAttachmentUpload,
              }}
            />
          </div>
        </div>
      </div>

      {/* Side panel sandbox - desktop only */}
      <AnimatePresence>
        {showSandbox && (
          <motion.div
            key="desktop-sandbox"
            initial={{ width: 0 }}
            animate={{ width: "auto" }}
            exit={{ width: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="hidden md:flex h-full overflow-hidden"
          >
            <Sandbox />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile preview overlay */}
      <AnimatePresence>
        {modals.mobilePreview && (
          <SandboxMobile onClose={modals.closeMobilePreview} busy={busy} statusText={statusText} onStop={stopStreaming}>
            <ChatInput
              ref={chatInputRef}
              message={msg}
              setMessage={setMsg}
              busy={busy || (!workspace && mounted && !organizationsLoading)}
              isStopping={isStopping}
              onSubmit={sendMessage}
              onStop={stopStreaming}
              hideToolbar
              config={{
                enableAttachments: true,
                enableCamera: false,
                maxAttachments: 5,
                maxFileSize: 20 * 1024 * 1024,
                placeholder: "Tell me what to change...",
                onAttachmentUpload: handleAttachmentUpload,
              }}
            />
          </SandboxMobile>
        )}
      </AnimatePresence>

      {showSSETerminal && <DevTerminal />}
      {modals.feedback && (
        <FeedbackModal
          onClose={modals.closeFeedback}
          workspace={workspace ?? undefined}
          conversationId={conversationId}
        />
      )}
      <AnimatePresence>
        {modals.settings && (
          <SettingsModal
            onClose={modals.closeSettings}
            initialTab={
              modals.settings === "error" ? "organization" : modals.settings === "websites" ? "websites" : undefined
            }
          />
        )}
      </AnimatePresence>
      {modals.templates && (
        <SuperTemplatesModal onClose={modals.closeTemplates} onInsertTemplate={handleInsertTemplate} />
      )}
      {modals.invite && <InviteModal onClose={modals.closeInvite} />}
      {isSessionExpired && <SessionExpiredModal />}
    </div>
  )
}

function ChatPageWrapper() {
  return (
    <DevTerminalProvider>
      <SandboxProvider>
        <ChatPageContent />
      </SandboxProvider>
    </DevTerminalProvider>
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
