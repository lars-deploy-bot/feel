"use client"
import { ExternalLink, Eye, EyeOff, Image, Layers, MessageCircle } from "lucide-react"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FeedbackModal } from "@/components/modals/FeedbackModal"
import { SettingsModal } from "@/components/modals/SettingsModal"
import { SuperTemplatesModal } from "@/components/modals/SuperTemplatesModal"
import { PhotoMenu } from "@/components/ui/PhotoMenu"
import { SettingsDropdown } from "@/components/ui/SettingsDropdown"
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher"
import { ChatDropOverlay } from "@/features/chat/components/ChatDropOverlay"
import { ChatInput } from "@/features/chat/components/ChatInput"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import { ConversationSidebar } from "@/features/chat/components/ConversationSidebar"
import { DevTerminal } from "@/features/chat/components/DevTerminal"
import { Sandbox } from "@/features/chat/components/Sandbox"
import { SubdomainInitializer } from "@/features/chat/components/SubdomainInitializer"
import { ThinkingGroup } from "@/features/chat/components/ThinkingGroup"
import { ThinkingSpinner } from "@/features/chat/components/ThinkingSpinner"
import { ThreeDotsComplete } from "@/features/chat/components/ThreeDotsComplete"
import { useConversationSession } from "@/features/chat/hooks/useConversationSession"
import { useImageUpload } from "@/features/chat/hooks/useImageUpload"
import {
  ClientError,
  ClientRequest,
  DevTerminalProvider,
  useDevTerminal,
} from "@/features/chat/lib/dev-terminal-context"
import { groupMessages } from "@/features/chat/lib/message-grouper"
import { parseStreamEvent, type UIMessage } from "@/features/chat/lib/message-parser"
import { renderMessage } from "@/features/chat/lib/message-renderer"
import { SandboxProvider } from "@/features/chat/lib/sandbox-context"
import { sendClientError } from "@/features/chat/lib/send-client-error"
import { isValidStreamEvent } from "@/features/chat/lib/stream-guards"
import { BridgeInterruptSource } from "@/features/chat/lib/streaming/ndjson"
import { isCompleteEvent, isDoneEvent, isErrorEvent } from "@/features/chat/types/stream"
import { buildPromptWithAttachments } from "@/features/chat/utils/prompt-builder"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import type { StructuredError } from "@/lib/error-codes"
import { ErrorCodes, getErrorHelp, getErrorMessage } from "@/lib/error-codes"
import { HttpError } from "@/lib/errors"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { isRetryableError, retryWithBackoff } from "@/lib/retry"
import { useSidebarActions } from "@/lib/stores/conversationSidebarStore"
import { isDevelopment, useDebugActions, useDebugVisible, useSandbox, useSSETerminal } from "@/lib/stores/debug-store"
import { useLLMStore } from "@/lib/stores/llmStore"
import { useCurrentConversationId, useMessageActions, useMessages } from "@/lib/stores/messageStore"
import { useStreamingActions } from "@/lib/stores/streamingStore"

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
  const [busy, setBusy] = useState(false)
  const [useStreaming, _setUseStreaming] = useState(true)
  const [shouldForceScroll, setShouldForceScroll] = useState(false)
  const [userHasManuallyScrolled, setUserHasManuallyScrolled] = useState(false)
  const [subdomainInitialized, setSubdomainInitialized] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  // Settings modal: null (closed), 'manual' (user-opened), 'error' (auto-opened for error)
  const [settingsModalReason, setSettingsModalReason] = useState<"manual" | "error" | null>(null)

  const [showTemplatesModal, setShowTemplatesModal] = useState(false)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showCompletionDots, setShowCompletionDots] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

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
  const { toggleView, setSSETerminal, setSSETerminalMinimized, setSandbox, setSandboxMinimized } = useDebugActions()
  const isDebugView = useDebugVisible()
  const showSSETerminal = useSSETerminal()
  const showSandbox = useSandbox()
  const { addEvent: addDevEvent } = useDevTerminal()
  const { workspace, isTerminal, mounted, setWorkspace } = useWorkspace({
    allowEmpty: true,
  })
  const { apiKey: userApiKey, model: userModel } = useLLMStore()
  const streamingActions = useStreamingActions()

  // Fetch organizations and auto-select if none selected
  const { organizations, loading: orgsLoading, error: orgsError } = useOrganizations()

  // Auto-open settings modal on org loading error
  useEffect(() => {
    if (orgsError && settingsModalReason === null) {
      setSettingsModalReason("error")
    }
  }, [orgsError, settingsModalReason])

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

    if (window.location.hostname.includes("staging")) {
      setSSETerminal(true)
      setSSETerminalMinimized(true)
      // Sandbox disabled by default - user can enable manually
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

  async function sendMessage() {
    // Simple: Block if already submitting or no message
    if (isSubmitting.current || busy || !msg.trim()) return

    // Lock submission immediately
    isSubmitting.current = true
    setBusy(true)

    // Get attachments for structured storage
    const attachments = chatInputRef.current?.getAttachments() || []

    // Add user message with original text + structured attachments
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      type: "user",
      content: msg, // Original message (not augmented)
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined,
    }
    addMessage(userMessage)
    setMsg("")

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
                  setBusy(false)
                  // Show completion dots only for successful completion (not errors)
                  if ((isCompleteEvent(eventData) || isDoneEvent(eventData)) && !isErrorEvent(eventData)) {
                    setShowCompletionDots(true)
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

      // Check if we received any response at all
      if (!receivedAnyMessage) {
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
  }, [storeConversationId, streamingActions, startNewConversation, clearForNewConversation])

  /**
   * Stop active streaming response via explicit cancellation endpoint.
   *
   * === CANCELLATION ARCHITECTURE (CLIENT-SIDE) ===
   *
   * Two-path cancellation strategy (handles all timing scenarios):
   *
   * 1. PRIMARY PATH (99% of cases):
   *    - Server sends X-Request-Id header immediately in HTTP response
   *    - We store it in currentRequestIdRef (line 352)
   *    - Call POST /api/claude/stream/cancel with { requestId }
   *    - Server cancels via registry, releases lock instantly
   *
   * 2. FALLBACK PATH (super-early Stop, < 100ms):
   *    - User clicks Stop before X-Request-Id header processed
   *    - currentRequestIdRef is still null
   *    - Call POST /api/claude/stream/cancel with { conversationId, workspace }
   *    - Server searches registry by conversationKey, cancels stream
   *    - Backup: abort() triggers stream.cancel() which releases lock via finally block
   *
   * Why both paths?
   * - Primary path: Explicit cancellation with exact requestId (most reliable)
   * - Fallback path: Handles race condition when Stop clicked before header arrives
   * - abort(): Safety net that triggers finally block cleanup (super-early Stop)
   *
   * Cleanup sequence:
   * 1. Cancel endpoint called (best-effort, continues even if fails)
   * 2. abort() called (triggers stream.cancel() → finally block)
   * 3. Interrupt message added (stops thinking animation)
   * 4. State reset (busy = false, isSubmitting = false)
   * 5. currentRequestIdRef cleared for next request
   *
   * Production behavior:
   * - Works through Cloudflare → Caddy → Next.js proxy layers
   * - req.signal.addEventListener("abort") NOT used (doesn't work in production)
   * - Explicit HTTP endpoint is production-safe solution
   *
   * See docs/streaming/cancellation-architecture.md for server-side details.
   */
  async function stopStreaming() {
    console.log("[Chat] stopStreaming called, currentRequestIdRef:", currentRequestIdRef.current)

    if (isDevelopment()) {
      const interruptEvent = {
        type: ClientRequest.INTERRUPT,
        requestId: conversationId,
        timestamp: new Date().toISOString(),
        data: {
          message: "Response interrupted by user",
          source: BridgeInterruptSource.CLIENT_CANCEL,
        },
      }
      addDevEvent({
        eventName: ClientRequest.INTERRUPT,
        event: interruptEvent,
        rawSSE: JSON.stringify(interruptEvent),
      })
    }

    // Call explicit cancel endpoint (always, with fallback to conversationId)
    try {
      if (currentRequestIdRef.current) {
        // Primary path: Cancel by requestId (received from X-Request-Id header)
        console.log("[Chat] Calling cancel endpoint with requestId:", currentRequestIdRef.current)
        await fetch("/api/claude/stream/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: currentRequestIdRef.current }),
        })
        console.log("[Chat] Cancel endpoint called successfully (by requestId)")
        currentRequestIdRef.current = null
      } else {
        // Fallback path: Cancel by conversationId (super-early Stop, before X-Request-Id received)
        console.log(
          "[Chat] No requestId available - using conversationId fallback for super-early Stop:",
          conversationId,
        )
        await fetch("/api/claude/stream/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, workspace }),
        })
        console.log("[Chat] Cancel endpoint called successfully (by conversationId)")
      }
    } catch (error) {
      console.error("[Chat] Failed to call cancel endpoint:", error)
      // Continue with abort anyway - cancel endpoint is best-effort
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Add completion message to mark thinking group as complete
    // Without this, the thinking group stays animated (isComplete: false)
    const interruptMessage: UIMessage = {
      id: Date.now().toString(),
      type: "complete",
      content: {},
      timestamp: new Date(),
    }
    addMessage(interruptMessage)

    // Reset state - request is truly stopped
    setBusy(false)
    setShowCompletionDots(true) // Show completion dots even on interrupt
    isSubmitting.current = false
  }

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

  const handleSwitchWorkspace = useCallback(
    (newWorkspace: string) => {
      setWorkspace(newWorkspace)
      handleNewConversation()
    },
    [setWorkspace, handleNewConversation],
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
        onNewConversation={handleNewConversation}
        onConversationSelect={handleConversationSelect}
        onDeleteConversation={handleDeleteConversation}
      />

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
          {/* Header */}
          <div className="flex-shrink-0 border-b border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between px-6 py-4 mx-auto w-full md:max-w-2xl">
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
                    <circle cx="12" cy="12" r="4" fill="currentColor" className="alive-logo-inner" />
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="text-lg font-medium text-black dark:text-white hover:opacity-80 transition-opacity"
                  aria-label="Toggle conversation sidebar"
                >
                  {mounted && isTerminal ? "Chat" : "Chat"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {isDevelopment() && (
                  <button
                    type="button"
                    onClick={toggleView}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors text-black/60 hover:text-black/80 border-black/20 hover:border-black/40 dark:text-white/60 dark:hover:text-white/80 dark:border-white/20 dark:hover:border-white/40"
                    title={isDebugView ? "Hide debug details" : "Show debug details"}
                  >
                    {isDebugView ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>{isDebugView ? "Debug" : "Live"}</span>
                  </button>
                )}
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
                    triggerRef={photoButtonRef}
                  />
                </div>
                <SettingsDropdown
                  onNewChat={handleNewConversation}
                  currentWorkspace={workspace ?? undefined}
                  onSwitchWorkspace={handleSwitchWorkspace}
                  onOpenSettings={handleOpenSettings}
                />
              </div>
            </div>
          </div>

          {mounted && (
            <div className="flex-shrink-0 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="px-6 py-3 mx-auto w-full md:max-w-2xl">
                {/* Empty state messages - only show when no workspace and no error */}
                {!workspace && !orgsError && (
                  <>
                    {totalDomainCount === 0 && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-900 dark:text-blue-100 mb-2 font-medium">
                          Welcome! You don't have any domains yet.
                        </p>
                        <a
                          href="/deploy"
                          className="inline-block px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          Deploy your first site
                        </a>
                      </div>
                    )}
                    {!orgsLoading && totalDomainCount > 0 && (
                      <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-900 dark:text-blue-100">Loading workspace...</p>
                      </div>
                    )}
                  </>
                )}

                {/* Workspace info bar - always visible */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center" data-testid="workspace-section">
                      <span className="text-black/50 dark:text-white/50 font-medium" data-testid="workspace-label">
                        site
                      </span>
                      {isTerminal ? (
                        <WorkspaceSwitcher currentWorkspace={workspace} onWorkspaceChange={setWorkspace} />
                      ) : (
                        <span className="ml-3 font-diatype-mono font-medium text-black/80 dark:text-white/80">
                          {workspace || "loading..."}
                        </span>
                      )}
                    </div>
                    {workspace && (
                      <a
                        href={`https://${workspace}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors flex items-center gap-1"
                      >
                        open
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {workspace && (
                    <button
                      type="button"
                      onClick={handleNewConversation}
                      className="px-2 py-1 text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                    >
                      new chat
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4 space-y-2 mx-auto w-full md:max-w-2xl">
              {/* Empty state - only show when no messages */}
              {messages.length === 0 && !busy && (
                <div className="flex items-start justify-center h-full pt-32">
                  <div className="max-w-md text-center space-y-6">
                    {workspace ? (
                      <>
                        <p className="text-lg text-black/90 dark:text-white/90 font-medium">
                          Tell me what to build and I'll update your site
                        </p>
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
                    ) : (
                      <p className="text-lg text-black/60 dark:text-white/60 font-medium">
                        {totalDomainCount === 0
                          ? "Deploy your first site to get started"
                          : "Select a site above to start chatting"}
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
              abortControllerRef={abortControllerRef}
              onSubmit={sendMessage}
              onStop={stopStreaming}
              onOpenTemplates={() => setShowTemplatesModal(true)}
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

      {showSandbox && <Sandbox />}
      {showSSETerminal && <DevTerminal />}
      {showFeedbackModal && (
        <FeedbackModal
          onClose={() => setShowFeedbackModal(false)}
          workspace={workspace ?? undefined}
          conversationId={conversationId}
        />
      )}
      {settingsModalReason && (
        <SettingsModal
          onClose={handleCloseSettings}
          initialTab={settingsModalReason === "error" ? "organization" : undefined}
        />
      )}
      {showTemplatesModal && (
        <SuperTemplatesModal onClose={() => setShowTemplatesModal(false)} onInsertTemplate={handleInsertTemplate} />
      )}
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
