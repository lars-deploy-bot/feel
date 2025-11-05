"use client"
import { ExternalLink, Eye, EyeOff, Image, Square } from "lucide-react"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { SettingsDropdown } from "@/components/ui/SettingsDropdown"
import { DevTerminal } from "@/features/chat/components/DevTerminal"
import { SubdomainInitializer } from "@/features/chat/components/SubdomainInitializer"
import { ThinkingGroup } from "@/features/chat/components/ThinkingGroup"
import { ThinkingSpinner } from "@/features/chat/components/ThinkingSpinner"
import { sendClientError } from "@/features/chat/lib/dev-client-error"
import { DevTerminalProvider, useDevTerminal } from "@/features/chat/lib/dev-terminal-context"
import { groupMessages } from "@/features/chat/lib/message-grouper"
import { parseStreamEvent, type StreamEvent, type UIMessage } from "@/features/chat/lib/message-parser"
import { renderMessage } from "@/features/chat/lib/message-renderer"
import { isTerminalMode } from "@/features/workspace/types/workspace"
import { DevModeProvider, useDevMode } from "@/lib/dev-mode-context"
import type { StructuredError } from "@/lib/error-codes"
import { getErrorHelp, getErrorMessage } from "@/lib/error-codes"

function ChatPageContent() {
  const [msg, setMsg] = useState("")
  const [workspace, setWorkspace] = useState("")
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [useStreaming, _setUseStreaming] = useState(true)
  const [isTerminal, setIsTerminal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID())
  const [shouldForceScroll, setShouldForceScroll] = useState(false)
  const [userHasManuallyScrolled, setUserHasManuallyScrolled] = useState(false)
  const [subdomainInitialized, setSubdomainInitialized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isSubmitting = useRef<boolean>(false)
  const router = useRouter()
  const { showDevContent, toggleDevContent } = useDevMode()
  const { addEvent: addDevEvent } = useDevTerminal()

  useEffect(() => {
    setMounted(true)
    setIsTerminal(isTerminalMode(window.location.hostname))
  }, [])

  useEffect(() => {
    if (isTerminal) {
      const savedWorkspace = sessionStorage.getItem("workspace")
      if (savedWorkspace) {
        setWorkspace(savedWorkspace)
      } else {
        // Redirect to login instead of workspace setup
        router.push("/")
        return
      }
    }
  }, [isTerminal, router])

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
      if (process.env.NODE_ENV === "development") {
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

        // If we got structured error data, use error registry for user-friendly message
        if (errorData?.error) {
          const userMessage = getErrorMessage(errorData.error, errorData.details) || errorData.message
          const helpText = getErrorHelp(errorData.error, errorData.details)

          let fullMessage = userMessage
          if (helpText) {
            fullMessage += `\n\n${helpText}`
          }
          // Show details in development only
          if (errorData.details && process.env.NODE_ENV === "development") {
            fullMessage += `\n\nDetails: ${JSON.stringify(errorData.details, null, 2)}`
          }

          throw new Error(fullMessage)
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
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
                if (process.env.NODE_ENV === "development") {
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
      // Log error to dev terminal (dev mode only)
      if (error instanceof Error && error.name !== "AbortError") {
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

      // Only show error if not aborted by user
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
    if (process.env.NODE_ENV === "development") {
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

  const showTerminal = process.env.NODE_ENV === "development" && showDevContent

  return (
    <div className="h-[100dvh] flex flex-row overflow-hidden dark:bg-[#1a1a1a] dark:text-white">
      <div className={`flex-1 flex flex-col mx-auto overflow-hidden transition-all ${showTerminal ? "" : "max-w-4xl"}`}>
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
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
          <h1 className="text-lg font-medium text-black dark:text-white">{mounted && isTerminal ? "Chat" : "Chat"}</h1>
          <div className="flex items-center gap-2">
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={toggleDevContent}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors text-black/60 hover:text-black/80 border-black/20 hover:border-black/40 dark:text-white/60 dark:hover:text-white/80 dark:border-white/20 dark:hover:border-white/40"
                title={showDevContent ? "Hide dev info (production view)" : "Show dev info (development view)"}
              >
                {showDevContent ? <Eye size={14} /> : <EyeOff size={14} />}
                <span>{showDevContent ? "Dev" : "Prod"}</span>
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

        {mounted && isTerminal && workspace && (
          <div className="flex-shrink-0 px-6 py-3 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
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
        )}

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          {/* Empty state - only show when no messages */}
          {messages.length === 0 && !busy && (
            <div className="flex items-center justify-center h-full">
              <div className="max-w-md text-center space-y-4 pb-20">
                <p className="text-base text-black/80 dark:text-white/80 font-medium">
                  Tell me what to build and I'll update your site
                </p>
                <div className="text-sm text-black/50 dark:text-white/50 font-normal space-y-1.5">
                  <p>"Add a contact form"</p>
                  <p>"Change the background to blue"</p>
                  <p>"Make the text bigger"</p>
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

        {/* Input */}
        <div className="flex-shrink-0 p-4 safe-area-inset-bottom">
          <div className="relative border border-black/20 dark:border-white/20 focus-within:border-black/40 dark:focus-within:border-white/40 transition-colors">
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Tell me what to change..."
              className="w-full resize-none border-0 bg-transparent text-base font-normal focus:outline-none p-3 pr-20 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
              style={{ minHeight: "80px" }}
              data-testid="message-input"
            />
            {busy && abortControllerRef.current ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="absolute top-3 right-3 bottom-3 w-12 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors focus:outline-none flex items-center justify-center"
                data-testid="stop-button"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={sendMessage}
                disabled={busy || !msg.trim()}
                className="absolute top-3 right-3 bottom-3 w-12 text-lg font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 focus:outline-none flex items-center justify-center"
                data-testid="send-button"
              >
                {busy ? "•••" : "→"}
              </button>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Dev Terminal - only show in development mode */}
      {showTerminal && <DevTerminal />}
    </div>
  )
}

export default function ChatPage() {
  return (
    <DevModeProvider>
      <DevTerminalProvider>
        <ChatPageContent />
      </DevTerminalProvider>
    </DevModeProvider>
  )
}
