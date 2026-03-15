"use client"
import { SUPERADMIN_WORKSPACE_NAME } from "@webalive/shared/constants"
import {
  Activity,
  Bot,
  ExternalLink,
  FolderOpen,
  Globe,
  Image,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCw,
  Settings,
  Smartphone,
  SquareTerminal,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ComponentType } from "react"
import { type WorkbenchView, type WorkbenchViewProps, useWorkbenchContext } from "@/features/chat/lib/workbench-context"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useSuperadmin } from "@/hooks/use-superadmin"
import { trackWorkbenchViewChanged } from "@/lib/analytics/events"
import { getSiteUrl } from "@/lib/preview-utils"
import { useDebugActions, useWorkbenchFullscreen } from "@/lib/stores/debug-store"
import { PulsingDot } from "../ui/PulsingDot"
// import { useFeatureFlag } from "@/lib/stores/featureFlagStore" -- will be needed when final home style is chosen
import { DrivePanel } from "./drive/DrivePanel"
import { usePreviewEngine } from "./hooks/usePreviewEngine"
import { WorkbenchAgents } from "./WorkbenchAgents"
import { WorkbenchCodeView } from "./WorkbenchCodeView"
import { WorkbenchEvents } from "./WorkbenchEvents"
import { WorkbenchHome } from "./WorkbenchHome"
import { WorkbenchPhotos } from "./WorkbenchPhotos"
import { WorkbenchTerminal } from "./WorkbenchTerminal"

// ── View Registry ─────────────────────────────────────────────────────────────
// Type-safe: every entry MUST accept WorkbenchViewProps. The compiler rejects
// any component whose props don't include { workspace, worktree? }.
// "Simple" views only need WorkbenchViewProps. Views with extra props (code, home, site)
// are rendered explicitly below.
const SIMPLE_VIEWS: Partial<Record<WorkbenchView, ComponentType<WorkbenchViewProps>>> = {
  terminal: WorkbenchTerminal,
  agents: WorkbenchAgents,
  photos: WorkbenchPhotos,
  events: WorkbenchEvents,
  drive: DrivePanel,
}

export function Workbench() {
  const { workspace, worktree } = useWorkspace({ allowEmpty: true })
  const isSuperadminWorkspace = workspace === SUPERADMIN_WORKSPACE_NAME
  const isSuperadmin = useSuperadmin()
  const { workbench, setView, openFile, closeFile, toggleFolder, setTreeWidth, toggleTreeCollapsed } =
    useWorkbenchContext()

  // Superadmin workspace has no site preview — default to code/files
  useEffect(() => {
    if (isSuperadminWorkspace && workbench.view === "site") {
      setView("code")
    }
  }, [isSuperadminWorkspace, workbench.view, setView])
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop")
  const isFullscreen = useWorkbenchFullscreen()
  const { setWorkbench, toggleWorkbenchFullscreen } = useDebugActions()
  const inputRef = useRef<HTMLInputElement>(null)
  // const driveEnabled = useFeatureFlag("DRIVE") -- will be needed when final home style is chosen

  const handleNavigate = useCallback((newPath: string) => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = newPath
    }
  }, [])

  // Only fetch preview token when not on home view
  const isPreviewActive = workbench.view !== "home"
  const { setIframeRef, path, isLoading, previewToken, refresh, navigateTo } = usePreviewEngine({
    workspace,
    skipTokenFetch: isSuperadminWorkspace || !isPreviewActive,
    onNavigate: handleNavigate,
  })

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

  type ViewOption = { view: WorkbenchView; label: string; icon: typeof Globe }
  const opt = (view: WorkbenchView, label: string, icon: typeof Globe): ViewOption => ({ view, label, icon })
  const viewOptions: ViewOption[] = [
    ...(isSuperadminWorkspace ? [] : [opt("site", "Preview", Globe)]),
    opt("code", "Files", FolderOpen),
    opt("terminal", "Console", SquareTerminal),
    opt("agents", "Agents", Bot),
    opt("photos", "Photos", Image),
    ...(isSuperadmin ? [opt("events", "Activity", Activity)] : []),
    opt("home", "Settings", Settings),
  ]

  return (
    <div data-panel-role="workbench" className="relative bg-white dark:bg-[#0d0d0d] flex flex-col h-full w-full">
      {/* View switcher */}
      <div data-panel-role="workbench-view-switcher" className="h-11 px-2.5 flex items-center gap-1.5 shrink-0">
        {viewOptions.map(({ view, label, icon: Icon }) => {
          const active = workbench.view === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => handleSelectView(view)}
              className={`flex items-center gap-2 h-8 px-3.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
                active
                  ? "bg-black/[0.07] dark:bg-white/[0.1] text-black dark:text-white"
                  : "text-black/30 dark:text-white/25 hover:text-black/50 dark:hover:text-white/40"
              }`}
            >
              <Icon size={15} strokeWidth={1.5} />
              <span>{label}</span>
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleWorkbenchFullscreen}
          className="p-1.5 text-black/25 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40 rounded-full transition-colors"
          data-panel-role="workbench-fullscreen-toggle"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={15} strokeWidth={1.5} /> : <Maximize2 size={15} strokeWidth={1.5} />}
        </button>
        <button
          type="button"
          onClick={() => setWorkbench(false)}
          className="xl:hidden p-1.5 text-black/25 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40 rounded-full transition-colors"
          data-panel-role="workbench-close"
          title="Close"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </div>

      {/* Context bar — view-specific controls */}
      {workbench.view === "site" && (
        <div className="h-10 px-2.5 flex items-center justify-center gap-2 border-b border-black/[0.06] dark:border-white/[0.04] shrink-0">
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={`p-1 rounded transition-colors ${
                previewDevice === "desktop"
                  ? "text-black/60 dark:text-white/60"
                  : "text-black/20 dark:text-white/15 hover:text-black/40 dark:hover:text-white/30"
              }`}
              title="Desktop"
            >
              <Monitor size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={`p-1 rounded transition-colors ${
                previewDevice === "mobile"
                  ? "text-black/60 dark:text-white/60"
                  : "text-black/20 dark:text-white/15 hover:text-black/40 dark:hover:text-white/30"
              }`}
              title="Mobile"
            >
              <Smartphone size={14} strokeWidth={1.5} />
            </button>
          </div>
          <div className="h-7 flex items-center gap-2 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg px-2.5 min-w-0 max-w-[320px] w-full">
            <button
              type="button"
              onClick={refresh}
              className="p-0.5 text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors shrink-0"
              title="Refresh"
            >
              <RotateCw size={13} strokeWidth={1.5} />
            </button>
            <input
              ref={inputRef}
              type="text"
              defaultValue={path}
              onKeyDown={handlePathSubmit}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-neutral-600 dark:text-neutral-400 outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
              placeholder="/"
            />
          </div>
          <a
            href={workspace ? getSiteUrl(workspace, path) : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors shrink-0"
            title="Open in new tab"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
          </a>
        </div>
      )}

      {/* Content */}
      <div data-panel-role="workbench-content" className="flex-1 overflow-hidden relative">
        {!workspace || (!workspace.includes(".") && !isSuperadminWorkspace) ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-neutral-400 dark:text-neutral-600 text-sm">
                {workspace ? "Invalid workspace" : "No site selected"}
              </p>
            </div>
          </div>
        ) : (
          <WorkbenchViewDispatcher
            view={workbench.view}
            workspace={workspace}
            worktree={worktree}
            previewDevice={previewDevice}
            isLoading={isLoading}
            previewToken={previewToken}
            setIframeRef={setIframeRef}
            workbench={workbench}
            openFile={openFile}
            closeFile={closeFile}
            toggleFolder={toggleFolder}
            setTreeWidth={setTreeWidth}
            toggleTreeCollapsed={toggleTreeCollapsed}
            onSelectView={handleSelectView}
          />
        )}
      </div>
    </div>
  )
}

// ── View Dispatcher ──────────────────────────────────────────────────────────
// Routes to the correct view component. Simple views go through the type-safe
// SIMPLE_VIEWS registry (enforces WorkbenchViewProps). Complex views with extra
// props are handled explicitly.

function WorkbenchViewDispatcher({
  view,
  workspace,
  worktree,
  previewDevice,
  isLoading,
  previewToken,
  setIframeRef,
  workbench,
  openFile,
  closeFile,
  toggleFolder,
  setTreeWidth,
  toggleTreeCollapsed,
  onSelectView,
}: WorkbenchViewProps & {
  view: WorkbenchView
  previewDevice: "desktop" | "mobile"
  isLoading: boolean
  previewToken: string | null
  setIframeRef: (el: HTMLIFrameElement | null) => void
  workbench: { filePath: string | null; expandedFolders: Set<string>; treeWidth: number; treeCollapsed: boolean }
  openFile: (path: string) => void
  closeFile: () => void
  toggleFolder: (path: string) => void
  setTreeWidth: (width: number) => void
  toggleTreeCollapsed: () => void
  onSelectView: (view: WorkbenchView) => void
}) {
  // Simple views — dispatched from the type-safe registry
  const SimpleView = SIMPLE_VIEWS[view]
  if (SimpleView) {
    return <SimpleView workspace={workspace} worktree={worktree} />
  }

  // Complex views — have extra props beyond WorkbenchViewProps
  switch (view) {
    case "home":
      return <WorkbenchHome workspace={workspace} worktree={worktree} onSelectView={onSelectView} />
    case "site":
      return (
        <PreviewViewport device={previewDevice} isLoading={isLoading || !previewToken}>
          {previewToken && (
            <iframe
              ref={setIframeRef}
              className="w-full h-full border-0"
              title={`Preview: ${workspace}`}
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
        </PreviewViewport>
      )
    case "code":
      return (
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
      )
    default:
      return null
  }
}

// ── Preview Viewport ──────────────────────────────────────────────────────────

const DEVICE_WIDTHS = {
  desktop: "100%",
  mobile: "375px",
} as const

function PreviewViewport({
  device,
  isLoading,
  children,
}: {
  device: "desktop" | "mobile"
  isLoading: boolean
  children: React.ReactNode
}) {
  const isMobile = device === "mobile"

  return (
    <div className="h-full bg-neutral-100 dark:bg-[#111] relative flex items-start justify-center">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-[#0d0d0d]">
          <PulsingDot size="lg" />
        </div>
      )}
      <div
        className={`h-full bg-white dark:bg-[#0d0d0d] transition-[width,box-shadow] duration-300 ease-out overflow-hidden ${
          isMobile ? "rounded-xl mt-3 mb-3 shadow-lg border border-black/[0.08] dark:border-white/[0.06]" : ""
        }`}
        style={{
          width: DEVICE_WIDTHS[device],
          maxHeight: isMobile ? "calc(100% - 24px)" : "100%",
        }}
      >
        {children}
      </div>
    </div>
  )
}
