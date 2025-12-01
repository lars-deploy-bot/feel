"use client"
import { ExternalLink, Loader2, RotateCw } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { PREVIEW_MESSAGES } from "@webalive/shared"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useResizablePanel } from "@/lib/hooks/useResizablePanel"
import { getPreviewUrl } from "@/lib/preview-utils"
import { useDebugActions, useSandboxWidth } from "@/lib/stores/debug-store"

export function Sandbox() {
  const { workspace } = useWorkspace({ allowEmpty: true })
  const savedWidth = useSandboxWidth()
  const { setSandboxWidth } = useDebugActions()
  const { width, setWidth, isResizing, handleMouseDown } = useResizablePanel({
    defaultWidth: savedWidth ?? 600,
    maxWidthPercent: 0.6, // Ensure chat area always has at least 40% of viewport
  })
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [path, setPath] = useState("/")
  const [isLoading, setIsLoading] = useState(true)

  const baseUrl = workspace ? getPreviewUrl(workspace).replace(/\/$/, "") : ""
  const fullUrl = `${baseUrl}${path}`

  // Set to half viewport on first open (when no saved preference)
  useEffect(() => {
    if (savedWidth === null) {
      const halfViewport = Math.floor(window.innerWidth / 2)
      setWidth(halfViewport)
      setSandboxWidth(halfViewport)
    }
  }, [savedWidth, setWidth, setSandboxWidth])

  // Save width to store when user stops resizing
  useEffect(() => {
    if (!isResizing && width !== savedWidth) {
      setSandboxWidth(width)
    }
  }, [isResizing, width, savedWidth, setSandboxWidth])

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true)
      iframeRef.current.src = fullUrl
    }
  }

  const handleIframeLoad = () => {
    setIsLoading(false)
  }

  // Reset loading state when path changes
  useEffect(() => {
    setIsLoading(true)
  }, [path])

  const handlePathSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputRef.current) {
      let newPath = inputRef.current.value.trim()
      if (!newPath.startsWith("/")) newPath = `/${newPath}`
      setPath(newPath)
      inputRef.current.value = newPath
      // Directly set iframe src to force navigation
      if (iframeRef.current) {
        setIsLoading(true)
        iframeRef.current.src = `${baseUrl}${newPath}`
      }
    }
  }

  // Listen for postMessage from iframe (preview sites send navigation events)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Navigation started - show loading
      if (event.data?.type === PREVIEW_MESSAGES.NAVIGATION_START) {
        setIsLoading(true)
        return
      }
      // Navigation completed - update path and input (only if input not focused)
      if (event.data?.type === PREVIEW_MESSAGES.NAVIGATION && typeof event.data.path === "string") {
        const newPath = event.data.path || "/"
        setPath(newPath)
        // Only update input if it's not focused (user not typing)
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.value = newPath
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  return (
    <div
      className={`relative bg-black text-purple-400 font-mono text-xs flex flex-col border-l border-purple-700/30 h-full ${isResizing ? "select-none" : ""}`}
      style={{ width: `${width}px` }}
    >
      {/* Resize handle - wide hit area with visible grabber */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sandbox"
        aria-valuenow={width}
        tabIndex={0}
        className="absolute left-0 top-0 bottom-0 w-4 -ml-2 cursor-col-resize z-10 group flex items-center justify-center"
        onMouseDown={handleMouseDown}
        style={{ userSelect: "none" }}
      >
        {/* Grabber pill */}
        <div
          className={`w-1.5 h-12 rounded-full transition-all ${
            isResizing ? "bg-purple-500" : "bg-purple-700/30 group-hover:bg-purple-500/80 group-hover:h-16"
          }`}
        />
      </div>
      {/* Overlay to block iframe from capturing mouse during resize */}
      {isResizing && (
        <div
          className="absolute inset-0 z-50"
          style={{
            cursor: "col-resize",
            pointerEvents: "all",
          }}
        />
      )}

      {/* URL bar */}
      <div className="flex items-center gap-3 px-3 py-2 bg-neutral-950">
        <div className="flex-1 flex items-center gap-2 bg-neutral-800/50 rounded-lg px-3 py-1.5 ring-1 ring-white/[0.06] focus-within:ring-white/[0.12] transition-all">
          <button
            type="button"
            onClick={handleRefresh}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Refresh"
          >
            <RotateCw size={12} strokeWidth={2} />
          </button>
          <input
            ref={inputRef}
            type="text"
            defaultValue={path}
            onKeyDown={handlePathSubmit}
            className="flex-1 bg-transparent text-[13px] text-neutral-300 outline-none placeholder:text-neutral-600"
            placeholder="/"
          />
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={12} strokeWidth={2} />
          </a>
        </div>
      </div>

      {/* Content - iframe */}
      <div className="flex-1 overflow-hidden bg-white relative">
        {workspace && workspace.length > 0 && workspace.includes(".") ? (
          <>
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin text-purple-400" />
                  <span className="text-sm text-neutral-400">Loading preview...</span>
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={fullUrl}
              className="w-full h-full border-0"
              title={`Preview: ${workspace}`}
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={handleIframeLoad}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-700 bg-neutral-900">
            <div className="text-center">
              <div className="mb-2">{workspace ? "Invalid workspace format" : "No workspace selected"}</div>
              <div className="text-xs text-neutral-600">Workspace must be a domain (e.g., example.com)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
