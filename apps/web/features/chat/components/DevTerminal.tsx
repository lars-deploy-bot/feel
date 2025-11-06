"use client"
import { useEffect, useRef, useState } from "react"
import { truncateDeep } from "@/lib/utils"
import { useDevTerminal } from "../lib/dev-terminal-context"

export function DevTerminal() {
  const { events, clearEvents } = useDevTerminal()
  const [isMinimized, setIsMinimized] = useState(false)
  const [width, setWidth] = useState(768) // 2x wider: 768px (was 384px/w-96)
  const [isResizing, setIsResizing] = useState(false)
  const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set())
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll disabled: allows users to read/debug events without being
  // interrupted by new events pushing them down. Users can manually scroll.
  // Previous behavior: auto-scrolled to bottom on every new event.
  // useEffect(() => {
  //   if (scrollRef.current && !isMinimized) {
  //     scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  //   }
  // }, [events, isMinimized])

  // Handle resize dragging
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      // Clamp between 200px and 80% of screen width
      const clampedWidth = Math.max(200, Math.min(newWidth, window.innerWidth * 0.8))
      setWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  // Toggle message collapse
  const toggleMessageCollapse = (index: number) => {
    setCollapsedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  // Copy message to clipboard
  const copyMessage = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  // Copy all messages as array
  const [copiedAll, setCopiedAll] = useState(false)
  const copyAllMessages = async () => {
    try {
      const allMessages = events
        .filter(devEvent => devEvent.eventName !== "ping")
        .map(devEvent => {
          try {
            // Try to return the parsed event object
            return devEvent.event
          } catch {
            // If parsing fails, return the raw SSE as a string
            return devEvent.rawSSE
          }
        })

      // Truncate all string values to 200 chars max to prevent clipboard overflow
      const truncatedMessages = truncateDeep(allMessages, 200)

      await navigator.clipboard.writeText(JSON.stringify(truncatedMessages, null, 2))
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch (err) {
      console.error("Failed to copy all messages:", err)
    }
  }

  // Get color class for event name
  const getEventColor = (eventName: string): string => {
    // Handle specific event types
    if (eventName === "outgoing_request") return "text-orange-400 font-semibold"
    if (eventName === "client_error") return "text-red-400 font-semibold"
    if (eventName === "bridge_error") return "text-red-400 font-semibold"
    if (eventName === "bridge_interrupt") return "text-yellow-400 font-semibold"
    if (eventName === "bridge_complete") return "text-green-400 font-semibold"
    if (eventName.startsWith("bridge_")) return "text-cyan-400 font-semibold"
    if (eventName === "done") return "text-yellow-500 font-semibold"

    // Default for unknown types: treat as error
    return "text-red-400 font-semibold"
  }

  return (
    <div
      className={`relative bg-black text-green-400 font-mono text-xs flex flex-col border-l border-green-700/30 ${
        isMinimized ? "w-12" : "h-full"
      } ${isResizing ? "select-none" : ""}`}
      style={!isMinimized ? { width: `${width}px` } : undefined}
    >
      {/* Resize handle */}
      {!isMinimized && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize terminal"
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-green-500/50 transition-colors z-10"
          onMouseDown={() => setIsResizing(true)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-green-700/30 bg-black/90">
        {isMinimized ? (
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="text-green-500 font-semibold hover:text-green-400 transition-colors w-full text-center"
          >
            +
          </button>
        ) : (
          <>
            <span className="text-green-500 font-semibold">SSE Events (Dev)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyAllMessages}
                className="text-green-600 hover:text-green-400 transition-colors text-xs px-2 py-1 border border-green-700/30 rounded"
                title="Copy all messages as JSON array"
              >
                {copiedAll ? "✓ copied all" : "copy all"}
              </button>
              <button
                type="button"
                onClick={clearEvents}
                className="text-green-600 hover:text-green-400 transition-colors text-xs px-2 py-1 border border-green-700/30 rounded"
              >
                clear
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="text-green-600 hover:text-green-400 transition-colors text-xs px-2 py-1 border border-green-700/30 rounded"
              >
                −
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {!isMinimized && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {events.length === 0 ? (
            <div className="text-green-700">No events yet...</div>
          ) : (
            events
              .filter(devEvent => devEvent.eventName !== "ping")
              .map((devEvent, index) => {
                // Try to beautify the parsed data
                let displayContent: string
                try {
                  displayContent = JSON.stringify(devEvent.event, null, 2)
                } catch {
                  // Parsing failed, fall back to raw SSE
                  displayContent = devEvent.rawSSE
                }

                const isCollapsed = collapsedMessages.has(index)
                const isCopied = copiedIndex === index

                return (
                  <div
                    key={`${devEvent.event.requestId}-${index}`}
                    className="space-y-1 pb-3 border-b border-green-900/30"
                  >
                    {/* Header with timestamp, event type, and controls */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleMessageCollapse(index)}
                        className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
                      >
                        <span className="text-green-700">
                          [{new Date(devEvent.event.timestamp).toLocaleTimeString()}]
                        </span>
                        <span className={getEventColor(devEvent.eventName)}>{devEvent.eventName}</span>
                        <span className="text-green-700 text-[10px]">{isCollapsed ? "▶" : "▼"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => copyMessage(displayContent, index)}
                        className="text-green-600 hover:text-green-400 transition-colors text-[10px] px-2 py-0.5"
                        title="Copy to clipboard"
                      >
                        {isCopied ? "✓ copied" : "copy"}
                      </button>
                    </div>

                    {/* Beautified JSON or raw SSE fallback */}
                    {!isCollapsed && (
                      <pre className="text-green-500 whitespace-pre-wrap break-all leading-relaxed text-[10px]">
                        {displayContent}
                      </pre>
                    )}
                  </div>
                )
              })
          )}
        </div>
      )}

      {/* Footer stats */}
      {!isMinimized && (
        <div className="px-3 py-2 border-t border-green-700/30 bg-black/90 text-green-700 text-[10px]">
          {(() => {
            const visibleCount = events.filter(e => e.eventName !== "ping").length
            return `${visibleCount} event${visibleCount !== 1 ? "s" : ""} • ${visibleCount > 0 ? "live data" : "waiting..."}`
          })()}
        </div>
      )}
    </div>
  )
}
