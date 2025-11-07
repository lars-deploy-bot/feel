"use client"
import { ExternalLink, Eye, EyeOff, Image, MessageCircle } from "lucide-react"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { Toaster } from "react-hot-toast"
import { FeedbackModal } from "@/components/modals/FeedbackModal"
import { SettingsModal } from "@/components/modals/SettingsModal"
import { PhotoMenu } from "@/components/ui/PhotoMenu"
import { SettingsDropdown } from "@/components/ui/SettingsDropdown"
import { ChatDropOverlay } from "@/features/chat/components/ChatDropOverlay"
import { ChatInput } from "@/features/chat/components/ChatInput"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import { DevTerminal } from "@/features/chat/components/DevTerminal"
import { SubdomainInitializer } from "@/features/chat/components/SubdomainInitializer"
import { ThinkingGroup } from "@/features/chat/components/ThinkingGroup"
import { ThinkingSpinner } from "@/features/chat/components/ThinkingSpinner"
import {
  ClientError,
  ClientRequest,
  DevTerminalProvider,
  useDevTerminal,
} from "@/features/chat/lib/dev-terminal-context"
import { groupMessages } from "@/features/chat/lib/message-grouper"
import { parseStreamEvent, type StreamEvent, type UIMessage } from "@/features/chat/lib/message-parser"
import { renderMessage } from "@/features/chat/lib/message-renderer"
import { sendClientError } from "@/features/chat/lib/send-client-error"
import { BridgeInterruptSource } from "@/features/chat/lib/streaming/ndjson"
import { buildPromptWithAttachments } from "@/features/chat/utils/prompt-builder"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import type { StructuredError } from "@/lib/error-codes"
import { getErrorHelp, getErrorMessage } from "@/lib/error-codes"
import { HttpError } from "@/lib/errors"
import { isRetryableError, retryWithBackoff } from "@/lib/retry"
import { isDevelopment, useDebugActions, useDebugVisible, useSSETerminal } from "@/lib/stores/debug-store"
import { useLLMStore } from "@/lib/stores/llmStore"

const SUGGESTIONS = [
  '"Add a contact form"',
  '"Change the background to blue"',
  '"Make the text bigger"',
  '"Add a navigation menu"',
  '"Create a hero section"',
  '"Add a footer"',
]

function ChatPageContent() {
  const [msg, setMsg] = useState("")
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [useStreaming, _setUseStreaming] = useState(true)
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID())
  const [shouldForceScroll, setShouldForceScroll] = useState(false)
  const [userHasManuallyScrolled, setUserHasManuallyScrolled] = useState(false)
  const [subdomainInitialized, setSubdomainInitialized] = useState(false)
  const [randomSuggestion, setRandomSuggestion] = useState(SUGGESTIONS[0])
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isSubmitting = useRef<boolean>(false)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const dragCounter = useRef(0)
  const photoButtonRef = useRef<HTMLButtonElement>(null)
  const { toggleView } = useDebugActions()
  const isDebugView = useDebugVisible()
  const showSSETerminal = useSSETerminal()
  const { addEvent: addDevEvent } = useDevTerminal()
  const { workspace, isTerminal, mounted, setWorkspace } = useWorkspace({ redirectOnMissing: "/" })
  const { apiKey: userApiKey, model: userModel } = useLLMStore()

  // Helper to create API request body (DRY)
  const createRequestBody = (message: string) => {
    const baseBody = {
      message,
      conversationId,
      apiKey: userApiKey || undefined,
      model: userModel,
    }

    return isTerminal ? { ...baseBody, workspace } : baseBody
  }

  // Pick random suggestion on mount (client-side only)
  useEffect(() => {
    setRandomSuggestion(SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)])
  }, [])

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
  }, [mounted])

  useEffect(() => {
    const messagesContainer = messagesEndRef.current?.parentElement
    if (messagesContainer) {
      // Force scroll if we just sent a message
      if (shouldForceScroll) {
        isAutoScrolling.current = true
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
        setShouldForceScroll(false)
        setUserHasManuallyScrolled(false)
        setTimeout(() => {
          isAutoScrolling.current = false
        }, 300)
      }
      // Auto-scroll if user hasn't manually scrolled
      else if (!userHasManuallyScrolled) {
        isAutoScrolling.current = true
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
        setTimeout(() => {
          isAutoScrolling.current = false
        }, 300)
      }
      // Only scroll if near bottom when user has manually scrolled
      else {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

        if (isNearBottom) {
          isAutoScrolling.current = true
          messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
          setTimeout(() => {
            isAutoScrolling.current = false
          }, 300)
        }
      }
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

  async function sendMessage() {
    // Simple: Block if already submitting or no message
    if (isSubmitting.current || busy || !msg.trim()) return

    // Lock submission immediately
    isSubmitting.current = true
    setBusy(true)

    // Get attachments and build prompt with library image references
    const attachments = chatInputRef.current?.getAttachments() || []
    const augmentedMsg = buildPromptWithAttachments(msg, attachments)

    // Add user message
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      type: "user",
      content: augmentedMsg,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setMsg("")

    // Clear library images from attachments (they're in the prompt now)
    chatInputRef.current?.clearLibraryImages()

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

    try {
      const requestBody = createRequestBody(userMessage.content)

      // Create AbortController for this request
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Set a timeout to detect hanging requests (60 seconds)
      timeoutId = setTimeout(() => {
        if (!receivedAnyMessage) {
          console.error("[Chat] Request timeout - no response received in 60s")

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
            } else {
              userMessage = `HTTP ${res.status}: ${res.statusText}`
            }

            // Throw HttpError - will be retried if 5xx, logged in outer catch after retries exhausted
            throw new HttpError(userMessage, res.status, res.statusText)
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

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      // Track parse errors to detect stream corruption
      let consecutiveParseErrors = 0
      const MAX_CONSECUTIVE_PARSE_ERRORS = 10 // Increased from 3

      // Buffer for incomplete NDJSON lines
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

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
              const eventData: StreamEvent = JSON.parse(line)

              // Validate message structure
              if (!eventData.requestId || !eventData.timestamp || !eventData.type) {
                console.error("[Chat] Invalid message structure:", eventData)
                consecutiveParseErrors++

                sendClientError({
                  conversationId,
                  errorType: ClientError.INVALID_EVENT_STRUCTURE,
                  data: {
                    message: eventData,
                    consecutiveErrors: consecutiveParseErrors,
                  },
                  addDevEvent,
                })

                if (consecutiveParseErrors >= MAX_CONSECUTIVE_PARSE_ERRORS) {
                  console.error("[Chat] Too many consecutive parse errors, stopping stream", consecutiveParseErrors)

                  sendClientError({
                    conversationId,
                    errorType: ClientError.CRITICAL_PARSE_ERROR,
                    data: {
                      consecutiveErrors: consecutiveParseErrors,
                      message: "Too many consecutive parse errors, stopping stream",
                    },
                    addDevEvent,
                  })

                  setMessages(prev => [
                    ...prev,
                    {
                      id: Date.now().toString(),
                      type: "sdk_message",
                      content: {
                        type: "result",
                        is_error: true,
                        result:
                          "Connection unstable: Multiple parse errors detected. Please try again or refresh the page.",
                      },
                      timestamp: new Date(),
                    },
                  ])
                  reader.cancel()
                  break
                }
              } else {
                // Valid message - capture to dev terminal and process
                if (isDevelopment()) {
                  addDevEvent({
                    eventName: eventData.type,
                    event: eventData,
                    rawSSE: line,
                  })
                }

                // Process the message for UI
                receivedAnyMessage = true
                const message = parseStreamEvent(eventData)
                if (message) {
                  setMessages(prev => [...prev, message])
                }

                consecutiveParseErrors = 0
              }
            } catch (parseError) {
              console.error("[Chat] Failed to parse NDJSON line:", {
                line: line.slice(0, 200),
                error: parseError,
              })
              consecutiveParseErrors++

              sendClientError({
                conversationId,
                errorType: ClientError.PARSE_ERROR,
                data: {
                  consecutiveErrors: consecutiveParseErrors,
                  line: line.slice(0, 200),
                  error: parseError instanceof Error ? parseError.message : String(parseError),
                },
                addDevEvent,
              })

              if (consecutiveParseErrors >= MAX_CONSECUTIVE_PARSE_ERRORS) {
                console.error("[Chat] Too many consecutive parse errors, stopping stream", consecutiveParseErrors)

                sendClientError({
                  conversationId,
                  errorType: ClientError.CRITICAL_PARSE_ERROR,
                  data: {
                    consecutiveErrors: consecutiveParseErrors,
                    message: "Too many consecutive parse errors, stopping stream",
                  },
                  addDevEvent,
                })

                setMessages(prev => [
                  ...prev,
                  {
                    id: Date.now().toString(),
                    type: "sdk_message",
                    content: {
                      type: "result",
                      is_error: true,
                      result:
                        "Connection unstable: Multiple parse errors detected. Please try again or refresh the page.",
                    },
                    timestamp: new Date(),
                  },
                ])
                reader.cancel()
                break
              }
            }
          }
        }
      } catch (readerError) {
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

      // Show error message to user
      if (error instanceof Error && error.name !== "AbortError") {
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
        setMessages(prev => [...prev, errorMessage])
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      abortControllerRef.current = null
    }
  }

  async function sendRegular(userMessage: UIMessage) {
    try {
      const requestBody = createRequestBody(userMessage.content)

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
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        type: "sdk_message",
        content: {
          type: "result",
          is_error: true,
          result: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  function startNewConversation() {
    setConversationId(crypto.randomUUID())
    setMessages([])
  }

  function stopStreaming() {
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

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Reset state - request is truly stopped
    setBusy(false)
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

  // SSE terminal visibility is separate from debug view

  return (
    <div className="h-[100dvh] flex flex-row overflow-hidden dark:bg-[#1a1a1a] dark:text-white">
      <div
        className="flex-1 flex flex-col overflow-hidden transition-all relative"
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
              <h1 className="text-lg font-medium text-black dark:text-white">
                {mounted && isTerminal ? "Chat" : "Chat"}
              </h1>
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
                  className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black/30 dark:text-white/30 border border-black/20 dark:border-white/20 transition-colors cursor-not-allowed"
                  aria-label="Send Feedback"
                  title="Send Feedback (Coming Soon)"
                  disabled
                >
                  <MessageCircle size={14} />
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
                  onNewChat={startNewConversation}
                  currentWorkspace={workspace}
                  onSwitchWorkspace={newWorkspace => {
                    setWorkspace(newWorkspace)
                    startNewConversation()
                  }}
                  onOpenSettings={() => setShowSettingsModal(true)}
                />
              </div>
            </div>
          </div>

          {mounted && isTerminal && workspace && (
            <div className="flex-shrink-0 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="px-6 py-3 mx-auto w-full md:max-w-2xl">
                <div className="flex items-center text-xs">
                  <span className="text-black/50 dark:text-white/50 font-medium">site</span>
                  <a
                    href={`https://${workspace}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-3 font-diatype-mono text-black/80 dark:text-white/80 font-medium hover:text-black dark:hover:text-white underline decoration-black/30 dark:decoration-white/30 hover:decoration-black dark:hover:decoration-white flex items-center gap-1.5 transition-colors"
                  >
                    {workspace}
                    <ExternalLink size={12} className="opacity-60" />
                  </a>
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
                  <div className="max-w-md text-center space-y-4">
                    <p className="text-base text-black/80 dark:text-white/80 font-medium">
                      Tell me what to build and I'll update your site
                    </p>
                    <div className="text-sm text-black/50 dark:text-white/50 font-normal">
                      <p>{randomSuggestion}</p>
                    </div>
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
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="mx-auto w-full md:max-w-2xl">
            <ChatInput
              ref={chatInputRef}
              message={msg}
              setMessage={setMsg}
              busy={busy}
              abortControllerRef={abortControllerRef}
              onSubmit={sendMessage}
              onStop={stopStreaming}
              config={{
                enableAttachments: true,
                enableCamera: true,
                maxAttachments: 5,
                maxFileSize: 20 * 1024 * 1024, // 20MB
                placeholder: "Tell me what to change...",
              }}
            />
          </div>
        </div>
      </div>

      {showSSETerminal && <DevTerminal />}
      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
    </div>
  )
}

function ChatPageWrapper() {
  return (
    <DevTerminalProvider>
      <ChatPageContent />
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
