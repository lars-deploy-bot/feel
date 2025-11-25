"use client"

import { Check, ChevronDown, Clock, Globe } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { isWorkspacesResponse } from "@/lib/api/types"
import { useFetch } from "@/lib/hooks/useFetch"
import { useRecentForOrg, useSelectedOrgId, useWorkspaceActions } from "@/lib/stores/workspaceStore"

interface WorkspaceSwitcherProps {
  currentWorkspace: string | null
  onWorkspaceChange: (workspace: string) => void
}

export function WorkspaceSwitcher({ currentWorkspace, onWorkspaceChange }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOrgId = useSelectedOrgId()
  const recentWorkspaces = useRecentForOrg(selectedOrgId || "")
  const { setSelectedWorkspace } = useWorkspaceActions()

  // Use shared type guard - no inline validators!
  const validator = useCallback(isWorkspacesResponse, [])

  const { data, loading, error, retry } = useFetch({
    url: selectedOrgId ? `/api/auth/workspaces?org_id=${selectedOrgId}` : null,
    validator,
    dependencies: [selectedOrgId],
  })

  const workspaces = data?.workspaces || []

  // Auto-select first workspace when loaded and no workspace is selected
  // OR when current workspace is not in the new org's workspace list (org switched)
  useEffect(() => {
    if (!loading && workspaces.length > 0 && selectedOrgId) {
      const currentWorkspaceInList = workspaces.includes(currentWorkspace || "")

      // Auto-select if: no workspace selected OR current workspace not in this org's list
      if (!currentWorkspace || !currentWorkspaceInList) {
        const firstWorkspace = recentWorkspaces.length > 0 ? recentWorkspaces[0].domain : workspaces[0]
        if (firstWorkspace) {
          setSelectedWorkspace(firstWorkspace, selectedOrgId)
          onWorkspaceChange(firstWorkspace)
        }
      }
    }
  }, [loading, workspaces, currentWorkspace, recentWorkspaces, selectedOrgId, setSelectedWorkspace, onWorkspaceChange])

  function handleSelect(workspace: string) {
    if (selectedOrgId) {
      setSelectedWorkspace(workspace, selectedOrgId)
    }
    onWorkspaceChange(workspace)
    setIsOpen(false)
  }

  // Group workspaces: recent first, then others
  const recentDomains = new Set(recentWorkspaces.map(r => r.domain))
  const otherWorkspaces = workspaces.filter(w => !recentDomains.has(w))

  if (!selectedOrgId) {
    return (
      <span
        className="ml-3 text-xs text-orange-600 dark:text-orange-400"
        title="Select an organization in Settings"
        data-testid="no-org-selected"
      >
        no org selected
      </span>
    )
  }

  if (error) {
    return (
      <div className="ml-3 flex items-center gap-2">
        <span className="text-xs text-red-600 dark:text-red-400" title={error} data-testid="workspace-error">
          error loading sites
        </span>
        <button
          type="button"
          onClick={retry}
          disabled={loading}
          className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="workspace-error-retry"
        >
          {loading ? "..." : "retry"}
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`ml-3 font-diatype-mono font-medium hover:text-black dark:hover:text-white transition-colors flex items-center gap-1 ${
          currentWorkspace ? "text-black/80 dark:text-white/80" : "text-black/60 dark:text-white/60"
        }`}
        data-testid="workspace-switcher"
      >
        <span data-testid="workspace-switcher-text">{currentWorkspace || (loading ? "loading..." : "select")}</span>
        <ChevronDown size={10} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close dropdown"
            tabIndex={-1}
          />
          <div className="absolute top-full left-0 sm:left-0 -left-2 mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-[320px] bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 z-20 max-h-[60vh] sm:max-h-[400px] overflow-y-auto overflow-x-hidden">
            {loading ? (
              <div className="px-4 py-6 flex flex-col items-center gap-2 text-xs text-black/50 dark:text-white/50">
                <div className="w-5 h-5 border-2 border-black/10 dark:border-white/10 border-t-black/60 dark:border-t-white/60 rounded-full animate-spin" />
                <span>Loading spaces...</span>
              </div>
            ) : error ? (
              <div className="p-4 space-y-3">
                <div className="text-xs text-red-600 dark:text-red-400 text-center">{error}</div>
                <button
                  type="button"
                  onClick={retry}
                  className="w-full px-3 py-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="py-1.5">
                {recentWorkspaces.length > 0 && (
                  <div className="mb-1">
                    <div className="px-3 py-2 flex items-center gap-2 text-[11px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider">
                      <Clock size={12} />
                      Recent
                    </div>
                    {recentWorkspaces.map(recent => {
                      const isSelected = recent.domain === currentWorkspace
                      return (
                        <button
                          type="button"
                          key={recent.domain}
                          onClick={() => handleSelect(recent.domain)}
                          className={`w-full px-3 py-3 sm:py-2.5 flex items-center gap-3 text-left transition-all active:bg-black/10 dark:active:bg-white/10 ${
                            isSelected
                              ? "bg-black/5 dark:bg-white/5"
                              : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? "bg-black dark:bg-white text-white dark:text-black"
                                : "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40"
                            }`}
                          >
                            <Globe size={14} />
                          </div>
                          <span
                            className={`text-sm truncate flex-1 ${
                              isSelected ? "text-black dark:text-white font-medium" : "text-black/70 dark:text-white/70"
                            }`}
                          >
                            {recent.domain}
                          </span>
                          {isSelected && <Check size={16} className="text-black dark:text-white flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {otherWorkspaces.length > 0 && (
                  <div
                    className={recentWorkspaces.length > 0 ? "border-t border-black/5 dark:border-white/5 pt-1" : ""}
                  >
                    {recentWorkspaces.length > 0 && (
                      <div className="px-3 py-2 flex items-center gap-2 text-[11px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider">
                        <Globe size={12} />
                        All Spaces
                      </div>
                    )}
                    {otherWorkspaces.map(workspace => {
                      const isSelected = workspace === currentWorkspace
                      return (
                        <button
                          type="button"
                          key={workspace}
                          onClick={() => handleSelect(workspace)}
                          className={`w-full px-3 py-3 sm:py-2.5 flex items-center gap-3 text-left transition-all active:bg-black/10 dark:active:bg-white/10 ${
                            isSelected
                              ? "bg-black/5 dark:bg-white/5"
                              : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? "bg-black dark:bg-white text-white dark:text-black"
                                : "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40"
                            }`}
                          >
                            <Globe size={14} />
                          </div>
                          <span
                            className={`text-sm truncate flex-1 ${
                              isSelected ? "text-black dark:text-white font-medium" : "text-black/70 dark:text-white/70"
                            }`}
                          >
                            {workspace}
                          </span>
                          {isSelected && <Check size={16} className="text-black dark:text-white flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {workspaces.length === 0 && !loading && !error && (
                  <div className="px-4 py-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mx-auto mb-3">
                      <Globe size={18} className="text-black/30 dark:text-white/30" />
                    </div>
                    <p className="text-sm text-black/50 dark:text-white/50">No spaces yet</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
