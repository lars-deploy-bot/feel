"use client"
import { SUPERADMIN } from "@webalive/shared"
import { Activity, Code, ExternalLink, Globe, RotateCw, Terminal, X } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import { useWorkbenchContext, type WorkbenchView } from "@/features/chat/lib/workbench-context"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useResizablePanel } from "@/lib/hooks/useResizablePanel"
import { trackWorkbenchViewChanged } from "@/lib/analytics/events"
import { getSiteUrl } from "@/lib/preview-utils"
import { useDebugActions, useWorkbenchWidth } from "@/lib/stores/debug-store"
// import { useFeatureFlag } from "@/lib/stores/featureFlagStore" -- will be needed when final home style is chosen
import { DrivePanel } from "./drive/DrivePanel"
import { usePreviewEngine } from "./hooks/usePreviewEngine"
import { PulsingDot } from "../ui/PulsingDot"
import { WorkbenchCodeView } from "./WorkbenchCodeView"
import { WorkbenchEvents } from "./WorkbenchEvents"
import { WorkbenchHome } from "./WorkbenchHome"
import { WorkbenchTerminal } from "./WorkbenchTerminal"

export function Workbench() {
  const { workspace, worktree } = useWorkspace({ allowEmpty: true })
  const isSuperadminWorkspace = workspace === SUPERADMIN.WORKSPACE_NAME
  const { workbench, setView, openFile, closeFile, toggleFolder, setTreeWidth, toggleTreeCollapsed } =
    useWorkbenchContext()
  const savedWidth = useWorkbenchWidth()
  const { setWorkbench, setWorkbenchWidth } = useDebugActions()
  const { width, setWidth, isResizing, handleMouseDown } = useResizablePanel({
    defaultWidth: savedWidth ?? 600,
    maxWidthPercent: 0.6,
  })
  const inputRef = useRef<HTMLInputElement>(null)
  // const driveEnabled = useFeatureFlag("DRIVE") -- will be needed when final home style is chosen

  const handleNavigate = useCallback((newPath: string) => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = newPath
    }
  }, [])

  // Only fetch preview token when not on home view
  const isPreviewActive = workbench.view !== "home"
  const { setIframeRef, path, isLoading, previewToken, previewUrl, refresh, navigateTo } = usePreviewEngine({
    workspace,
    skipTokenFetch: isSuperadminWorkspace || !isPreviewActive,
    onNavigate: handleNavigate,
  })

  useEffect(() => {
    if (savedWidth === null) {
      const halfViewport = Math.floor(window.innerWidth / 2)
      setWidth(halfViewport)
      setWorkbenchWidth(halfViewport)
    }
  }, [savedWidth, setWidth, setWorkbenchWidth])

  useEffect(() => {
    if (!isResizing && width !== savedWidth) {
      setWorkbenchWidth(width)
    }
  }, [isResizing, width, savedWidth, setWorkbenchWidth])

  const handlePathSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputRef.current) {
      const inputValue = inputRef.current.value.trim()

      const lowerInput = inputValue.toLowerCase()
      if (lowerInput.startsWith("http://") || lowerInput.startsWith("https://")) {
        window.open(inputValue, "_blank", "noopener,noreferrer")
        inputRef.current.value = path
        return
      }

      let newPath = inputValue
      if (!newPath.startsWith("/")) newPath = `/${newPath}`
      inputRef.current.value = newPath
      navigateTo(newPath)
    }
  }

  const handleSelectView = (view: WorkbenchView) => {
    trackWorkbenchViewChanged(view)
    setView(view)
  }

  const isHome = workbench.view === "home"

  return (
    <div
      className={`relative bg-white dark:bg-[#0d0d0d] flex flex-col border-l border-black/[0.08] dark:border-white/[0.04] h-full ${isResizing ? "select-none" : ""}`}
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
            isResizing
              ? "bg-neutral-400 dark:bg-neutral-500 h-12"
              : "bg-neutral-300 dark:bg-neutral-800 group-hover:bg-neutral-400 dark:group-hover:bg-neutral-600 group-hover:h-12"
          }`}
        />
      </div>

      {/* Overlay during resize */}
      {isResizing && <div className="absolute inset-0 z-50 cursor-col-resize" />}

      {/* View switcher — visible when not on home */}
      {!isHome && (
        <div className="h-9 px-2.5 flex items-center gap-1 shrink-0">
          {[
            { view: "site" as WorkbenchView, label: "Preview", icon: Globe },
            { view: "code" as WorkbenchView, label: "Code", icon: Code },
            { view: "terminal" as WorkbenchView, label: "Terminal", icon: Terminal },
            ...(isSuperadminWorkspace ? [{ view: "events" as WorkbenchView, label: "Events", icon: Activity }] : []),
          ].map(({ view, label, icon: Icon }) => {
            const active = workbench.view === view
            return (
              <button
                key={view}
                type="button"
                onClick={() => handleSelectView(view)}
                className={`flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
                  active
                    ? "bg-black/[0.07] dark:bg-white/[0.1] text-black dark:text-white"
                    : "text-black/30 dark:text-white/25 hover:text-black/50 dark:hover:text-white/40"
                }`}
              >
                <Icon size={12} strokeWidth={1.5} />
                <span>{label}</span>
              </button>
            )
          })}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setWorkbench(false)}
            className="xl:hidden p-1 text-black/25 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40 rounded-full transition-colors"
            title="Close"
          >
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Context bar — view-specific controls */}
      {!isHome && workbench.view === "site" && (
        <div className="h-8 px-2.5 flex items-center border-b border-black/[0.06] dark:border-white/[0.04] shrink-0">
          <div className="flex-1 h-6 flex items-center gap-1.5 bg-black/[0.03] dark:bg-white/[0.03] rounded px-2 min-w-0">
            <button
              type="button"
              onClick={refresh}
              className="p-0.5 text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors shrink-0"
              title="Refresh"
            >
              <RotateCw size={11} strokeWidth={1.5} />
            </button>
            <input
              ref={inputRef}
              type="text"
              defaultValue={path}
              onKeyDown={handlePathSubmit}
              className="flex-1 min-w-0 bg-transparent text-[12px] text-neutral-600 dark:text-neutral-400 outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
              placeholder="/"
            />
            <a
              href={workspace ? getSiteUrl(workspace, path) : "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="p-0.5 text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors shrink-0"
              title="Open in new tab"
            >
              <ExternalLink size={11} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {!workspace || (!workspace.includes(".") && !isSuperadminWorkspace) ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-neutral-400 dark:text-neutral-600 text-sm">
                {workspace ? "Invalid workspace" : "No site selected"}
              </p>
            </div>
          </div>
        ) : isHome ? (
          <WorkbenchHome onSelectView={handleSelectView} />
        ) : workbench.view === "site" ? (
          <div className="h-full bg-white relative">
            {(isLoading || !previewToken) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-[#0d0d0d]">
                <PulsingDot size="lg" />
              </div>
            )}
            {previewToken && (
              <iframe
                ref={setIframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                title={`Preview: ${workspace}`}
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>
        ) : workbench.view === "code" ? (
          <WorkbenchCodeView
            workspace={workspace}
            worktree={worktree}
            filePath={workbench.filePath}
            expandedFolders={workbench.expandedFolders}
            treeWidth={workbench.treeWidth}
            treeCollapsed={workbench.treeCollapsed}
            onSelectFile={openFile}
            onCloseFile={closeFile}
            onToggleFolder={toggleFolder}
            onSetTreeWidth={setTreeWidth}
            onToggleTreeCollapsed={toggleTreeCollapsed}
          />
        ) : workbench.view === "drive" ? (
          <DrivePanel workspace={workspace} worktree={worktree} />
        ) : workbench.view === "terminal" ? (
          <WorkbenchTerminal workspace={workspace} />
        ) : workbench.view === "events" ? (
          <WorkbenchEvents />
        ) : null}
      </div>
    </div>
  )
}
