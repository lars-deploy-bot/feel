"use client"
import { SUPERADMIN_WORKSPACE_NAME } from "@webalive/shared/constants"
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCw,
  Smartphone,
  X,
} from "lucide-react"
import {
  Browser,
  CaretDown,
  FolderSimple,
  GearSix,
  ImageSquare,
  Lightning,
  Robot,
  Terminal,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
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
// Exhaustive: every WorkbenchView MUST have an entry. Adding a new view to the
// union without registering it here is a compiler error.
// "simple" views only need WorkbenchViewProps — the component type is enforced.
// "custom" views have extra props and are rendered explicitly in the dispatcher.
type ViewRegistration =
  | { kind: "simple"; component: ComponentType<WorkbenchViewProps> }
  | { kind: "custom" }

const VIEW_REGISTRY: Record<WorkbenchView, ViewRegistration> = {
  home: { kind: "custom" },
  site: { kind: "custom" },
  code: { kind: "custom" },
  terminal: { kind: "simple", component: WorkbenchTerminal },
  drive: { kind: "simple", component: DrivePanel },
  agents: { kind: "simple", component: WorkbenchAgents },
  photos: { kind: "simple", component: WorkbenchPhotos },
  events: { kind: "simple", component: WorkbenchEvents },
}

type ViewOption = { view: WorkbenchView; label: string; icon: PhosphorIcon; activeClass: string }

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

  const viewOptions: ViewOption[] = [
    ...(isSuperadminWorkspace ? [] : [{ view: "site" as const, label: "Preview", icon: Browser, activeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400" }]),
    { view: "code", label: "Files", icon: FolderSimple, activeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { view: "agents", label: "Agents", icon: Robot, activeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { view: "photos", label: "Photos", icon: ImageSquare, activeClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
    { view: "home", label: "Settings", icon: GearSix, activeClass: "bg-black/[0.07] dark:bg-white/[0.1] text-black dark:text-white" },
  ]

  const superadminViews: ViewOption[] = [
    { view: "events", label: "Activity", icon: Lightning, activeClass: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
    { view: "terminal", label: "Console", icon: Terminal, activeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  ]
  const isSuperadminViewActive = superadminViews.some(v => v.view === workbench.view)

  return (
    <div data-panel-role="workbench" className="relative bg-white dark:bg-[#0d0d0d] flex flex-col h-full w-full">
      {/* View switcher */}
      <div data-panel-role="workbench-view-switcher" className="h-11 px-2.5 flex items-center gap-1.5 shrink-0">
        {viewOptions.map(({ view, label, icon: Icon, activeClass }) => {
          const active = workbench.view === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => handleSelectView(view)}
              className={`flex items-center gap-2 h-8 px-3.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
                active
                  ? activeClass
                  : "text-black/30 dark:text-white/25 hover:text-black/50 dark:hover:text-white/40"
              }`}
            >
              <Icon size={16} weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </button>
          )
        })}
        {isSuperadmin && (
          <SuperadminMenu
            views={superadminViews}
            currentView={workbench.view}
            isActive={isSuperadminViewActive}
            onSelect={handleSelectView}
          />
        )}
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
// Routes to the correct view component. Simple views go through the exhaustive
// VIEW_REGISTRY (enforces WorkbenchViewProps). Custom views with extra props
// are handled explicitly in the switch.

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
  // Simple views — dispatched from the exhaustive registry
  const registration = VIEW_REGISTRY[view]
  if (registration.kind === "simple") {
    const Component = registration.component
    return <Component workspace={workspace} worktree={worktree} />
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

// ── Superadmin Menu ──────────────────────────────────────────────────────────

function SuperadminMenu({
  views,
  currentView,
  isActive,
  onSelect,
}: {
  views: ViewOption[]
  currentView: WorkbenchView
  isActive: boolean
  onSelect: (view: WorkbenchView) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const activeView = views.find(v => v.view === currentView)
  const ActiveIcon = activeView?.icon ?? Terminal

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-all duration-200 ${
          isActive && activeView
            ? activeView.activeClass
            : "text-black/30 dark:text-white/25 hover:text-black/50 dark:hover:text-white/40"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <ActiveIcon size={16} weight={isActive ? "fill" : "regular"} />
        {isActive && <span>{activeView?.label}</span>}
        <CaretDown size={12} weight="bold" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-1.5 w-44 bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.06] rounded-2xl shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.04] z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="p-1.5 space-y-0.5">
            {views.map(({ view, label, icon: Icon, activeClass }) => {
              const active = currentView === view
              return (
                <button
                  key={view}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(view)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center gap-2.5 ${
                    active
                      ? activeClass
                      : "text-black/50 dark:text-white/40 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-black/70 dark:hover:text-white/60"
                  }`}
                >
                  <Icon size={16} weight={active ? "fill" : "regular"} className="shrink-0" />
                  <span className="text-[13px] font-medium">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
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
