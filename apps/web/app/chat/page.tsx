"use client"
import { ExternalLink, Eye, EyeOff, Image } from "lucide-react"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { Toaster } from "react-hot-toast"
import { SettingsDropdown } from "@/components/ui/SettingsDropdown"
import { ChatInput } from "@/features/chat/components/ChatInput"
import { DevTerminal } from "@/features/chat/components/DevTerminal"
import { SubdomainInitializer } from "@/features/chat/components/SubdomainInitializer"
import { ThinkingGroup } from "@/features/chat/components/ThinkingGroup"
import { ThinkingSpinner } from "@/features/chat/components/ThinkingSpinner"
import { sendClientError } from "@/features/chat/lib/dev-client-error"
import { DevTerminalProvider, useDevTerminal } from "@/features/chat/lib/dev-terminal-context"
import { groupMessages } from "@/features/chat/lib/message-grouper"
import { parseStreamEvent, type StreamEvent, type UIMessage } from "@/features/chat/lib/message-parser"
import { renderMessage } from "@/features/chat/lib/message-renderer"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import type { StructuredError } from "@/lib/error-codes"
import { getErrorHelp, getErrorMessage } from "@/lib/error-codes"
import { HttpError, isAlreadyLogged } from "@/lib/errors"
import { isDevelopment, useDebugStore, useDebugVisible } from "@/lib/stores/debug-store"

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isSubmitting = useRef<boolean>(false)
  const router = useRouter()
  const toggleView = useDebugStore(state => state.toggleView)
  const isDebugView = useDebugVisible()
  const showSSETerminal = useDebugStore(state => state.showSSETerminal)
  const { addEvent: addDevEvent } = useDevTerminal()
  const { workspace, isTerminal, mounted, setWorkspace } = useWorkspace({ redirectOnMissing: "/" })

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

    // Add user message
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      type: "user",
      content: msg,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setMsg("")
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
      const requestBody = isTerminal
        ? { message: userMessage.content, workspace, conversationId }
        : { message: userMessage.content, conversationId }

      // Create AbortController for this request
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      // Set a timeout to detect hanging requests (60 seconds)
      timeoutId = setTimeout(() => {
        if (!receivedAnyMessage) {
          console.error("[Chat] Request timeout - no response received in 60s")

          sendClientError({
            conversationId,
            errorType: "timeout_error",
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
        addDevEvent({
          eventName: "outgoing_request",
          event: {
            type: "start",
            requestId: conversationId,
            timestamp: new Date().toISOString(),
            data: {
              endpoint: "/api/claude/stream",
              method: "POST",
              body: requestBody,
            },
          },
          rawSSE: `event: outgoing_request\ndata: ${JSON.stringify({
            endpoint: "/api/claude/stream",
            method: "POST",
            body: requestBody,
          })}\n\n`,
        })
      }

      const response = await fetch("/api/claude/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      })

      if (!response.ok) {
        // Try to read the JSON error response from backend
        let errorData: StructuredError | null = null
        try {
          errorData = await response.json()
        } catch {
          errorData = null
        }

        // Log once to dev terminal (prevents duplicate in catch block below)
        // Pattern: Log here → throw HttpError (marked) → catch skips re-logging
        sendClientError({
          conversationId,
          errorType: "http_error",
          data: {
            status: response.status,
            statusText: response.statusText,
            errorData: errorData,
          },
          addDevEvent,
        })

        // Build user-friendly message from structured error or fallback to HTTP status
        let userMessage: string
        if (errorData?.error) {
          userMessage = getErrorMessage(errorData.error, errorData.details) || errorData.message
          const helpText = getErrorHelp(errorData.error, errorData.details)

          if (helpText) {
            userMessage += `\n\n${helpText}`
          }
          // Show technical details in development only
          if (errorData.details && process.env.NODE_ENV === "development") {
            userMessage += `\n\nDetails: ${JSON.stringify(errorData.details, null, 2)}`
          }
        } else {
          userMessage = `HTTP ${response.status}: ${response.statusText}`
        }

        // Throw HttpError: extends Error but marked as "already logged"
        // Catch block below checks isAlreadyLogged() and skips duplicate logging
        throw new HttpError(userMessage, response.status, response.statusText)
      }

      if (!response.body) {
        throw new Error("No response body received from server")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      // Track parse errors to detect stream corruption
      let consecutiveParseErrors = 0
      const MAX_CONSECUTIVE_PARSE_ERRORS = 3

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          let currentEvent = ""
          let currentEventData = ""
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim()
              currentEventData = line
            } else if (line.startsWith("data: ")) {
              const dataLine = line.slice(6)
              currentEventData += `\n${line}\n\n`

              // Parse JSON once
              try {
                const rawData = JSON.parse(dataLine)

                // Capture to dev terminal (dev mode only)
                if (isDevelopment()) {
                  if (currentEvent.startsWith("bridge_") && rawData.requestId && rawData.timestamp && rawData.type) {
                    addDevEvent({
                      eventName: currentEvent,
                      event: rawData as StreamEvent,
                      rawSSE: currentEventData,
                    })
                  } else if (currentEvent === "done") {
                    // Capture done event, skip ping (filtered in DevTerminal)
                    addDevEvent({
                      eventName: currentEvent,
                      event: {
                        type: currentEvent as "done",
                        requestId: "n/a",
                        timestamp: new Date().toISOString(),
                        data: rawData,
                      },
                      rawSSE: currentEventData,
                    })
                  }
                  // Skip ping events entirely - not displayed in terminal
                }

                // Process bridge events for UI
                if (currentEvent.startsWith("bridge_")) {
                  if (rawData.requestId && rawData.timestamp && rawData.type) {
                    const eventData: StreamEvent = rawData
                    receivedAnyMessage = true

                    const message = parseStreamEvent(eventData)
                    if (message) {
                      setMessages(prev => [...prev, message])
                    }

                    consecutiveParseErrors = 0
                  } else {
                    console.error("[Chat] Invalid SSE event structure:", rawData)
                    consecutiveParseErrors++

                    sendClientError({
                      conversationId,
                      errorType: "invalid_event_structure",
                      data: {
                        eventName: currentEvent,
                        rawData: rawData,
                        consecutiveErrors: consecutiveParseErrors,
                      },
                      addDevEvent,
                    })
                  }
                }
              } catch (parseError) {
                console.error("[Chat] Failed to parse SSE data:", {
                  line: dataLine.slice(0, 200),
                  error: parseError,
                })
                consecutiveParseErrors++

                sendClientError({
                  conversationId,
                  errorType: "parse_error",
                  data: {
                    consecutiveErrors: consecutiveParseErrors,
                    line: dataLine.slice(0, 200),
                    error: parseError instanceof Error ? parseError.message : String(parseError),
                  },
                  addDevEvent,
                })

                if (consecutiveParseErrors >= MAX_CONSECUTIVE_PARSE_ERRORS) {
                  console.error("[Chat] Too many consecutive parse errors, stopping stream", consecutiveParseErrors)

                  sendClientError({
                    conversationId,
                    errorType: "critical_parse_error",
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
              // Silently ignore all other events (raw Claude SDK events)
              currentEvent = "" // Reset after processing
            }
          }
        }
      } catch (readerError) {
        sendClientError({
          conversationId,
          errorType: "reader_error",
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
      // Prevent duplicate logging: HttpError was already logged above as "http_error"
      // Other errors (network, parsing, etc.) need logging here as "general_error"
      if (error instanceof Error && error.name !== "AbortError" && !isAlreadyLogged(error)) {
        sendClientError({
          conversationId,
          errorType: "general_error",
          data: {
            errorName: error.name,
            message: error.message,
            stack: error.stack,
          },
          addDevEvent,
        })
      }

      // Show error to user (even if logging was skipped - we suppress duplicate
      // *logging* but still *display* all errors to user, except AbortError)
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
      const requestBody = isTerminal
        ? { message: userMessage.content, workspace, conversationId }
        : { message: userMessage.content, conversationId }

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
    // Log interrupt to dev terminal before aborting (dev mode only)
    if (isDevelopment()) {
      addDevEvent({
        eventName: "bridge_interrupt",
        event: {
          type: "interrupt",
          requestId: conversationId,
          timestamp: new Date().toISOString(),
          data: {
            message: "Response interrupted by user",
            source: "client_stop_button",
          },
        },
        rawSSE: `event: bridge_interrupt\ndata: ${JSON.stringify({
          type: "interrupt",
          requestId: conversationId,
          timestamp: new Date().toISOString(),
          data: {
            message: "Response interrupted by user",
            source: "client_stop_button",
          },
        })}\n\n`,
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

  // SSE terminal visibility is separate from debug view

  return (
    <div className="h-[100dvh] flex flex-row overflow-hidden dark:bg-[#1a1a1a] dark:text-white">
      <div className="flex-1 flex flex-col overflow-hidden transition-all">
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
                  onClick={() => router.push("/photobook")}
                  className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                  aria-label="Photos"
                  title="Photos"
                >
                  <Image size={14} />
                </button>
                <SettingsDropdown onNewChat={startNewConversation} />
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
