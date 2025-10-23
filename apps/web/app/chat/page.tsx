"use client"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ThinkingGroup } from "@/components/ui/chat/ThinkingGroup"
import { groupMessages } from "@/lib/message-grouper"
import { parseStreamEvent, type StreamEvent, type UIMessage } from "@/lib/message-parser"
import { renderMessage } from "@/lib/message-renderer"

export default function ChatPage() {
  const [msg, setMsg] = useState("")
  const [workspace, setWorkspace] = useState("")
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const [isTerminal, setIsTerminal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
        router.push("/workspace")
        return
      }
    }
  }, [isTerminal, router])

  useEffect(() => {
    // Only auto-scroll if user is already near the bottom
    const messagesContainer = messagesEndRef.current?.parentElement
    if (messagesContainer) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }
    }
  })

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

    if (useStreaming) {
      await sendStreaming(userMessage)
    } else {
      await sendRegular(userMessage)
    }

    setBusy(false)
  }

  async function sendStreaming(userMessage: UIMessage) {
    try {
      const requestBody = isTerminal
        ? { message: userMessage.content, workspace, conversationId }
        : { message: userMessage.content, conversationId }

      const response = await fetch("/api/claude/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData: StreamEvent = JSON.parse(line.slice(6))
              const message = parseStreamEvent(eventData)

              if (message) {
                setMessages(prev => [...prev, message])
              }
            } catch (parseError) {
              console.warn("Failed to parse SSE data:", line)
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "sdk_message",
          content: {
            type: "result",
            is_error: true,
            result: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: new Date(),
        },
      ])
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {groupMessages(messages).map((group, index) => {
            if (group.type === "text") {
              return (
                <div key={`group-${index}`}>
                  {group.messages.map(message => (
                    <div key={message.id}>{renderMessage(message)}</div>
                  ))}
                </div>
              )
            } else {
              return <ThinkingGroup key={`group-${index}`} messages={group.messages} isComplete={group.isComplete} />
            }
          })}
          {busy && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && (
            <div className="py-2 mb-4 text-sm text-gray-600">
              <div className="normal-case tracking-normal">Thinking...</div>
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
              className="w-full resize-none border-0 bg-transparent text-base focus:outline-none p-3"
              style={{ minHeight: "60px" }}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !msg.trim()}
              className="absolute bottom-3 right-3 px-3 py-1 text-xs font-thin bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 focus:outline-none"
            >
              {busy ? "sending" : "send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
