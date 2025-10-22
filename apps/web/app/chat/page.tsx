'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { StreamEvent, UIMessage, parseStreamEvent } from '@/lib/message-parser'
import { renderMessage } from '@/lib/message-renderer'

export default function ChatPage() {
  const [msg, setMsg] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const isTerminal = typeof window !== 'undefined' && window.location.hostname.startsWith('terminal.')

  useEffect(() => {
    if (isTerminal) {
      const savedWorkspace = sessionStorage.getItem('workspace')
      if (savedWorkspace) {
        setWorkspace(savedWorkspace)
      } else {
        router.push('/workspace')
        return
      }
    }
  }, [isTerminal, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!msg.trim() || busy) return

    setBusy(true)

    // Add user message
    const userMessage: UIMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: msg,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setMsg('')

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
        ? { message: userMessage.content, workspace }
        : { message: userMessage.content }

      const response = await fetch('/api/claude/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let streamContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData: StreamEvent = JSON.parse(line.slice(6))
              const message = parseStreamEvent(eventData)

              if (message) {
                setMessages(prev => [...prev, message])
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'sdk_message',
        content: { type: 'result', is_error: true, result: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      }])
    }
  }

  async function sendRegular(userMessage: UIMessage) {
    try {
      const requestBody = isTerminal
        ? { message: userMessage.content, workspace }
        : { message: userMessage.content }

      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await r.json()

      // Add assistant message
      const assistantMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        type: 'sdk_message',
        content: response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

    } catch (error) {
      const errorMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        type: 'sdk_message',
        content: { type: 'result', is_error: true, result: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  function changeWorkspace() {
    if (isTerminal) {
      router.push('/workspace')
    }
  }

  return (
    <div className="h-screen flex flex-col max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-bold">
          Claude{isTerminal && ' - Terminal'}
        </h1>
        {isTerminal && (
          <button
            onClick={changeWorkspace}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Change Workspace
          </button>
        )}
      </div>

      {isTerminal && workspace && (
        <div className="px-4 py-2 bg-gray-50 border-b text-sm">
          <span className="font-medium">Workspace:</span>
          <span className="font-mono ml-2">{workspace}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            {renderMessage(message)}
          </div>
        ))}
        {busy && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
              <div className="text-sm">Claude is thinking...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t">
        <div className="relative">
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(e)
              }
            }}
            placeholder="Message Claude... (Enter to send, Shift+Enter for new line)"
            className="w-full resize-none border-0 bg-transparent text-none"
            style={{ minHeight: '120px' }}
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !msg.trim()}
            className="absolute bottom-4 right-4 btn btn-primary"
          >
            {busy ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}