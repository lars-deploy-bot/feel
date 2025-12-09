"use client"
import {
  ExternalLink,
  FlaskConical,
  Image,
  Layers,
  MessageCircle,
  PanelLeft,
  PanelRight,
  Radio,
  Settings,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FeedbackModal } from "@/components/modals/FeedbackModal"
import { InviteModal } from "@/components/modals/InviteModal"
import { SessionExpiredModal } from "@/components/modals/SessionExpiredModal"
import { SettingsModal } from "@/components/modals/SettingsModal"
import { SuperTemplatesModal } from "@/components/modals/SuperTemplatesModal"
import { PhotoMenu } from "@/components/ui/PhotoMenu"
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher"
import { ChatDropOverlay } from "@/features/chat/components/ChatDropOverlay"
import { ChatInput } from "@/features/chat/components/ChatInput"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import { ConversationSidebar } from "@/features/chat/components/ConversationSidebar"
import { DevTerminal } from "@/features/chat/components/DevTerminal"
import { Sandbox } from "@/features/chat/components/Sandbox"
import { SandboxMobile } from "@/features/chat/components/SandboxMobile"
import { SubdomainInitializer } from "@/features/chat/components/SubdomainInitializer"
import { ThinkingGroup } from "@/features/chat/components/ThinkingGroup"
import { ThinkingSpinner } from "@/features/chat/components/ThinkingSpinner"
import { ThreeDotsComplete } from "@/features/chat/components/ThreeDotsComplete"
import { useConversationSession } from "@/features/chat/hooks/useConversationSession"
import { useImageUpload } from "@/features/chat/hooks/useImageUpload"
import { useStreamCancellation } from "@/features/chat/hooks/useStreamCancellation"
import { useRedeemReferral } from "@/hooks/useRedeemReferral"
import {
  ClientError,
  ClientRequest,
  DevTerminalProvider,
  useDevTerminal,
} from "@/features/chat/lib/dev-terminal-context"
import { groupMessages } from "@/features/chat/lib/message-grouper"
import { parseStreamEvent, type AgentManagerContent, type UIMessage } from "@/features/chat/lib/message-parser"
import { renderMessage } from "@/features/chat/lib/message-renderer"
import { SandboxProvider, useSandboxContext } from "@/features/chat/lib/sandbox-context"
import { sendClientError } from "@/features/chat/lib/send-client-error"
import { isValidStreamEvent } from "@/features/chat/lib/stream-guards"
import { formatMessagesAsText } from "@/features/chat/utils/format-messages"
import { isWarningMessage, type BridgeWarningContent } from "@/features/chat/lib/streaming/ndjson"
import { isCompleteEvent, isDoneEvent, isErrorEvent } from "@/features/chat/types/stream"
import { buildPromptWithAttachments } from "@/features/chat/utils/prompt-builder"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import type { StructuredError } from "@/lib/error-codes"
import { ErrorCodes, getErrorHelp, getErrorMessage } from "@/lib/error-codes"
import { HttpError } from "@/lib/errors"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { authStore, useIsSessionExpired } from "@/lib/stores/authStore"
import { validateOAuthToastParams } from "@/lib/integrations/toast-validation"
import { isRetryableError, retryWithBackoff } from "@/lib/retry"
import { useSidebarActions, useSidebarOpen } from "@/lib/stores/conversationSidebarStore"
import {
  isDevelopment,
  useDebugActions,
  useDebugView,
  useDebugVisible,
  useSandbox,
  useSSETerminal,
} from "@/lib/stores/debug-store"
import { useApiKey, useModel } from "@/lib/stores/llmStore"
import { useCurrentConversationId, useMessageActions, useMessages, useMessageStore } from "@/lib/stores/messageStore"
import { useStreamingActions } from "@/lib/stores/streamingStore"
import { useGoal, useBuilding, useTargetUsers } from "@/lib/stores/goalStore"
import { getMcpToolFriendlyName } from "@webalive/shared"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"

// Build version for deployment verification
const BUILD_VERSION = "2025-11-12-direct-execution"

function ChatPageContent() {
  const [msg, setMsg] = useState("")
  const messages = useMessages()
  const storeConversationId = useCurrentConversationId()
  const {
    initializeConversation,
    addMessage,
    clearForNewConversation,
    switchConversation: switchConversationInMessageStore,
    deleteConversation,
  } = useMessageActions()
  const { toggleSidebar } = useSidebarActions()
  const isSidebarOpen = useSidebarOpen()
  const [busy, setBusy] = useState(false)
  const [useStreaming, _setUseStreaming] = useState(true)
  const [shouldForceScroll, setShouldForceScroll] = useState(false)
  const [userHasManuallyScrolled, setUserHasManuallyScrolled] = useState(false)
  const [subdomainInitialized, setSubdomainInitialized] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  // Settings modal: null (closed), 'manual' (user-opened), 'error' (auto-opened for error), 'websites' (from workspace switcher)
  const [settingsModalReason, setSettingsModalReason] = useState<"manual" | "error" | "websites" | null>(null)

  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showCompletionDots, setShowCompletionDots] = useState(false)
  const [isEvaluatingProgress, setIsEvaluatingProgress] = useState(false)
  const prGoal = useGoal()
  const building = useBuilding()
  const targetUsers = useTargetUsers()

  // Feature flags
  const agentSupervisorEnabled = useFeatureFlag("AGENT_SUPERVISOR")
  const autoCopyOnCompleteEnabled = useFeatureFlag("AUTO_COPY_ON_COMPLETE")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const agentManagerAbortRef = useRef<AbortController | null>(null)
  const agentManagerTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Tracks the requestId for explicit stream cancellation.
   *
   * Populated from X-Request-Id header (preferred) or first SSE event (fallback).
   * Used by stopStreaming() to call /api/claude/stream/cancel endpoint.
   *
   * If null when Stop clicked, falls back to conversationId-based cancellation
   * (handles super-early Stop case where user clicks Stop < 100ms after request).
   */
  const currentRequestIdRef = useRef<string | null>(null)
  const _requestIdPromiseRef = useRef<Promise<string> | null>(null)
  const isSubmitting = useRef(false)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const dragCounter = useRef(0)
  const photoButtonRef = useRef<HTMLButtonElement>(null)
  const { toggleView, toggleSandbox, setSSETerminal, setSSETerminalMinimized, setSandbox, setSandboxMinimized } =
    useDebugActions()
  const debugModeEnabled = useDebugView() // Raw state for button visual
  const isDebugView = useDebugVisible() // Only true when NODE_ENV=development + debugView enabled
  const showSSETerminal = useSSETerminal()
  const showSandbox = useSandbox()
  const { addEvent: addDevEvent } = useDevTerminal()
  const { workspace, isTerminal, mounted, setWorkspace } = useWorkspace({
    allowEmpty: true,
  })
  const userApiKey = useApiKey()
  const userModel = useModel()
  const streamingActions = useStreamingActions()
  const { registerElementSelectHandler } = useSandboxContext()

  // Register element selection handler to insert selected element into chat input
  useEffect(() => {
    registerElementSelectHandler(element => {
      // Format: @ComponentName in path/to/file.tsx:lineNumber
      const shortPath = element.fileName.replace(/^.*\/src\//, "src/")
      const reference = `@${element.displayName} in ${shortPath}:${element.lineNumber}`

      // Append to existing message or set new
      setMsg(prev => {
        if (prev.trim()) {
          return `${prev} ${reference}`
        }
        return reference
      })

      // Focus the input
      setTimeout(() => chatInputRef.current?.focus(), 0)
    })
  }, [registerElementSelectHandler])

  // Derive status text from last assistant message when busy
  const statusText = useMemo(() => {
    if (!busy || messages.length === 0) return undefined

    // Find the last assistant message (not user/tool_result)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg?.type === "sdk_message" && msg.content) {
        const content = msg.content as {
          type?: string
          message?: { content?: unknown[] }
        }

        if (content.type !== "assistant") continue

        const blocks = content.message?.content
        if (!Array.isArray(blocks) || blocks.length === 0) continue

        const lastBlock = blocks[blocks.length - 1] as {
          type?: string
          name?: string
          input?: { file_path?: string; path?: string; pattern?: string; command?: string }
        }

        if (lastBlock?.type === "tool_use" && lastBlock.name) {
          const input = lastBlock.input
          const toolName = lastBlock.name

          // Format based on tool type
          if (toolName === "Read" && input?.file_path) {
            const fileName = input.file_path.split("/").pop()
            return `Reading ${fileName}`
          }
          if (toolName === "Edit" && input?.file_path) {
            const fileName = input.file_path.split("/").pop()
            return `Editing ${fileName}`
          }
          if (toolName === "Write" && input?.file_path) {
            const fileName = input.file_path.split("/").pop()
            return `Writing ${fileName}`
          }
          if (toolName === "Glob" && input?.pattern) {
            return `Searching ${input.pattern}`
          }
          if (toolName === "Grep" && input?.pattern) {
            return `Grep: ${input.pattern.slice(0, 20)}${input.pattern.length > 20 ? "..." : ""}`
          }
          if (toolName === "Bash" && input?.command) {
            const cmd = input.command.split(" ")[0]
            return `Running ${cmd}`
          }
          // Check for MCP tools - show friendly name
          const mcpFriendly = getMcpToolFriendlyName(toolName)
          if (mcpFriendly) {
            return `${mcpFriendly.provider}: ${mcpFriendly.action}`
          }
          return `${toolName}...`
        }
        if (lastBlock?.type === "thinking") {
          return "Thinking..."
        }
        // Found an assistant message but no actionable block, keep looking
      }
    }
    return "Working..."
  }, [busy, messages])

  // Redeem referral code if stored (from invite link flow)
  useRedeemReferral()

  // Update page title with workspace name
  useEffect(() => {
    if (workspace) {
      // Extract project name (first part before dot) and capitalize
      const projectName = workspace.split(".")[0]
      const capitalized = projectName.charAt(0).toUpperCase() + projectName.slice(1)
      document.title = `${capitalized} - Alive`
    } else {
      document.title = "Alive"
    }
  }, [workspace])

  // Stream cancellation hook - handles Stop button with type-safe API calls
  const { stopStreaming, isStopping } = useStreamCancellation({
    conversationId: storeConversationId ?? "",
    workspace,
    addMessage,
    setBusy,
    setShowCompletionDots,
    abortControllerRef,
    currentRequestIdRef,
    isSubmittingRef: isSubmitting,
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

  // Fetch organizations and auto-select if none selected
  const { organizations } = useOrganizations()

  // Check for session expiry (handled via auth store, not local error state)
  const isSessionExpired = useIsSessionExpired()

  // Session management with workspace-scoped persistence
  const { conversationId, startNewConversation, switchConversation } = useConversationSession(workspace, mounted)

  // Initialize message store when conversation OR workspace changes
  useEffect(() => {
    if (conversationId && workspace) {
      // Always initialize/switch when workspace or conversationId changes
      // This ensures conversations are properly scoped to the workspace
      if (storeConversationId !== conversationId) {
        initializeConversation(conversationId, workspace)
      }
    }
  }, [conversationId, workspace, storeConversationId, initializeConversation])

  // Image upload handler with progress tracking, retry logic, and store sync
  const handleAttachmentUpload = useImageUpload({ workspace: workspace ?? undefined, isTerminal })

  // Helper to create API request body (DRY)
  const createRequestBody = (
    message: string,
  ): {
    message: string
    conversationId: string
    apiKey?: string
    model?: string
    workspace?: string
  } => {
    const baseBody = {
      message,
      conversationId,
      apiKey: userApiKey || undefined,
      model: userModel,
    }

    return isTerminal ? { ...baseBody, workspace: workspace || undefined } : baseBody
  }

  // Show SSE terminal minimized on staging (after mount to avoid hydration mismatch)
  useEffect(() => {
    // Log build version for deployment verification
    console.log(`%c[Chat] BUILD VERSION: ${BUILD_VERSION}`, "color: #00ff00; font-weight: bold; font-size: 14px")

    // Auto-enable SSE terminal on dev/staging environments only
    if (isDevelopment()) {
      setSSETerminal(true)
      setSSETerminalMinimized(true)
    }

    // Sandbox open by default on desktop (all environments)
    if (window.innerWidth >= 768) {
      setSandbox(true)
      setSandboxMinimized(false)
    }
  }, [setSSETerminal, setSSETerminalMinimized, setSandbox, setSandboxMinimized])

  // Calculate total domain count from organizations
  const totalDomainCount = organizations.reduce((sum, org) => sum + (org.workspace_count || 0), 0)

  // Track manual scrolling - attach once at mount time (only needs empty deps)
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

    // Force scroll if we just sent a message
    if (shouldForceScroll) {
      performScroll()
      setShouldForceScroll(false)
      setUserHasManuallyScrolled(false)
    }
    // Auto-scroll if user hasn't manually scrolled
    else if (!userHasManuallyScrolled) {
      performScroll()
    }
    // Only scroll if near bottom when user has manually scrolled
    else {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

      if (isNearBottom) {
        performScroll()
      }
    }

    // Cleanup: cancel any pending timeout
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [messages, shouldForceScroll, userHasManuallyScrolled])

  // Handle OAuth callback success/error params
  // Track URL search params to catch OAuth redirects back to /chat
  const urlSearchParams = typeof window !== "undefined" ? window.location.search : ""
  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams)

    // Validate and sanitize OAuth callback parameters
    const validated = validateOAuthToastParams(params)

    if (validated) {
      if (validated.status === "success" && validated.successMessage) {
        toast.success(validated.successMessage)
      } else if (validated.status === "error" && validated.errorMessage) {
        toast.error(validated.errorMessage)
      }

      // Clean URL params while preserving hash
      const cleanUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, "", cleanUrl)
    }
  }, [urlSearchParams]) // Re-run when URL params change

  const handleSubdomainInitialize = (initialMessage: string, initialWorkspace: string) => {
    setMsg(initialMessage)
    if (initialWorkspace) {
      setWorkspace(initialWorkspace)
    }
  }

  const handleSubdomainInitialized = () => {
    setSubdomainInitialized(true)
  }

  // Build prompt with attachments for Claude (DRY helper)
  function buildPromptForClaude(userMessage: UIMessage): string {
    return buildPromptWithAttachments(userMessage.content as string, userMessage.attachments || [])
  }

  async function sendMessage(overrideMessage?: string) {
    const messageToSend = overrideMessage ?? msg
    // Block if: already submitting, busy, no message, OR cancel in progress
    // The isStopping check prevents sending while backend is cleaning up from Stop
    if (isSubmitting.current || busy || isStopping || !messageToSend.trim()) return

    // Lock submission immediately
    isSubmitting.current = true
    setBusy(true)

    // Get attachments for structured storage
    const attachments = chatInputRef.current?.getAttachments() || []

    // Add user message with original text + structured attachments
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      type: "user",
      content: messageToSend, // Original message (not augmented)
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined,
    }
    addMessage(userMessage)
    setMsg("") // Clear input regardless of how message was provided

    // Clear all attachments (they're stored in the message now)
    chatInputRef.current?.clearAllAttachments()

    setShouldForceScroll(true)

    try {
      if (useStreaming) {
        await sendStreaming(userMessage)
      } else {
        await sendRegular(userMessage)
      }
    } finally {
      // Reset busy state when request completes (success or error)
      // BUT skip if Stop was clicked - finishCancellation() will handle it after delay
      // Check abortControllerRef: null means Stop was clicked (it's nulled immediately in stopStreaming)
      // AND the finally block in sendStreaming hasn't run yet (which also nulls it)
      // For Stop: abortControllerRef is null BEFORE sendStreaming runs
      // For errors: abortControllerRef is set, then nulled by sendStreaming finally
      // So we check: if ref was already null at start of sendStreaming, it's a Stop
      // But we can't easily track that... so just always reset here and let finishCancellation
      // handle the Stop case (double-call is safe)
      setBusy(false)
      isSubmitting.current = false
    }
  }

  async function sendStreaming(userMessage: UIMessage) {
    let receivedAnyMessage = false
    let timeoutId: NodeJS.Timeout | null = null
    let shouldStopReading = false

    try {
      // Build augmented message for Claude (with attachment markup)
      const requestBody = createRequestBody(buildPromptForClaude(userMessage))

      // Create AbortController for this request
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Initialize streaming state for this conversation
      if (conversationId) {
        streamingActions.startStream(conversationId)
      }

      // Set a timeout to detect hanging requests (60 seconds)
      timeoutId = setTimeout(() => {
        if (!receivedAnyMessage && conversationId) {
          console.error("[Chat] Request timeout - no response received in 60s")

          streamingActions.recordError(conversationId, {
            type: "timeout_error",
            message: "Request timeout - no response received in 60s",
          })

          sendClientError({
            conversationId,
            errorType: ClientError.TIMEOUT_ERROR,
            data: {
              message: "Request timeout - no response received in 60s",
              timeoutSeconds: 60,
            },
            addDevEvent,
          })

          abortController.abort()
        }
      }, 60000)

      // Log outgoing request to dev terminal (dev mode only)
      if (isDevelopment()) {
        const requestEvent = {
          type: ClientRequest.MESSAGE,
          requestId: conversationId,
          timestamp: new Date().toISOString(),
          data: {
            endpoint: "/api/claude/stream",
            method: "POST",
            body: requestBody,
          },
        }
        addDevEvent({
          eventName: ClientRequest.MESSAGE,
          event: requestEvent,
          rawSSE: `${JSON.stringify(requestEvent)}\n`,
        })
      }

      // Retry the fetch with exponential backoff for transient failures
      const response = await retryWithBackoff(
        async () => {
          const res = await fetch("/api/claude/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(requestBody),
            signal: abortController.signal,
          })

          if (!res.ok) {
            // Parse error response if available
            const errorData: StructuredError | null = await res.json().catch(() => null)

            // Build user-friendly error message
            let userMessage: string
            if (errorData?.error) {
              userMessage = getErrorMessage(errorData.error, errorData.details) || errorData.message
              const helpText = getErrorHelp(errorData.error, errorData.details)
              if (helpText) {
                userMessage += `\n\n${helpText}`
              }

              // Show toast for conversation busy error (409)
              if (errorData.error === ErrorCodes.CONVERSATION_BUSY) {
                toast.error(userMessage, {
                  duration: 4000,
                  position: "top-center",
                })
              }
            } else {
              userMessage = `HTTP ${res.status}: ${res.statusText}`
            }

            // Throw HttpError - will be retried if 5xx, logged in outer catch after retries exhausted
            throw new HttpError(userMessage, res.status, res.statusText, errorData?.error)
          }

          return res
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          shouldRetry: error => {
            // Only retry server errors (5xx) and network failures, not client errors (4xx)
            return isRetryableError(error)
          },
        },
      )

      // Response is guaranteed to be ok here (errors thrown in retry callback)
      if (!response.body) {
        throw new Error("No response body received from server")
      }

      // Read requestId from header immediately (before any SSE events)
      // This ensures we can cancel even if user clicks Stop before first event
      const headerRequestId = response.headers.get("X-Request-Id")
      console.log("[Chat] Response headers:", Array.from(response.headers.entries()))
      console.log("[Chat] X-Request-Id header value:", headerRequestId)
      if (headerRequestId) {
        currentRequestIdRef.current = headerRequestId
        console.log("[Chat] Stored requestId from header:", headerRequestId)
      } else {
        console.warn("[Chat] No X-Request-Id header found in response!")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      // Use streaming store for per-conversation error tracking
      const MAX_CONSECUTIVE_PARSE_ERRORS = 10

      // Buffer for incomplete NDJSON lines
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done || shouldStopReading) break

          // Append new chunk to buffer
          buffer += decoder.decode(value, { stream: true })

          // Split by newline (NDJSON line boundary)
          const lines = buffer.split("\n")

          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue

            // Parse NDJSON line (one JSON message per line)
            try {
              const parsed: unknown = JSON.parse(line)

              // Validate with type guard (runtime safety)
              if (!isValidStreamEvent(parsed)) {
                console.error("[Chat] Invalid stream event structure:", parsed)

                if (conversationId) {
                  streamingActions.incrementConsecutiveErrors(conversationId)
                  streamingActions.recordError(conversationId, {
                    type: "invalid_event_structure",
                    message: "Stream event failed type guard validation",
                  })
                }

                const consecutiveErrors = conversationId ? streamingActions.getConsecutiveErrors(conversationId) : 0

                sendClientError({
                  conversationId,
                  errorType: ClientError.INVALID_EVENT_STRUCTURE,
                  data: {
                    message: parsed,
                    consecutiveErrors,
                  },
                  addDevEvent,
                })

                if (consecutiveErrors >= MAX_CONSECUTIVE_PARSE_ERRORS) {
                  console.error("[Chat] Too many consecutive type guard failures, stopping stream", consecutiveErrors)
                  shouldStopReading = true
                  reader.cancel()
                  break
                }

                continue
              }

              // Now typed as StreamEvent after validation
              const eventData = parsed

              // Store requestId from first event for cancellation
              if (!currentRequestIdRef.current && eventData.requestId) {
                currentRequestIdRef.current = eventData.requestId
                console.log("[Chat] Tracking requestId for cancellation:", eventData.requestId)
              }

              // Handle warning messages silently (don't add to message history)
              if (isWarningMessage(eventData)) {
                const warning = eventData.data.content as BridgeWarningContent
                console.log("[Chat] OAuth warning received:", warning.provider, warning.message)
                continue // Don't add warning to messages
              }

              // Valid message - capture to dev terminal and process
              // Note: Structure already validated by isValidStreamEvent() type guard
              if (isDevelopment()) {
                addDevEvent({
                  eventName: eventData.type,
                  event: eventData,
                  rawSSE: line,
                })
              }

              // Process the message for UI (now with conversation-scoped tool tracking)
              receivedAnyMessage = true
              if (conversationId) {
                streamingActions.recordMessageReceived(conversationId)
                streamingActions.resetConsecutiveErrors(conversationId)
              }

              const message = parseStreamEvent(eventData, conversationId, streamingActions)
              if (message) {
                addMessage(message)
                // Break on stream completion
                if (isCompleteEvent(eventData) || isDoneEvent(eventData) || isErrorEvent(eventData)) {
                  receivedAnyMessage = true
                  // Reset submission state immediately so user can send new messages
                  // (don't wait for cleanup code to run)
                  setBusy(false)
                  isSubmitting.current = false
                  // Show completion dots only for successful completion (not errors)
                  if ((isCompleteEvent(eventData) || isDoneEvent(eventData)) && !isErrorEvent(eventData)) {
                    setShowCompletionDots(true)

                    // Get formatted messages for both features
                    const state = useMessageStore.getState()
                    const currentConvo = state.conversationId ? state.conversations[state.conversationId] : null
                    const formattedMessages = currentConvo?.messages ? formatMessagesAsText(currentConvo.messages) : ""

                    // Feature flag: Agent Supervisor - evaluate progress and suggest next action
                    if (agentSupervisorEnabled && prGoal && workspace && formattedMessages) {
                      setIsEvaluatingProgress(true)
                      // Create abort controller for this evaluation
                      const agentAbort = new AbortController()
                      agentManagerAbortRef.current = agentAbort
                      // Fire and forget - don't block the UI
                      fetch("/api/evaluate-progress", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        signal: agentAbort.signal,
                        body: JSON.stringify({
                          conversation: formattedMessages,
                          prGoal,
                          workspace,
                          building,
                          targetUsers,
                          model: userModel,
                        }),
                      })
                        .then(res => res.json())
                        .then(data => {
                          if (data.ok && data.nextAction) {
                            const action = data.nextAction.toUpperCase()

                            // Check if PR goal is complete (DONE can appear anywhere due to LLM preamble)
                            // Match "DONE" at start or after common preamble patterns
                            const isDone = /^DONE\b|:\s*DONE\b|is:\s*DONE\b/i.test(action)
                            if (isDone) {
                              // Extract the actual message after DONE
                              const doneMatch = data.nextAction.match(/DONE[\s\-:]*(.*)$/is)
                              const message = doneMatch?.[1]?.trim() || "PR goal complete!"
                              // Add agent manager message to chat
                              const doneMessage: UIMessage = {
                                id: `agent-manager-done-${Date.now()}`,
                                type: "agent_manager",
                                content: {
                                  status: "done",
                                  message,
                                } satisfies AgentManagerContent,
                                timestamp: new Date(),
                              }
                              addMessage(doneMessage)
                              return
                            }

                            // Check if supervisor wants to stop (STOP can appear anywhere due to LLM preamble)
                            const isStop = /^STOP\b|:\s*STOP\b|is:\s*STOP\b/i.test(action)
                            if (isStop) {
                              // Extract the actual message after STOP
                              const stopMatch = data.nextAction.match(/STOP[\s\-:]*(.*)$/is)
                              const message = stopMatch?.[1]?.trim() || "Agent needs input"
                              // Add agent manager message to chat
                              const stopMessage: UIMessage = {
                                id: `agent-manager-stop-${Date.now()}`,
                                type: "agent_manager",
                                content: {
                                  status: "stop",
                                  message,
                                } satisfies AgentManagerContent,
                                timestamp: new Date(),
                              }
                              addMessage(stopMessage)
                              setMsg("") // Clear any pending message
                              return
                            }
                            // Show the message in input first for user visibility
                            const agentMessage = `agentmanager> ${data.nextAction}`
                            setMsg(agentMessage)
                            // Auto-send with the message directly (avoids closure issue)
                            // Store timeout ref so we can cancel it
                            agentManagerTimeoutRef.current = setTimeout(() => {
                              agentManagerTimeoutRef.current = null
                              sendMessage(agentMessage)
                            }, 4000)
                            if (!data.onTrack) {
                              toast("Supervisor: Course correction suggested", { icon: "🎯" })
                            }
                          }
                        })
                        .catch(err => {
                          // Don't log abort errors (user cancelled)
                          if (err instanceof Error && err.name !== "AbortError") {
                            console.error("[AgentSupervisor] Error:", err)
                          }
                        })
                        .finally(() => {
                          setIsEvaluatingProgress(false)
                          agentManagerAbortRef.current = null
                        })
                    }
                    // Feature flag: auto-fill input with formatted messages on completion
                    else if (autoCopyOnCompleteEnabled && formattedMessages) {
                      // Trim and collapse newlines to single spaces for cleaner input
                      const trimmed = formattedMessages.replace(/\n+/g, " ").trim()
                      setMsg(trimmed)
                    }
                  }
                  shouldStopReading = true
                  break
                }
              }
            } catch (parseError) {
              console.error("[Chat] Failed to parse NDJSON line:", {
                line: line.slice(0, 200),
                error: parseError,
              })

              if (conversationId) {
                streamingActions.incrementConsecutiveErrors(conversationId)
                streamingActions.recordError(conversationId, {
                  type: "parse_error",
                  message: "Failed to parse NDJSON line",
                  linePreview: line.slice(0, 200),
                })
              }

              const consecutiveErrors = conversationId ? streamingActions.getConsecutiveErrors(conversationId) : 0

              sendClientError({
                conversationId,
                errorType: ClientError.PARSE_ERROR,
                data: {
                  consecutiveErrors,
                  line: line.slice(0, 200),
                  error: parseError instanceof Error ? parseError.message : String(parseError),
                },
                addDevEvent,
              })

              if (consecutiveErrors >= MAX_CONSECUTIVE_PARSE_ERRORS) {
                console.error("[Chat] Too many consecutive parse errors, stopping stream", consecutiveErrors)

                sendClientError({
                  conversationId,
                  errorType: ClientError.CRITICAL_PARSE_ERROR,
                  data: {
                    consecutiveErrors,
                    message: "Too many consecutive parse errors, stopping stream",
                  },
                  addDevEvent,
                })

                addMessage({
                  id: Date.now().toString(),
                  type: "sdk_message",
                  content: {
                    type: "result",
                    is_error: true,
                    result:
                      "Connection unstable: Multiple parse errors detected. Please try again or refresh the page.",
                  },
                  timestamp: new Date(),
                })
                shouldStopReading = true
                reader.cancel()
                break
              }
            }
          }
        }
      } catch (readerError) {
        // If user cancelled, don't treat as error
        if (abortController.signal.aborted) {
          console.log("[Chat] Stream aborted by user")
          if (conversationId) {
            streamingActions.endStream(conversationId)
          }
          return
        }

        if (conversationId) {
          streamingActions.recordError(conversationId, {
            type: "reader_error",
            message: readerError instanceof Error ? readerError.message : "Unknown reader error",
          })
        }

        sendClientError({
          conversationId,
          errorType: ClientError.READER_ERROR,
          data: {
            receivedMessages: receivedAnyMessage,
            error: readerError instanceof Error ? readerError.message : String(readerError),
          },
          addDevEvent,
        })

        // Connection interrupted while reading stream
        if (!receivedAnyMessage) {
          throw new Error("Connection lost before receiving any response")
        }
        // If we got some messages, just log it and continue
        console.warn("[Chat] Stream interrupted after receiving some messages:", readerError)
      }

      // Check if we received any response at all (but not if user cancelled)
      if (!receivedAnyMessage && !abortController.signal.aborted) {
        throw new Error("Server closed connection without sending any response")
      }

      // End stream tracking
      if (conversationId) {
        streamingActions.endStream(conversationId)
      }
    } catch (error) {
      // Log error for debugging (even HttpError which has user-friendly message)
      if (error instanceof Error && error.name !== "AbortError") {
        // HttpError has status field for HTTP-specific logging
        if (error instanceof HttpError) {
          sendClientError({
            conversationId,
            errorType: ClientError.HTTP_ERROR,
            data: {
              status: error.status,
              statusText: error.statusText,
              message: error.message,
            },
            addDevEvent,
          })
        } else {
          // General unexpected errors
          sendClientError({
            conversationId,
            errorType: ClientError.GENERAL_ERROR,
            data: {
              errorName: error.name,
              message: error.message,
              stack: error.stack,
            },
            addDevEvent,
          })
        }
      }

      // Show error message to user (unless it's a conversation busy error which has a toast)
      if (error instanceof Error && error.name !== "AbortError") {
        // Handle 401/session errors - trigger session expiry modal
        const isAuthError =
          error instanceof HttpError &&
          (error.status === 401 ||
            error.errorCode === ErrorCodes.NO_SESSION ||
            error.errorCode === ErrorCodes.AUTH_REQUIRED)

        if (isAuthError) {
          authStore.handleSessionExpired("Your session has expired. Please log in again to continue.")
          return // Don't show error in chat - modal will handle it
        }

        // Skip adding to chat for conversation busy error since toast already shows it
        const isConversationBusy = error instanceof HttpError && error.errorCode === ErrorCodes.CONVERSATION_BUSY

        if (!isConversationBusy) {
          const errorMessage: UIMessage = {
            id: Date.now().toString(),
            type: "sdk_message",
            content: {
              type: "result",
              is_error: true,
              result: error.message,
            },
            timestamp: new Date(),
          }
          addMessage(errorMessage)
        }
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      abortControllerRef.current = null
      currentRequestIdRef.current = null
    }
  }

  async function sendRegular(userMessage: UIMessage) {
    try {
      // Build augmented message for Claude (with attachment markup)
      const requestBody = createRequestBody(buildPromptForClaude(userMessage))

      const r = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      })

      // Check for HTTP errors
      if (!r.ok) {
        let errorData: StructuredError | null = null
        try {
          errorData = await r.json()
        } catch {
          errorData = null
        }

        if (errorData?.error) {
          const userMessage = getErrorMessage(errorData.error, errorData.details) || errorData.message
          const helpText = getErrorHelp(errorData.error, errorData.details)

          let fullMessage = userMessage
          if (helpText) {
            fullMessage += `\n\n${helpText}`
          }

          // Show toast for conversation busy error (409)
          if (errorData.error === ErrorCodes.CONVERSATION_BUSY) {
            toast.error(fullMessage, {
              duration: 4000,
              position: "top-center",
            })
          }

          throw new Error(fullMessage)
        }

        throw new Error(`HTTP ${r.status}: ${r.statusText}`)
      }

      const response = await r.json()

      // Add assistant message
      const assistantMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        type: "sdk_message",
        content: response,
        timestamp: new Date(),
      }
      addMessage(assistantMessage)
    } catch (error) {
      // Skip adding to chat for conversation busy error since toast already shows it
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      const isConversationBusy = errorMessage.includes("I'm still working on your previous request")

      if (!isConversationBusy) {
        const errorUIMessage: UIMessage = {
          id: (Date.now() + 1).toString(),
          type: "sdk_message",
          content: {
            type: "result",
            is_error: true,
            result: errorMessage,
          },
          timestamp: new Date(),
        }
        addMessage(errorUIMessage)
      }
    }
  }

  const handleNewConversation = useCallback(() => {
    // Clear streaming state for the old conversation
    if (storeConversationId) {
      streamingActions.clearConversation(storeConversationId)
    }
    startNewConversation()
    clearForNewConversation()
    // Focus the input after starting new chat
    setTimeout(() => chatInputRef.current?.focus(), 0)
  }, [storeConversationId, streamingActions, startNewConversation, clearForNewConversation])

  // Note: stopStreaming is now provided by useStreamCancellation hook (line 114)
  // See docs/diagrams/messaging/cancellation.md for architecture details

  // Drag & drop handlers for entire chat area
  const handleChatDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleChatDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleChatDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  const handleChatDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)

    // Check if it's a photobook image
    const imageKey = e.dataTransfer.getData("application/x-photobook-image")
    if (imageKey) {
      chatInputRef.current?.addPhotobookImage(imageKey)
      return
    }

    // Otherwise, handle file drops
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    for (const file of files) {
      chatInputRef.current?.addAttachment(file)
    }
  }, [])

  const handleInsertTemplate = useCallback((prompt: string) => {
    // Insert the template prompt into the chat input
    setMsg(prompt)
  }, [])

  const handleConversationSelect = useCallback(
    (selectedConversationId: string) => {
      if (!selectedConversationId) return
      switchConversation(selectedConversationId)
      switchConversationInMessageStore(selectedConversationId)
    },
    [switchConversation, switchConversationInMessageStore],
  )

  const handleDeleteConversation = useCallback(
    (conversationIdToDelete: string) => {
      if (!conversationIdToDelete) return
      deleteConversation(conversationIdToDelete)

      if (conversationIdToDelete === conversationId) {
        startNewConversation()
      }
    },
    [deleteConversation, conversationId, startNewConversation],
  )

  const handleOpenSettings = useCallback(() => {
    setSettingsModalReason("manual")
  }, [])

  const handleCloseSettings = useCallback(() => {
    setSettingsModalReason(null)
  }, [])

  // SSE terminal visibility is separate from debug view

  // Empty workspace state is now handled inline with switchers in header
  // No need for separate empty state screen

  return (
    <div
      className="h-[100dvh] flex flex-row overflow-hidden dark:bg-[#1a1a1a] dark:text-white"
      data-testid={mounted && workspace ? "workspace-ready" : "workspace-loading"}
    >
      {/* Conversation Sidebar - Static, not overlay */}
      <ConversationSidebar
        workspace={workspace}
        onConversationSelect={handleConversationSelect}
        onDeleteConversation={handleDeleteConversation}
        onOpenSettings={handleOpenSettings}
        onOpenInvite={() => setShowInviteModal(true)}
      />

      {/* Fixed top-left button to open sidebar when closed */}
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

      {/* Main chat area - flex grows to fill remaining space */}
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
          {/* Header - h-14 matches sidebar header height */}
          <div className="h-14 flex-shrink-0 border-b border-black/10 dark:border-white/10">
            <div className="h-full flex items-center justify-between px-6 mx-auto w-full md:max-w-2xl">
              <div className="flex items-center gap-3">
                <a
                  href="https://alive.best"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center hover:opacity-80 transition-opacity"
                  aria-label="Alive"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-black dark:text-white"
                  >
                    <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.1" className="alive-logo-outer" />
                  </svg>
                </a>
                <span className="text-lg font-medium text-black dark:text-white">Chat</span>
              </div>
              <div className="flex items-center gap-2">
                {isDevelopment() && (
                  <button
                    type="button"
                    onClick={toggleView}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors ${
                      debugModeEnabled
                        ? "text-amber-600 border-amber-400 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-600 dark:bg-amber-950/50 dark:hover:bg-amber-950"
                        : "text-emerald-600 border-emerald-400 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-600 dark:hover:bg-emerald-950/30"
                    }`}
                    title={debugModeEnabled ? "Switch to live view" : "Switch to debug view"}
                  >
                    {debugModeEnabled ? <FlaskConical size={14} /> : <Radio size={14} />}
                    <span>{debugModeEnabled ? "Debug" : "Live"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleSandbox}
                  className={`hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors ${
                    showSandbox
                      ? "text-purple-600 border-purple-400 bg-purple-50 hover:bg-purple-100 dark:text-purple-400 dark:border-purple-600 dark:bg-purple-950/50 dark:hover:bg-purple-950"
                      : "text-black/60 dark:text-white/60 border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  title={showSandbox ? "Hide preview panel" : "Show preview panel"}
                >
                  <PanelRight size={14} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(true)}
                  className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                  aria-label="Send Feedback"
                  title="Send Feedback"
                >
                  <MessageCircle size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplatesModal(true)}
                  className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                  aria-label="Components"
                  title="Components"
                >
                  <Layers size={14} />
                </button>
                <div className="relative">
                  <button
                    ref={photoButtonRef}
                    type="button"
                    onClick={() => setShowPhotoMenu(!showPhotoMenu)}
                    className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                    aria-label="Photos"
                    title="Photos"
                  >
                    <Image size={14} />
                  </button>
                  <PhotoMenu
                    isOpen={showPhotoMenu}
                    onClose={() => setShowPhotoMenu(false)}
                    onSelectImage={imageKey => chatInputRef.current?.addPhotobookImage(imageKey)}
                    triggerRef={photoButtonRef}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="inline-flex items-center justify-center px-3 py-2 text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors active:scale-90 [&>svg]:transition-transform [&>svg]:duration-300 [&>svg]:ease-out hover:[&>svg]:rotate-90"
                  aria-label="Settings"
                  data-testid="settings-button"
                >
                  <Settings size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="px-4 md:px-6 py-3 mx-auto w-full md:max-w-2xl">
              {/* Workspace info bar - always visible */}
              <div className="flex items-center justify-between text-xs gap-2">
                {/* Left: site name (truncated on mobile) */}
                <div className="flex items-center min-w-0 flex-shrink" data-testid="workspace-section">
                  <span
                    className="text-black/50 dark:text-white/50 font-medium flex-shrink-0"
                    data-testid="workspace-label"
                  >
                    site
                  </span>
                  {isTerminal ? (
                    <WorkspaceSwitcher
                      currentWorkspace={workspace}
                      onOpenSettings={() => setSettingsModalReason("websites")}
                    />
                  ) : (
                    <span className="ml-2 md:ml-3 font-diatype-mono font-medium text-black/80 dark:text-white/80 truncate">
                      {workspace || "loading..."}
                    </span>
                  )}
                </div>
                {/* Right: action buttons */}
                {workspace && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={`https://${workspace}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors flex items-center gap-1"
                    >
                      <ExternalLink size={10} />
                      <span className="hidden sm:inline">open</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleNewConversation}
                      className="px-2 py-1 text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                    >
                      <span className="sm:hidden">new</span>
                      <span className="hidden sm:inline">new chat</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4 space-y-2 mx-auto w-full md:max-w-2xl">
              {/* Empty state - only show when no messages */}
              {messages.length === 0 && !busy && (
                <div className="flex items-start justify-center h-full pt-32">
                  <div className="max-w-md text-center space-y-6">
                    {workspace ? (
                      <>
                        <p className="text-lg text-black/90 dark:text-white/90 font-medium">What's next?</p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setShowTemplatesModal(true)}
                            className="px-4 py-2 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-sm font-medium text-black dark:text-white transition-colors"
                          >
                            Browse templates
                          </button>
                        </div>
                      </>
                    ) : totalDomainCount === 0 ? (
                      <>
                        <p className="text-lg text-black/90 dark:text-white/90 font-medium">
                          Welcome! You don't have any sites yet.
                        </p>
                        <div className="pt-2">
                          <a
                            href="/deploy"
                            className="inline-block px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                          >
                            Deploy your first site
                          </a>
                        </div>
                      </>
                    ) : (
                      <p className="text-lg text-black/60 dark:text-white/60 font-medium">
                        Select a site above to start chatting
                      </p>
                    )}
                  </div>
                </div>
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
              {/* Show thinking indicator only when busy but no assistant response has started yet */}
              {busy && messages.length > 0 && messages[messages.length - 1]?.type === "user" && (
                <div className="my-4">
                  <div className="text-xs font-normal text-black/35 dark:text-white/35 flex items-center gap-1">
                    <ThinkingSpinner />
                    <span>thinking</span>
                  </div>
                </div>
              )}
              {/* Show completion dots after successful completion (non-debug mode only) */}
              {showCompletionDots && !isDebugView && !busy && messages.length > 0 && <ThreeDotsComplete />}
              {/* Agent Manager loading indicator */}
              {isEvaluatingProgress && (
                <div className="my-4 flex items-center gap-3 text-xs text-purple-600 dark:text-purple-400">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
                    </div>
                    <span className="font-medium">Agent Manager evaluating...</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Abort the client-side fetch request
                      agentManagerAbortRef.current?.abort()
                      // Send cancel request to server to stop server-side processing
                      if (workspace) {
                        fetch(`/api/evaluate-progress?workspace=${encodeURIComponent(workspace)}`, {
                          method: "DELETE",
                          credentials: "include",
                        }).catch(() => {
                          // Ignore errors - best effort cancellation
                        })
                      }
                      // Clear any pending auto-send timeout
                      if (agentManagerTimeoutRef.current) {
                        clearTimeout(agentManagerTimeoutRef.current)
                        agentManagerTimeoutRef.current = null
                      }
                      // Clear the input if it has agentmanager content
                      if (msg.startsWith("agentmanager>")) {
                        setMsg("")
                      }
                      setIsEvaluatingProgress(false)
                    }}
                    className="px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded transition-colors"
                  >
                    Stop
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="mx-auto w-full md:max-w-2xl">
            <ChatInput
              ref={chatInputRef}
              message={msg}
              setMessage={setMsg}
              busy={busy || !workspace}
              isStopping={isStopping}
              abortControllerRef={abortControllerRef}
              onSubmit={sendMessage}
              onStop={stopStreaming}
              onOpenTemplates={() => setShowTemplatesModal(true)}
              onOpenPreview={() => setShowMobilePreview(true)}
              config={{
                enableAttachments: true,
                enableCamera: true,
                maxAttachments: 5,
                maxFileSize: 20 * 1024 * 1024, // 20MB
                placeholder: !workspace ? "Select a site to start chatting..." : "Tell me what to change...",
                onAttachmentUpload: handleAttachmentUpload,
              }}
            />
          </div>
        </div>
      </div>

      {/* Side panel sandbox - desktop only (mobile uses overlay) */}
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
        {showMobilePreview && (
          <SandboxMobile
            onClose={() => setShowMobilePreview(false)}
            busy={busy}
            statusText={statusText}
            onStop={stopStreaming}
          >
            <ChatInput
              ref={chatInputRef}
              message={msg}
              setMessage={setMsg}
              busy={busy || !workspace}
              isStopping={isStopping}
              abortControllerRef={abortControllerRef}
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
      {showFeedbackModal && (
        <FeedbackModal
          onClose={() => setShowFeedbackModal(false)}
          workspace={workspace ?? undefined}
          conversationId={conversationId}
        />
      )}
      <AnimatePresence>
        {settingsModalReason && (
          <SettingsModal
            onClose={handleCloseSettings}
            initialTab={
              settingsModalReason === "error"
                ? "organization"
                : settingsModalReason === "websites"
                  ? "websites"
                  : undefined
            }
          />
        )}
      </AnimatePresence>
      {showTemplatesModal && (
        <SuperTemplatesModal onClose={() => setShowTemplatesModal(false)} onInsertTemplate={handleInsertTemplate} />
      )}
      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} />}

      {/* Session expiry modal - non-dismissable, requires login */}
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
            iconTheme: {
              primary: "#dc2626",
              secondary: "#fff",
            },
          },
        }}
      />
      <ChatPageWrapper />
    </>
  )
}
