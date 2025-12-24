"use client"
import { ExternalLink, RotateCw, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { PREVIEW_MESSAGES } from "@webalive/shared"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useSandboxContext } from "@/features/chat/lib/sandbox-context"
import { useResizablePanel } from "@/lib/hooks/useResizablePanel"
import { getPreviewUrl, getSiteUrl } from "@/lib/preview-utils"
import { useDebugActions, useSandboxWidth } from "@/lib/stores/debug-store"
import { SandboxModeMenu, SandboxCodePanel } from "./sandbox"

export function Sandbox() {
  const { workspace } = useWorkspace({ allowEmpty: true })
  const {
    setSelectedElement,
    selectorActive,
    preview,
    setPreviewMode,
    openFile,
    closeFile,
    toggleFolder,
    setTreeWidth,
    toggleTreeCollapsed,
  } = useSandboxContext()
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

  // Send activation/deactivation message to iframe when selectorActive changes
  const isFirstRender = useRef(true)
  useEffect(() => {
    // Skip first render - only send when user toggles the selector
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: selectorActive ? "alive-tagger-activate" : "alive-tagger-deactivate" },
        "*",
      )
    }
  }, [selectorActive])

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
      className={`relative bg-[#0d0d0d] flex flex-col border-l border-white/[0.04] h-full ${isResizing ? "select-none" : ""}`}
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuenow={width}
        tabIndex={0}
        className="absolute left-0 top-0 bottom-0 w-3 -ml-1.5 cursor-col-resize z-10 group flex items-center justify-center"
        onMouseDown={handleMouseDown}
        style={{ userSelect: "none" }}
      >
        <div
          className={`w-0.5 h-8 rounded-full transition-all duration-150 ${
            isResizing ? "bg-neutral-500 h-12" : "bg-neutral-800 group-hover:bg-neutral-600 group-hover:h-12"
          }`}
        />
      </div>

      {/* Overlay during resize */}
      {isResizing && <div className="absolute inset-0 z-50 cursor-col-resize" />}

      {/* Header bar */}
      <div className="h-11 px-2 flex items-center gap-1.5 border-b border-white/[0.04] bg-neutral-900/50 shrink-0">
        {/* URL/Path display */}
        <div className="flex-1 h-7 flex items-center gap-1.5 bg-white/[0.03] rounded px-2 min-w-0">
          {preview.mode === "site" && (
            <>
              <button
                type="button"
                onClick={handleRefresh}
                className="p-0.5 text-neutral-600 hover:text-neutral-300 transition-colors shrink-0"
                title="Refresh"
              >
                <RotateCw size={12} strokeWidth={1.5} />
              </button>
              <input
                ref={inputRef}
                type="text"
                defaultValue={path}
                onKeyDown={handlePathSubmit}
                className="flex-1 min-w-0 bg-transparent text-[13px] text-neutral-400 outline-none placeholder:text-neutral-700"
                placeholder="/"
              />
              <a
                href={workspace ? getSiteUrl(workspace, path) : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="p-0.5 text-neutral-600 hover:text-neutral-300 transition-colors shrink-0"
                title="Open in new tab"
              >
                <ExternalLink size={12} strokeWidth={1.5} />
              </a>
            </>
          )}
          {preview.mode === "code" && (
            <span className="text-[13px] text-neutral-500 truncate">
              {preview.filePath ? `/${preview.filePath}` : "Code"}
            </span>
          )}
        </div>

        {/* Mode switcher */}
        <SandboxModeMenu currentMode={preview.mode} onModeChange={setPreviewMode} />

        {/* Close - tablets only */}
        <button
          type="button"
          onClick={() => setSandbox(false)}
          className="xl:hidden p-1.5 text-neutral-600 hover:text-neutral-300 rounded transition-colors"
          title="Close"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {!workspace || !workspace.includes(".") ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-neutral-600 text-sm">{workspace ? "Invalid workspace" : "No site selected"}</p>
            </div>
          </div>
        ) : preview.mode === "site" ? (
          <div className="h-full bg-white relative">
            {/* Loading state */}
            {(isLoading || !previewToken) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0d0d0d]">
                <div className="w-5 h-5 border-2 border-neutral-800 border-t-neutral-500 rounded-full animate-spin" />
              </div>
            )}
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
          </div>
        ) : preview.mode === "code" ? (
          <SandboxCodePanel
            workspace={workspace}
            filePath={preview.filePath}
            expandedFolders={preview.expandedFolders}
            treeWidth={preview.treeWidth}
            treeCollapsed={preview.treeCollapsed}
            onSelectFile={openFile}
            onCloseFile={closeFile}
            onToggleFolder={toggleFolder}
            onSetTreeWidth={setTreeWidth}
            onToggleTreeCollapsed={toggleTreeCollapsed}
          />
        ) : null}
      </div>
    </div>
  )
}
