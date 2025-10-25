"use client"
import { ThinkingGroup } from "@/components/ui/chat/ThinkingGroup"
import type { StructuredError } from "@/lib/error-codes"
import { groupMessages } from "@/lib/message-grouper"
import { type StreamEvent, type UIMessage, parseStreamEvent } from "@/lib/message-parser"
import { renderMessage } from "@/lib/message-renderer"
import { Square } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

export default function ChatPage() {
  const [msg, setMsg] = useState("")
  const [workspace, setWorkspace] = useState("")
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const [isTerminal, setIsTerminal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID())
  const [shouldForceScroll, setShouldForceScroll] = useState(false)
  const [userHasManuallyScrolled, setUserHasManuallyScrolled] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    setIsTerminal(window.location.hostname.startsWith("terminal."))
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
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        setShouldForceScroll(false)
        setUserHasManuallyScrolled(false)
        setTimeout(() => {
          isAutoScrolling.current = false
        }, 300)
      }
      // Auto-scroll if user hasn't manually scrolled
      else if (!userHasManuallyScrolled) {
        isAutoScrolling.current = true
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
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
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
          setTimeout(() => {
            isAutoScrolling.current = false
          }, 300)
        }
      }
    }
  }, [messages, shouldForceScroll, userHasManuallyScrolled])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!msg.trim() || busy) return

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
    }
  }

  async function sendStreaming(userMessage: UIMessage) {
    try {
      const requestBody = isTerminal
        ? { message: userMessage.content, workspace, conversationId }
        : { message: userMessage.content, conversationId }

      // Create AbortController for this request
      const abortController = new AbortController()
      abortControllerRef.current = abortController

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

        // If we got structured error data, stringify it for the error message
        if (errorData) {
          throw new Error(JSON.stringify(errorData))
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error("No response body received")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        let currentEvent = ""
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            // Only process events with bridge_ prefix
            if (currentEvent.startsWith("bridge_")) {
              try {
                const rawData = JSON.parse(line.slice(6))

                // Check if this is a Claude Bridge StreamEvent (has requestId and timestamp)
                if (rawData.requestId && rawData.timestamp && rawData.type) {
                  const eventData: StreamEvent = rawData

                  // Log non-ping events for debugging (with request ID for tracking)
                  if (eventData.type !== "ping") {
                    console.log(`[Client SSE ${eventData.requestId}] Event: ${eventData.type}`, eventData.data)
                  }

                  const message = parseStreamEvent(eventData)

                  if (message) {
                    setMessages(prev => [...prev, message])
                  }
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE data:", line)
              }
            }
            // Silently ignore all other events (raw Claude SDK events)
            currentEvent = "" // Reset after processing
          }
        }
      }
    } catch (error) {
      // Only show error if not aborted by user
      if (error instanceof Error && error.name !== "AbortError") {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "sdk_message",
            content: {
              type: "result",
              is_error: true,
              result: error.message,
            },
            timestamp: new Date(),
          },
        ])
      }
    } finally {
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

  function changeWorkspace() {
    if (isTerminal) {
      router.push("/workspace")
    }
  }

  function startNewConversation() {
    setConversationId(crypto.randomUUID())
    setMessages([])
  }

  function stopStreaming() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col max-w-4xl mx-auto overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-black/10">
          <h1 className="text-lg font-thin text-black">{mounted && isTerminal ? "terminal" : "•"}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={startNewConversation}
              className="inline-flex items-center justify-center px-3 py-2 text-xs font-thin text-black border border-black/20 hover:bg-black hover:text-white transition-colors"
              type="button"
            >
              new chat
            </button>
            {mounted && isTerminal && (
              <button
                onClick={changeWorkspace}
                className="inline-flex items-center justify-center px-3 py-2 text-xs font-thin text-black border border-black/20 hover:bg-black hover:text-white transition-colors"
                type="button"
              >
                change
              </button>
            )}
          </div>
        </div>

        {mounted && isTerminal && workspace && (
          <div className="flex-shrink-0 px-6 py-3 border-b border-black/5 bg-black/[0.02]">
            <div className="flex items-center text-xs">
              <span className="text-black/40 font-thin">workspace</span>
              <span className="ml-3 font-diatype-mono text-black/80 font-thin">{workspace}</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
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
            <div className="mb-1">
              <div className="text-[10px] font-thin text-black/30 animate-pulse">thinking</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="flex-shrink-0 p-4 safe-area-inset-bottom">
          <div className="relative border border-black/20 focus-within:border-black/40 transition-colors">
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(e)
                }
              }}
              placeholder="Message"
              className="w-full resize-none border-0 bg-transparent text-base focus:outline-none p-3 pr-20"
              style={{ minHeight: "80px" }}
            />
            {busy && abortControllerRef.current ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="absolute top-3 right-3 bottom-3 w-12 text-xs font-thin bg-black text-white hover:bg-gray-800 transition-colors focus:outline-none flex items-center justify-center"
              >
                <Square size={12} fill="white" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy || !msg.trim()}
                className="absolute top-3 right-3 bottom-3 w-12 text-xs font-thin bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 focus:outline-none flex items-center justify-center"
              >
                {busy ? "•••" : "→"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
