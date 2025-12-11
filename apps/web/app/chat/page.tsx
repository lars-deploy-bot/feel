"use client"
import { PanelLeft } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
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
import { ThinkingGroup } from "@/features/chat/components/ThinkingGroup"
import { ThinkingSpinner } from "@/features/chat/components/ThinkingSpinner"
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
import { isDevelopment, useDebugActions, useSandbox, useSSETerminal } from "@/lib/stores/debug-store"
import { useApiKey, useModel } from "@/lib/stores/llmStore"
import { useCurrentConversationId, useMessageActions, useMessages, useMessageStore } from "@/lib/stores/messageStore"
import { useStreamingActions } from "@/lib/stores/streamingStore"
import { useGoal, useBuilding, useTargetUsers } from "@/lib/stores/goalStore"
import { SUPERADMIN } from "@webalive/shared"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"

// Local components
import { ChatHeader, WorkspaceInfoBar, ChatEmptyState, AgentManagerIndicator } from "./components"
import { useStatusText, useChatDragDrop } from "./hooks"

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
  const [settingsModalReason, setSettingsModalReason] = useState<"manual" | "error" | "websites" | null>(null)
  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [_showCompletionDots, setShowCompletionDots] = useState(false)
  const [isEvaluatingProgress, setIsEvaluatingProgress] = useState(false)
  const prGoal = useGoal()
  const building = useBuilding()
  const targetUsers = useTargetUsers()

  // Feature flags
  const agentSupervisorEnabled = useFeatureFlag("AGENT_SUPERVISOR")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const agentManagerAbortRef = useRef<AbortController | null>(null)
  const agentManagerTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentRequestIdRef = useRef<string | null>(null)
  const _requestIdPromiseRef = useRef<Promise<string> | null>(null)
  const isSubmitting = useRef(false)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const photoButtonRef = useRef<HTMLButtonElement>(null)
  const { setSSETerminal, setSSETerminalMinimized, setSandbox, setSandboxMinimized } = useDebugActions()
  const showSSETerminal = useSSETerminal()
  const showSandboxRaw = useSandbox()
  const { addEvent: addDevEvent } = useDevTerminal()
  const { workspace, isTerminal, mounted, setWorkspace } = useWorkspace({
    allowEmpty: true,
  })

  // Superadmin workspace (claude-bridge) has no preview/sandbox
  const isSuperadminWorkspace = workspace === SUPERADMIN.WORKSPACE_NAME
  const showSandbox = showSandboxRaw && !isSuperadminWorkspace

  const userApiKey = useApiKey()
  const userModel = useModel()
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

  // Stream cancellation hook
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

  // Check for session expiry
  const isSessionExpired = useIsSessionExpired()

  // Session management with workspace-scoped persistence
  const { conversationId, startNewConversation, switchConversation } = useConversationSession(workspace, mounted)

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

  // Helper to create API request body
  const createRequestBody = (message: string) => {
    const baseBody = {
      message,
      conversationId,
      apiKey: userApiKey || undefined,
      model: userModel,
    }
    return isTerminal ? { ...baseBody, workspace: workspace || undefined } : baseBody
  }

  // Show SSE terminal minimized on staging
  useEffect(() => {
    console.log(`%c[Chat] BUILD VERSION: ${BUILD_VERSION}`, "color: #00ff00; font-weight: bold; font-size: 14px")
    if (isDevelopment()) {
      setSSETerminal(true)
      setSSETerminalMinimized(true)
    }
    if (window.innerWidth >= 768) {
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

  function buildPromptForClaude(userMessage: UIMessage): string {
    return buildPromptWithAttachments(userMessage.content as string, userMessage.attachments || [])
  }

  async function sendMessage(overrideMessage?: string) {
    const messageToSend = overrideMessage ?? msg
    if (isSubmitting.current || busy || isStopping || !messageToSend.trim()) return

    isSubmitting.current = true
    setBusy(true)

    const attachments = chatInputRef.current?.getAttachments() || []

    const userMessage: UIMessage = {
      id: Date.now().toString(),
      type: "user",
      content: messageToSend,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined,
    }
    addMessage(userMessage)
    setMsg("")
    chatInputRef.current?.clearAllAttachments()
    setShouldForceScroll(true)

    try {
      if (useStreaming) {
        await sendStreaming(userMessage)
      } else {
        await sendRegular(userMessage)
      }
    } finally {
      setBusy(false)
      isSubmitting.current = false
    }
  }

  async function sendStreaming(userMessage: UIMessage) {
    let receivedAnyMessage = false
    let timeoutId: NodeJS.Timeout | null = null
    let shouldStopReading = false

    try {
      const requestBody = createRequestBody(buildPromptForClaude(userMessage))

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      if (conversationId) {
        streamingActions.startStream(conversationId)
      }

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
            data: { message: "Request timeout - no response received in 60s", timeoutSeconds: 60 },
            addDevEvent,
          })
          abortController.abort()
        }
      }, 60000)

      if (isDevelopment()) {
        const requestEvent = {
          type: ClientRequest.MESSAGE,
          requestId: conversationId,
          timestamp: new Date().toISOString(),
          data: { endpoint: "/api/claude/stream", method: "POST", body: requestBody },
        }
        addDevEvent({
          eventName: ClientRequest.MESSAGE,
          event: requestEvent,
          rawSSE: `${JSON.stringify(requestEvent)}\n`,
        })
      }

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
            const errorData: StructuredError | null = await res.json().catch(() => null)
            let userMessage: string
            if (errorData?.error) {
              userMessage = getErrorMessage(errorData.error, errorData.details) || errorData.message
              const helpText = getErrorHelp(errorData.error, errorData.details)
              if (helpText) userMessage += `\n\n${helpText}`
              if (errorData.error === ErrorCodes.CONVERSATION_BUSY) {
                toast.error(userMessage, { duration: 4000, position: "top-center" })
              }
            } else {
              userMessage = `HTTP ${res.status}: ${res.statusText}`
            }
            throw new HttpError(userMessage, res.status, res.statusText, errorData?.error)
          }
          return res
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 5000,
          shouldRetry: error => isRetryableError(error),
        },
      )

      if (!response.body) {
        throw new Error("No response body received from server")
      }

      const headerRequestId = response.headers.get("X-Request-Id")
      if (headerRequestId) {
        currentRequestIdRef.current = headerRequestId
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const MAX_CONSECUTIVE_PARSE_ERRORS = 10
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done || shouldStopReading) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue

            try {
              const parsed: unknown = JSON.parse(line)

              if (!isValidStreamEvent(parsed)) {
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
                  data: { message: parsed, consecutiveErrors },
                  addDevEvent,
                })
                if (consecutiveErrors >= MAX_CONSECUTIVE_PARSE_ERRORS) {
                  shouldStopReading = true
                  reader.cancel()
                  break
                }
                continue
              }

              const eventData = parsed

              if (!currentRequestIdRef.current && eventData.requestId) {
                currentRequestIdRef.current = eventData.requestId
              }

              if (isWarningMessage(eventData)) {
                const warning = eventData.data.content as BridgeWarningContent
                console.log("[Chat] OAuth warning received:", warning.provider, warning.message)
                continue
              }

              if (isDevelopment()) {
                addDevEvent({ eventName: eventData.type, event: eventData, rawSSE: line })
              }

              receivedAnyMessage = true
              if (conversationId) {
                streamingActions.recordMessageReceived(conversationId)
                streamingActions.resetConsecutiveErrors(conversationId)
              }

              const message = parseStreamEvent(eventData, conversationId, streamingActions)
              if (message) {
                addMessage(message)
                if (isCompleteEvent(eventData) || isDoneEvent(eventData) || isErrorEvent(eventData)) {
                  receivedAnyMessage = true
                  setBusy(false)
                  isSubmitting.current = false
                  if ((isCompleteEvent(eventData) || isDoneEvent(eventData)) && !isErrorEvent(eventData)) {
                    setShowCompletionDots(true)
                    handleCompletionFeatures()
                  }
                  shouldStopReading = true
                  break
                }
              }
            } catch (parseError) {
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
                sendClientError({
                  conversationId,
                  errorType: ClientError.CRITICAL_PARSE_ERROR,
                  data: { consecutiveErrors, message: "Too many consecutive parse errors, stopping stream" },
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
        if (abortController.signal.aborted) {
          if (conversationId) streamingActions.endStream(conversationId)
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
        if (!receivedAnyMessage) {
          throw new Error("Connection lost before receiving any response")
        }
      }

      if (!receivedAnyMessage && !abortController.signal.aborted) {
        throw new Error("Server closed connection without sending any response")
      }

      if (conversationId) streamingActions.endStream(conversationId)
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        if (error instanceof HttpError) {
          sendClientError({
            conversationId,
            errorType: ClientError.HTTP_ERROR,
            data: { status: error.status, statusText: error.statusText, message: error.message },
            addDevEvent,
          })
        } else {
          sendClientError({
            conversationId,
            errorType: ClientError.GENERAL_ERROR,
            data: { errorName: error.name, message: error.message, stack: error.stack },
            addDevEvent,
          })
        }
      }

      if (error instanceof Error && error.name !== "AbortError") {
        const isAuthError =
          error instanceof HttpError &&
          (error.status === 401 ||
            error.errorCode === ErrorCodes.NO_SESSION ||
            error.errorCode === ErrorCodes.AUTH_REQUIRED)

        if (isAuthError) {
          authStore.handleSessionExpired("Your session has expired. Please log in again to continue.")
          return
        }

        const isConversationBusy = error instanceof HttpError && error.errorCode === ErrorCodes.CONVERSATION_BUSY
        if (!isConversationBusy) {
          const errorMessage: UIMessage = {
            id: Date.now().toString(),
            type: "sdk_message",
            content: { type: "result", is_error: true, result: error.message },
            timestamp: new Date(),
          }
          addMessage(errorMessage)
        }
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      abortControllerRef.current = null
      currentRequestIdRef.current = null
    }
  }

  function handleCompletionFeatures() {
    const state = useMessageStore.getState()
    const currentConvo = state.conversationId ? state.conversations[state.conversationId] : null
    const formattedMessages = currentConvo?.messages ? formatMessagesAsText(currentConvo.messages) : ""

    if (agentSupervisorEnabled && prGoal && workspace && formattedMessages) {
      setIsEvaluatingProgress(true)
      const agentAbort = new AbortController()
      agentManagerAbortRef.current = agentAbort

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

            const isDone = /^DONE\b|:\s*DONE\b|is:\s*DONE\b/i.test(action)
            if (isDone) {
              const doneMatch = data.nextAction.match(/DONE[\s\-:]*(.*)$/is)
              const message = doneMatch?.[1]?.trim() || "PR goal complete!"
              const doneMessage: UIMessage = {
                id: `agent-manager-done-${Date.now()}`,
                type: "agent_manager",
                content: { status: "done", message } satisfies AgentManagerContent,
                timestamp: new Date(),
              }
              addMessage(doneMessage)
              return
            }

            const isStop = /^STOP\b|:\s*STOP\b|is:\s*STOP\b/i.test(action)
            if (isStop) {
              const stopMatch = data.nextAction.match(/STOP[\s\-:]*(.*)$/is)
              const message = stopMatch?.[1]?.trim() || "Agent needs input"
              const stopMessage: UIMessage = {
                id: `agent-manager-stop-${Date.now()}`,
                type: "agent_manager",
                content: { status: "stop", message } satisfies AgentManagerContent,
                timestamp: new Date(),
              }
              addMessage(stopMessage)
              setMsg("")
              return
            }

            const agentMessage = `agentmanager> ${data.nextAction}`
            setMsg(agentMessage)
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
          if (err instanceof Error && err.name !== "AbortError") {
            console.error("[AgentSupervisor] Error:", err)
          }
        })
        .finally(() => {
          setIsEvaluatingProgress(false)
          agentManagerAbortRef.current = null
        })
    }
  }

  async function sendRegular(userMessage: UIMessage) {
    try {
      const requestBody = createRequestBody(buildPromptForClaude(userMessage))

      const r = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      })

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
          if (helpText) fullMessage += `\n\n${helpText}`
          if (errorData.error === ErrorCodes.CONVERSATION_BUSY) {
            toast.error(fullMessage, { duration: 4000, position: "top-center" })
          }
          throw new Error(fullMessage)
        }
        throw new Error(`HTTP ${r.status}: ${r.statusText}`)
      }

      const response = await r.json()
      const assistantMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        type: "sdk_message",
        content: response,
        timestamp: new Date(),
      }
      addMessage(assistantMessage)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      const isConversationBusy = errorMessage.includes("I'm still working on your previous request")

      if (!isConversationBusy) {
        const errorUIMessage: UIMessage = {
          id: (Date.now() + 1).toString(),
          type: "sdk_message",
          content: { type: "result", is_error: true, result: errorMessage },
          timestamp: new Date(),
        }
        addMessage(errorUIMessage)
      }
    }
  }

  const handleNewConversation = useCallback(() => {
    if (storeConversationId) {
      streamingActions.clearConversation(storeConversationId)
    }
    startNewConversation()
    clearForNewConversation()
    setTimeout(() => chatInputRef.current?.focus(), 0)
  }, [storeConversationId, streamingActions, startNewConversation, clearForNewConversation])

  const handleInsertTemplate = useCallback((prompt: string) => {
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

  return (
    <div
      className="h-[100dvh] flex flex-row overflow-hidden dark:bg-[#1a1a1a] dark:text-white"
      data-testid={mounted && workspace ? "workspace-ready" : "workspace-loading"}
    >
      <ConversationSidebar
        workspace={workspace}
        onConversationSelect={handleConversationSelect}
        onDeleteConversation={handleDeleteConversation}
        onOpenSettings={handleOpenSettings}
        onOpenInvite={() => setShowInviteModal(true)}
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
            onFeedbackClick={() => setShowFeedbackModal(true)}
            onTemplatesClick={() => setShowTemplatesModal(true)}
            onSettingsClick={handleOpenSettings}
            showPhotoMenu={showPhotoMenu}
            onPhotoMenuToggle={() => setShowPhotoMenu(!showPhotoMenu)}
            onPhotoMenuClose={() => setShowPhotoMenu(false)}
            photoButtonRef={photoButtonRef}
            chatInputRef={chatInputRef}
          />

          <WorkspaceInfoBar
            workspace={workspace}
            mounted={mounted}
            isTerminal={isTerminal}
            isSuperadminWorkspace={isSuperadminWorkspace}
            onSelectSite={() => setSettingsModalReason("websites")}
            onNewConversation={handleNewConversation}
            onMobilePreview={() => setShowMobilePreview(true)}
          />

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="p-4 space-y-1 mx-auto w-full md:max-w-2xl min-w-0">
              {messages.length === 0 && !busy && (
                <ChatEmptyState
                  workspace={workspace}
                  totalDomainCount={totalDomainCount}
                  onTemplatesClick={() => setShowTemplatesModal(true)}
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

              {busy && messages.length > 0 && messages[messages.length - 1]?.type === "user" && (
                <div className="my-4">
                  <div className="text-xs font-normal text-black/35 dark:text-white/35 flex items-center gap-1">
                    <ThinkingSpinner />
                    <span>thinking</span>
                  </div>
                </div>
              )}

              <AgentManagerIndicator
                isEvaluating={isEvaluatingProgress}
                message={msg}
                workspace={workspace}
                agentManagerAbortRef={agentManagerAbortRef}
                agentManagerTimeoutRef={agentManagerTimeoutRef}
                onCancel={() => {
                  if (msg.startsWith("agentmanager>")) setMsg("")
                  setIsEvaluatingProgress(false)
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
              busy={busy || !workspace}
              isStopping={isStopping}
              abortControllerRef={abortControllerRef}
              onSubmit={sendMessage}
              onStop={stopStreaming}
              onOpenTemplates={() => setShowTemplatesModal(true)}
              config={{
                enableAttachments: true,
                enableCamera: true,
                maxAttachments: 5,
                maxFileSize: 20 * 1024 * 1024,
                placeholder: !workspace ? "Select a site to start chatting..." : "Tell me what to change...",
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
      <ChatPageWrapper />
    </>
  )
}
