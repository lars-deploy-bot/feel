"use client"
import {
  Browser,
  CaretDown,
  FolderSimple,
  ImageSquare,
  Info,
  Kanban,
  Lightning,
  type Icon as PhosphorIcon,
  Sparkle,
  Terminal,
} from "@phosphor-icons/react"
import { SUPERADMIN_WORKSPACE_NAME } from "@webalive/shared/constants"
import { X } from "lucide-react"
import type { ComponentType } from "react"
import { useEffect, useRef, useState } from "react"
import { useWorkbenchContext, type WorkbenchView, type WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useSuperadmin } from "@/hooks/use-superadmin"
import { trackWorkbenchViewChanged } from "@/lib/analytics/events"
import { TOP_BAR_HEIGHT } from "@/lib/layout"
import { useDebugActions } from "@/lib/stores/debug-store"
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

type ViewOption = {
  view: WorkbenchView
  label: string
  icon: PhosphorIcon
  color: string // tailwind color stem, e.g. "emerald", "violet"
  activeClass: string
  inactiveColor: string // icon color when inactive — visible enough for "click the green one"
}

// Active: colored bg tint + colored text + filled icon + subtle shadow
// Inactive: neutral text, colored icon only — wayfinding without the rainbow-toy effect
const INACTIVE_TEXT = "text-black/45 dark:text-white/35"

const STANDARD_VIEWS: ViewOption[] = [
  {
    view: "code",
    label: "Files",
    icon: FolderSimple,
    color: "emerald",
    activeClass:
      "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 shadow-[0_0_0_1px_theme(colors.emerald.500/0.08)]",
    inactiveColor: "text-emerald-600/55 dark:text-emerald-400/40",
  },
  {
    view: "agents",
    label: "Agents",
    icon: Sparkle,
    color: "violet",
    activeClass:
      "bg-violet-500/12 text-violet-600 dark:text-violet-400 shadow-[0_0_0_1px_theme(colors.violet.500/0.08)]",
    inactiveColor: "text-violet-600/55 dark:text-violet-400/40",
  },
  {
    view: "photos",
    label: "Photos",
    icon: ImageSquare,
    color: "pink",
    activeClass: "bg-pink-500/12 text-pink-600 dark:text-pink-400 shadow-[0_0_0_1px_theme(colors.pink.500/0.08)]",
    inactiveColor: "text-pink-600/55 dark:text-pink-400/40",
  },
  {
    view: "home",
    label: "Info",
    icon: Info,
    color: "neutral",
    activeClass: "bg-black/[0.07] dark:bg-white/[0.1] text-black dark:text-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]",
    inactiveColor: "text-black/40 dark:text-white/30",
  },
]

const SITE_PREVIEW_VIEW: ViewOption = {
  view: "site",
  label: "Preview",
  icon: Browser,
  color: "blue",
  activeClass: "bg-blue-500/12 text-blue-600 dark:text-blue-400 shadow-[0_0_0_1px_theme(colors.blue.500/0.08)]",
  inactiveColor: "text-blue-600/55 dark:text-blue-400/40",
}

const SUPERADMIN_VIEWS: ViewOption[] = [
  {
    view: "kanban",
    label: "Todos",
    icon: Kanban,
    color: "amber",
    activeClass: "bg-amber-500/12 text-amber-600 dark:text-amber-400 shadow-[0_0_0_1px_theme(colors.amber.500/0.08)]",
    inactiveColor: "text-amber-600/55 dark:text-amber-400/40",
  },
  {
    view: "events",
    label: "Activity",
    icon: Lightning,
    color: "yellow",
    activeClass:
      "bg-yellow-500/12 text-yellow-600 dark:text-yellow-400 shadow-[0_0_0_1px_theme(colors.yellow.500/0.08)]",
    inactiveColor: "text-yellow-600/55 dark:text-yellow-400/40",
  },
  {
    view: "terminal",
    label: "Console",
    icon: Terminal,
    color: "cyan",
    activeClass: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 shadow-[0_0_0_1px_theme(colors.cyan.500/0.08)]",
    inactiveColor: "text-cyan-600/55 dark:text-cyan-400/40",
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

  const { setWorkbench } = useDebugActions()
  const handleSelectView = (view: WorkbenchView) => {
    trackWorkbenchViewChanged(view)
    setView(view)
  }

  const viewOptions = isSuperadminWorkspace ? STANDARD_VIEWS : [SITE_PREVIEW_VIEW, ...STANDARD_VIEWS]
  const isSuperadminViewActive = SUPERADMIN_VIEWS.some(v => v.view === workbench.view)

  return (
    <div data-panel-role="workbench" className="relative bg-white dark:bg-[#0d0d0d] flex flex-col h-full w-full">
      {/* View switcher */}
      <div
        data-panel-role="workbench-view-switcher"
        className="px-2.5 flex items-center gap-1 shrink-0"
        style={{ height: TOP_BAR_HEIGHT }}
      >
        {viewOptions.map(({ view, label, icon: Icon, activeClass, inactiveColor }) => {
          const active = workbench.view === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => handleSelectView(view)}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[13px] transition-all duration-150 ${
                active
                  ? `font-medium ${activeClass}`
                  : `${INACTIVE_TEXT} hover:bg-black/[0.04] dark:hover:bg-white/[0.04]`
              }`}
            >
              <Icon
                size={15}
                weight={active ? "fill" : "regular"}
                className={`shrink-0 w-[15px] ${active ? "" : inactiveColor}`}
              />
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
          onClick={() => setWorkbench(false)}
          className="xl:hidden p-1.5 text-black/25 dark:text-white/20 hover:text-black/50 dark:hover:text-white/40 rounded-full transition-colors"
          data-panel-role="workbench-close"
          title="Close"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-black/[0.06] dark:bg-white/[0.06] shrink-0" />

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
      if (e.target instanceof Node && menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
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
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[13px] transition-all duration-150 ${
          isActive && activeView
            ? `font-medium ${activeView.activeClass}`
            : `${INACTIVE_TEXT} hover:bg-black/[0.04] dark:hover:bg-white/[0.04]`
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
          className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-zinc-900 border border-black/[0.06] dark:border-white/[0.06] rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
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
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2.5 ${
                    active
                      ? activeClass
                      : "text-black/50 dark:text-white/40 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-black/70 dark:hover:text-white/60"
                  }`}
                >
                  <Icon size={15} weight={active ? "fill" : "regular"} className="shrink-0" />
                  <span className="text-[13px]">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
