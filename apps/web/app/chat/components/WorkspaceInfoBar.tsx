"use client"

import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Eye } from "lucide-react"
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher"

interface WorkspaceInfoBarProps {
  workspace: string | null
  mounted: boolean
  isTerminal: boolean
  isSuperadminWorkspace: boolean
  onSelectSite: () => void
  onNewConversation: () => void
  onMobilePreview: () => void
  onToggleTabs?: () => void
  showTabsToggle?: boolean
  tabsExpanded?: boolean
}

export function WorkspaceInfoBar({
  workspace,
  mounted,
  isTerminal,
  isSuperadminWorkspace,
  onSelectSite,
  onNewConversation,
  onMobilePreview,
  onToggleTabs,
  showTabsToggle = false,
  tabsExpanded = false,
}: WorkspaceInfoBarProps) {
  return (
    <div
      className={`flex-shrink-0 border-b ${!workspace && mounted ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/20" : "border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]"}`}
    >
      <div className="px-4 md:px-6 py-3 mx-auto w-full md:max-w-2xl">
        {/* Workspace info bar - always visible */}
        <div className="flex items-center justify-between text-xs gap-2">
          {/* Left: site name (truncated on mobile) */}
          <div className="flex items-center min-w-0 flex-shrink" data-testid="workspace-section">
            {/* Warning icon when no workspace selected (not loading) */}
            {!workspace && mounted && (
              <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 mr-2 flex-shrink-0" />
            )}
            <span
              className={`font-medium flex-shrink-0 ${!workspace && mounted ? "text-amber-600 dark:text-amber-400" : "text-black/50 dark:text-white/50"}`}
              data-testid="workspace-label"
            >
              site
            </span>
            {isTerminal ? (
              <WorkspaceSwitcher currentWorkspace={workspace} onOpenSettings={onSelectSite} />
            ) : !workspace && mounted ? (
              <button
                type="button"
                onClick={onSelectSite}
                className="ml-2 md:ml-3 font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline underline-offset-2"
              >
                select a site
              </button>
            ) : (
              <span className="ml-2 md:ml-3 font-diatype-mono font-medium text-black/80 dark:text-white/80 truncate">
                {workspace || "loading..."}
              </span>
            )}
          </div>
          {/* Right: action buttons */}
          {workspace && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Preview button - mobile only */}
              {!isSuperadminWorkspace && (
                <button
                  type="button"
                  onClick={onMobilePreview}
                  className="sm:hidden px-2 py-1 text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors flex items-center gap-1"
                >
                  <span>preview</span>
                  <Eye size={12} />
                </button>
              )}
              {/* Hide "open" link for superadmin workspace (no external site) */}
              {!isSuperadminWorkspace && (
                <a
                  href={`https://${workspace}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors flex items-center gap-1"
                >
                  <ExternalLink size={10} />
                  <span className="hidden sm:inline">open</span>
                </a>
              )}
              <button
                type="button"
                onClick={onNewConversation}
                className="px-2 py-1 text-xs font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
              >
                <span className="sm:hidden">new</span>
                <span className="hidden sm:inline">new chat</span>
              </button>
              {/* Tabs toggle button - desktop only */}
              {showTabsToggle && onToggleTabs && (
                <button
                  type="button"
                  onClick={onToggleTabs}
                  className={`hidden md:flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                    tabsExpanded
                      ? "text-black dark:text-white bg-black/5 dark:bg-white/5"
                      : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  title={tabsExpanded ? "Hide tabs" : "Show tabs"}
                >
                  <span>tabs</span>
                  {tabsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
