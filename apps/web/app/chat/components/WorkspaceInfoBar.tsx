"use client"

import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher"

interface WorkspaceInfoBarProps {
  workspace: string | null
  mounted: boolean
  isTerminal: boolean
  isSuperadminWorkspace: boolean
  onSelectSite: () => void
  onNewTabGroup: () => void
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
  onNewTabGroup,
  onMobilePreview,
  onToggleTabs,
  showTabsToggle = false,
  tabsExpanded = false,
}: WorkspaceInfoBarProps) {
  // Show warning state only when mounted AND no workspace - avoids hydration mismatch
  const showWarning = mounted && !workspace

  return (
    <div
      className={`flex-shrink-0 border-b ${showWarning ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/20" : "border-black/[0.04] dark:border-white/[0.04]"}`}
      suppressHydrationWarning
    >
      <div className="px-4 md:px-6 py-2.5 md:py-3 mx-auto w-full md:max-w-2xl">
        {/* Workspace info bar */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: site name */}
          <div className="flex items-center min-w-0 flex-1" data-testid="workspace-section">
            {showWarning && (
              <AlertTriangle
                size={16}
                strokeWidth={1.75}
                className="text-amber-500 dark:text-amber-400 mr-2 flex-shrink-0"
              />
            )}
            {isTerminal ? (
              <WorkspaceSwitcher currentWorkspace={workspace} onOpenSettings={onSelectSite} />
            ) : showWarning ? (
              <button
                type="button"
                onClick={onSelectSite}
                className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 active:scale-95 transition-all"
              >
                Select a site to start
              </button>
            ) : (
              <span className="text-sm font-medium text-black/70 dark:text-white/70 truncate">
                {workspace || "Loading..."}
              </span>
            )}
          </div>

          {/* Right: action buttons */}
          {workspace && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mobile/Tablet: Preview button - opens fullscreen overlay. Hidden on lg+ where side panel is used */}
              {!isSuperadminWorkspace && (
                <button
                  type="button"
                  onClick={onMobilePreview}
                  className="lg:hidden inline-flex items-center justify-center h-9 px-4 text-sm font-medium text-white dark:text-black bg-black dark:bg-white hover:brightness-[0.85] active:brightness-75 active:scale-95 rounded-full transition-all duration-150"
                >
                  Preview
                </button>
              )}

              {/* Desktop: All buttons */}
              {!isSuperadminWorkspace && (
                <a
                  href={`https://${workspace}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] active:scale-95 rounded-lg transition-all duration-150"
                >
                  <ExternalLink size={12} strokeWidth={2} />
                  <span>open</span>
                </a>
              )}
              <button
                type="button"
                onClick={onNewTabGroup}
                data-testid="new-tab-group-button"
                className="hidden sm:inline-flex items-center h-8 px-3 text-xs font-medium text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] active:scale-95 rounded-lg transition-all duration-150"
              >
                + new group
              </button>
              {showTabsToggle && onToggleTabs && (
                <button
                  type="button"
                  onClick={onToggleTabs}
                  data-testid="toggle-tabs-button"
                  className={`hidden md:inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg transition-all duration-150 ${
                    tabsExpanded
                      ? "text-black/80 dark:text-white/80 bg-black/[0.08] dark:bg-white/[0.08]"
                      : "text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08]"
                  }`}
                  title={tabsExpanded ? "Hide tabs" : "Show tabs"}
                >
                  <span>tabs</span>
                  {tabsExpanded ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
