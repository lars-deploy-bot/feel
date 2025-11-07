"use client"
import { useEffect, useRef, useState } from "react"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { getPreviewUrl } from "@/lib/preview-utils"
import { useDebugActions, useSandboxMinimized } from "@/lib/stores/debug-store"
import { useSandbox } from "../lib/sandbox-context"

export function Sandbox() {
  const { entries, clearEntries } = useSandbox()
  const isMinimized = useSandboxMinimized()
  const { setSandboxMinimized } = useDebugActions()
  const { workspace } = useWorkspace()
  const [width, setWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"preview" | "console">("preview")
  const scrollRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(400)

  // Handle resize dragging with minimum drag distance to prevent accidental triggers
  useEffect(() => {
    if (!isResizing) return

    const MIN_DRAG_DISTANCE = 5 // Require 5px movement before resizing starts
    let hasStartedResizing = false

    const handleMouseMove = (e: MouseEvent) => {
      const dragDistance = Math.abs(e.clientX - startXRef.current)

      // Only start resizing after user has dragged at least MIN_DRAG_DISTANCE
      if (!hasStartedResizing && dragDistance < MIN_DRAG_DISTANCE) {
        return
      }
      hasStartedResizing = true

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

  // Get color class for entry type
  const getTypeColor = (type: string): string => {
    switch (type) {
      case "error":
        return "text-red-400"
      case "success":
        return "text-green-400"
      case "info":
        return "text-blue-400"
      default:
        return "text-purple-400"
    }
  }

  return (
    <div
      className={`relative bg-black text-purple-400 font-mono text-xs flex flex-col border-l border-purple-700/30 ${
        isMinimized ? "w-12" : "h-full"
      } ${isResizing ? "select-none" : ""}`}
      style={!isMinimized ? { width: `${width}px` } : undefined}
    >
      {/* Resize handle */}
      {!isMinimized && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sandbox"
          aria-valuenow={width}
          tabIndex={0}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-purple-500/50 transition-colors z-10"
          onMouseDown={e => {
            startXRef.current = e.clientX
            startWidthRef.current = width
            setIsResizing(true)
          }}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-purple-700/30 bg-black/90">
        {isMinimized ? (
          <button
            type="button"
            onClick={() => setSandboxMinimized(false)}
            className="text-purple-500 font-semibold hover:text-purple-400 transition-colors w-full text-center"
          >
            +
          </button>
        ) : (
          <>
            <span className="text-purple-500 font-semibold">{workspace || "Sandbox"}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`text-xs px-2 py-1 border border-purple-700/30 rounded transition-colors ${
                  activeTab === "preview" ? "bg-purple-700/30 text-purple-400" : "text-purple-600 hover:text-purple-400"
                }`}
              >
                preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("console")}
                className={`text-xs px-2 py-1 border border-purple-700/30 rounded transition-colors ${
                  activeTab === "console" ? "bg-purple-700/30 text-purple-400" : "text-purple-600 hover:text-purple-400"
                }`}
              >
                console
              </button>
              <button
                type="button"
                onClick={clearEntries}
                className="text-purple-600 hover:text-purple-400 transition-colors text-xs px-2 py-1 border border-purple-700/30 rounded"
              >
                clear
              </button>
              <button
                type="button"
                onClick={() => setSandboxMinimized(true)}
                className="text-purple-600 hover:text-purple-400 transition-colors text-xs px-2 py-1 border border-purple-700/30 rounded"
              >
                −
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {!isMinimized &&
        (activeTab === "preview" ? (
          <div className="flex-1 overflow-hidden bg-white relative">
            {workspace && workspace.length > 0 && workspace.includes(".") ? (
              <iframe
                ref={iframeRef}
                src={getPreviewUrl(workspace)}
                className="w-full h-full border-0"
                title={`Preview: ${workspace}`}
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-purple-700 bg-black">
                <div className="text-center">
                  <div className="mb-2">{workspace ? "Invalid workspace format" : "No workspace selected"}</div>
                  <div className="text-xs text-purple-600">Workspace must be a domain (e.g., example.com)</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {entries.length === 0 ? (
              <div className="text-purple-700">No console entries yet...</div>
            ) : (
              entries.map((entry, index) => {
                const isCopied = copiedIndex === index
                const displayContent = entry.data
                  ? `${entry.message}\n${JSON.stringify(entry.data, null, 2)}`
                  : entry.message

                return (
                  <div key={entry.id} className="space-y-1 pb-3 border-b border-purple-900/30">
                    {/* Header with timestamp, type, and controls */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-purple-700 text-[10px]">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`font-semibold ${getTypeColor(entry.type)}`}>{entry.type}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyMessage(displayContent, index)}
                        className="text-purple-600 hover:text-purple-400 transition-colors text-[10px] px-1.5 py-0.5 border border-purple-700/30 rounded"
                        title="Copy to clipboard"
                      >
                        {isCopied ? "✓" : "copy"}
                      </button>
                    </div>

                    {/* Message content */}
                    <div className="text-purple-300 whitespace-pre-wrap break-words text-[11px] leading-relaxed pl-2">
                      {displayContent}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ))}
    </div>
  )
}
