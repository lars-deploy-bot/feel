"use client"
import {
  Browser,
  CaretDown,
  FolderSimple,
  Info,
  ImageSquare,
  Kanban,
  Lightning,
  type Icon as PhosphorIcon,
  Sparkle,
  Terminal,
} from "@phosphor-icons/react"
import { SUPERADMIN_WORKSPACE_NAME } from "@webalive/shared/constants"
import { Maximize2, Minimize2, X } from "lucide-react"
import type { ComponentType } from "react"
import { useEffect, useRef, useState } from "react"
import { useWorkbenchContext, type WorkbenchView, type WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useSuperadmin } from "@/hooks/use-superadmin"
import { trackWorkbenchViewChanged } from "@/lib/analytics/events"
import { useDebugActions, useWorkbenchFullscreen } from "@/lib/stores/debug-store"
import { DrivePanel } from "./drive/DrivePanel"
import { SitePreviewView } from "./SitePreviewView"
import { WorkbenchAgents } from "./WorkbenchAgents"
import { WorkbenchCodeView } from "./WorkbenchCodeView"
import { WorkbenchEvents } from "./WorkbenchEvents"
import { WorkbenchHome } from "./WorkbenchHome"
import { WorkbenchKanban } from "./WorkbenchKanban"
import { WorkbenchPhotos } from "./WorkbenchPhotos"
import { WorkbenchTerminal } from "./WorkbenchTerminal"

// ── View Registry ─────────────────────────────────────────────────────────────
// Exhaustive: every WorkbenchView MUST have an entry. Adding a new view to the
// union without registering it here is a compiler error.
// All views receive only WorkbenchViewProps — views pull additional state from
// context directly, keeping the dispatcher thin.

const VIEW_REGISTRY: Record<WorkbenchView, ComponentType<WorkbenchViewProps>> = {
  home: WorkbenchHome,
  site: SitePreviewView,
  code: WorkbenchCodeView,
  terminal: WorkbenchTerminal,
  drive: DrivePanel,
  agents: WorkbenchAgents,
  photos: WorkbenchPhotos,
  events: WorkbenchEvents,
  kanban: WorkbenchKanban,
}

type ViewOption = { view: WorkbenchView; label: string; icon: PhosphorIcon; activeClass: string; inactiveClass: string }

const STANDARD_VIEWS: ViewOption[] = [
  {
    view: "code",
    label: "Files",
    icon: FolderSimple,
    activeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    inactiveClass: "bg-emerald-500/[0.04] text-emerald-700/30 dark:bg-emerald-500/[0.04] dark:text-emerald-400/25 hover:bg-emerald-500/[0.07] hover:text-emerald-700/50 dark:hover:bg-emerald-500/[0.07] dark:hover:text-emerald-400/40",
  },
  {
    view: "agents",
    label: "Agents",
    icon: Sparkle,
    activeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    inactiveClass: "bg-violet-500/[0.04] text-violet-700/30 dark:bg-violet-500/[0.04] dark:text-violet-400/25 hover:bg-violet-500/[0.07] hover:text-violet-700/50 dark:hover:bg-violet-500/[0.07] dark:hover:text-violet-400/40",
  },
  {
    view: "photos",
    label: "Photos",
    icon: ImageSquare,
    activeClass: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    inactiveClass: "bg-pink-500/[0.04] text-pink-700/30 dark:bg-pink-500/[0.04] dark:text-pink-400/25 hover:bg-pink-500/[0.07] hover:text-pink-700/50 dark:hover:bg-pink-500/[0.07] dark:hover:text-pink-400/40",
  },
  {
    view: "kanban",
    label: "Todos",
    icon: Kanban,
    activeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    inactiveClass: "bg-amber-500/[0.04] text-amber-700/30 dark:bg-amber-500/[0.04] dark:text-amber-400/25 hover:bg-amber-500/[0.07] hover:text-amber-700/50 dark:hover:bg-amber-500/[0.07] dark:hover:text-amber-400/40",
  },
  {
    view: "home",
    label: "Info",
    icon: Info,
    activeClass: "bg-black/[0.07] dark:bg-white/[0.1] text-black dark:text-white",
    inactiveClass: "bg-black/[0.02] text-black/30 dark:bg-white/[0.03] dark:text-white/25 hover:bg-black/[0.05] hover:text-black/50 dark:hover:bg-white/[0.06] dark:hover:text-white/40",
  },
]

const SITE_PREVIEW_VIEW: ViewOption = {
  view: "site",
  label: "Preview",
  icon: Browser,
  activeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  inactiveClass: "bg-blue-500/[0.04] text-blue-700/30 dark:bg-blue-500/[0.04] dark:text-blue-400/25 hover:bg-blue-500/[0.07] hover:text-blue-700/50 dark:hover:bg-blue-500/[0.07] dark:hover:text-blue-400/40",
}

const SUPERADMIN_VIEWS: ViewOption[] = [
  {
    view: "events",
    label: "Activity",
    icon: Lightning,
    activeClass: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    inactiveClass: "bg-yellow-500/[0.04] text-yellow-700/30 dark:bg-yellow-500/[0.04] dark:text-yellow-400/25 hover:bg-yellow-500/[0.07] hover:text-yellow-700/50 dark:hover:bg-yellow-500/[0.07] dark:hover:text-yellow-400/40",
  },
  {
    view: "terminal",
    label: "Console",
    icon: Terminal,
    activeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    inactiveClass: "bg-cyan-500/[0.04] text-cyan-700/30 dark:bg-cyan-500/[0.04] dark:text-cyan-400/25 hover:bg-cyan-500/[0.07] hover:text-cyan-700/50 dark:hover:bg-cyan-500/[0.07] dark:hover:text-cyan-400/40",
  },
]

export function Workbench() {
  const { workspace, worktree } = useWorkspace({ allowEmpty: true })
  const isSuperadminWorkspace = workspace === SUPERADMIN_WORKSPACE_NAME
  const isSuperadmin = useSuperadmin()
  const { workbench, setView } = useWorkbenchContext()

  // Superadmin workspace has no site preview — default to code/files
  useEffect(() => {
    if (isSuperadminWorkspace && workbench.view === "site") {
      setView("code")
    }
  }, [isSuperadminWorkspace, workbench.view, setView])

  const isFullscreen = useWorkbenchFullscreen()
  const { setWorkbench, toggleWorkbenchFullscreen } = useDebugActions()
  const handleSelectView = (view: WorkbenchView) => {
    trackWorkbenchViewChanged(view)
    setView(view)
  }

  const viewOptions = isSuperadminWorkspace ? STANDARD_VIEWS : [SITE_PREVIEW_VIEW, ...STANDARD_VIEWS]
  const isSuperadminViewActive = SUPERADMIN_VIEWS.some(v => v.view === workbench.view)

  return (
    <div data-panel-role="workbench" className="relative bg-white dark:bg-[#0d0d0d] flex flex-col h-full w-full">
      {/* View switcher */}
      <div data-panel-role="workbench-view-switcher" className="h-11 px-2.5 flex items-center gap-1.5 shrink-0">
        {viewOptions.map(({ view, label, icon: Icon, activeClass, inactiveClass }) => {
          const active = workbench.view === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => handleSelectView(view)}
              className={`flex items-center gap-2 h-8 px-3.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
                active ? activeClass : inactiveClass
              }`}
            >
              <Icon size={16} weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </button>
          )
        })}
        {isSuperadmin && (
          <SuperadminMenu
            views={SUPERADMIN_VIEWS}
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

      {/* Content */}
      <div data-panel-role="workbench-content" className="flex-1 overflow-hidden relative">
        {!workspace || (!workspace.includes(".") && !isSuperadminWorkspace) ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-zinc-300 dark:text-zinc-700 text-[13px]">
                {workspace ? "Can't open this workspace" : "Pick a site to get started"}
              </p>
            </div>
          </div>
        ) : (
          <WorkbenchViewDispatcher view={workbench.view} workspace={workspace} worktree={worktree} />
        )}
      </div>
    </div>
  )
}

// ── View Dispatcher ──────────────────────────────────────────────────────────
// All views conform to WorkbenchViewProps. The registry is exhaustive — the
// compiler enforces that every WorkbenchView has a component.

function WorkbenchViewDispatcher({ view, workspace, worktree }: WorkbenchViewProps & { view: WorkbenchView }) {
  const Component = VIEW_REGISTRY[view]
  return <Component workspace={workspace} worktree={worktree} />
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
            : "bg-black/[0.02] text-black/30 dark:bg-white/[0.03] dark:text-white/25 hover:bg-black/[0.05] hover:text-black/50 dark:hover:bg-white/[0.06] dark:hover:text-white/40"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <ActiveIcon size={16} weight={isActive ? "fill" : "regular"} />
        {isActive && <span>{activeView?.label}</span>}
        <CaretDown
          size={12}
          weight="bold"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-1.5 w-44 bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.06] rounded-2xl shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.04] z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
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
