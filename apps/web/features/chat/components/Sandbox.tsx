"use client"
import { ExternalLink, RotateCw, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { PREVIEW_MESSAGES } from "@webalive/shared"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useSandboxContext } from "@/features/chat/lib/sandbox-context"
import { useResizablePanel } from "@/lib/hooks/useResizablePanel"
import { getPreviewUrl, getSiteUrl } from "@/lib/preview-utils"
import { useDebugActions, useSandboxWidth } from "@/lib/stores/debug-store"

export function Sandbox() {
  const { workspace } = useWorkspace({ allowEmpty: true })
  const { setSelectedElement } = useSandboxContext()
  const savedWidth = useSandboxWidth()
  const { setSandbox, setSandboxWidth } = useDebugActions()
  const { width, setWidth, isResizing, handleMouseDown } = useResizablePanel({
    defaultWidth: savedWidth ?? 600,
    maxWidthPercent: 0.6, // Ensure chat area always has at least 40% of viewport
  })
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [path, setPath] = useState("/")
  const [isLoading, setIsLoading] = useState(true)
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const tokenFetchRef = useRef<AbortController | null>(null)

  // Preview URL with token for iframe (bypasses third-party cookie blocking)
  const previewUrl = workspace ? getPreviewUrl(workspace, { path, token: previewToken ?? undefined }) : ""

  // Fetch preview token for iframe authentication
  const fetchPreviewToken = useCallback(async () => {
    // Cancel any in-flight request
    tokenFetchRef.current?.abort()
    tokenFetchRef.current = new AbortController()

    try {
      const response = await fetch("/api/auth/preview-token", {
        method: "POST",
        signal: tokenFetchRef.current.signal,
      })
      if (response.ok) {
        const data = await response.json()
        setPreviewToken(data.token)
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("[Sandbox] Failed to fetch preview token:", error)
      }
    }
  }, [])

  // Fetch token on mount and when workspace changes
  useEffect(() => {
    if (workspace) {
      fetchPreviewToken()
    }
    return () => tokenFetchRef.current?.abort()
  }, [workspace, fetchPreviewToken])

  // Refresh token every 4 minutes (tokens expire in 5 minutes)
  useEffect(() => {
    if (!workspace) return
    const interval = setInterval(fetchPreviewToken, 4 * 60 * 1000)
    return () => clearInterval(interval)
  }, [workspace, fetchPreviewToken])

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
      iframeRef.current.src = previewUrl
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
      const inputValue = inputRef.current.value.trim()

      // Check if it's an external URL - open in new tab instead of preview
      const lowerInput = inputValue.toLowerCase()
      if (lowerInput.startsWith("http://") || lowerInput.startsWith("https://")) {
        window.open(inputValue, "_blank", "noopener,noreferrer")
        // Reset input to current path
        inputRef.current.value = path
        return
      }

      let newPath = inputValue
      if (!newPath.startsWith("/")) newPath = `/${newPath}`
      setPath(newPath)
      inputRef.current.value = newPath
      // Directly set iframe src to force navigation (include preview_token for auth)
      if (iframeRef.current && workspace) {
        setIsLoading(true)
        iframeRef.current.src = getPreviewUrl(workspace, { path: newPath, token: previewToken ?? undefined })
      }
    }
  }

  // Listen for postMessage from iframe (preview sites send navigation events + element selection)
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
        return
      }
      // Element selected via alive-tagger (Cmd+Click in dev mode)
      if (event.data?.type === "alive-element-selected" && event.data.context) {
        const ctx = event.data.context
        console.log("[Sandbox] Element selected:", ctx.displayName, "at", `${ctx.fileName}:${ctx.lineNumber}`, ctx)
        setSelectedElement({
          displayName: ctx.displayName,
          fileName: ctx.fileName,
          lineNumber: ctx.lineNumber,
          columnNumber: ctx.columnNumber,
        })
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [setSelectedElement])

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
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-950">
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
            href={workspace ? getSiteUrl(workspace, path) : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={12} strokeWidth={2} />
          </a>
        </div>
        {/* Close button - visible on tablets where sandbox takes full width */}
        <button
          type="button"
          onClick={() => setSandbox(false)}
          className="xl:hidden p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded transition-colors"
          title="Close preview"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Content - iframe */}
      <div className="flex-1 overflow-hidden bg-white relative">
        {workspace && workspace.length > 0 && workspace.includes(".") ? (
          <>
            {/* Loading overlay - show while fetching token or loading iframe */}
            {(isLoading || !previewToken) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-900">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 alive-logo-outer" />
                    <div className="absolute inset-1.5 rounded-full bg-emerald-400/30 alive-logo-inner" />
                    <div className="absolute inset-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-300">Opening your site</span>
                </div>
              </div>
            )}
            {/* Only render iframe after preview token is ready to avoid 401 race condition */}
            {previewToken && (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Preview: ${workspace}`}
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={handleIframeLoad}
              />
            )}
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
