"use client"

import { ChevronDown } from "lucide-react"
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
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 rounded-lg shadow-lg z-20 max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
                <div className="w-3 h-3 border border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
                Loading sites...
              </div>
            ) : error ? (
              <div className="px-3 py-4 space-y-2">
                <div className="text-xs text-red-600 dark:text-red-400 text-center">{error}</div>
                <button
                  type="button"
                  onClick={retry}
                  className="w-full px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                {recentWorkspaces.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-wide border-b border-black/5 dark:border-white/5">
                      Recent
                    </div>
                    {recentWorkspaces.map(recent => (
                      <button
                        type="button"
                        key={recent.domain}
                        onClick={() => handleSelect(recent.domain)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                          recent.domain === currentWorkspace
                            ? "bg-black/5 dark:bg-white/5 text-black dark:text-white"
                            : "text-black/70 dark:text-white/70"
                        }`}
                      >
                        {recent.domain}
                      </button>
                    ))}
                  </>
                )}

                {otherWorkspaces.length > 0 && (
                  <>
                    {recentWorkspaces.length > 0 && (
                      <div className="px-3 py-1.5 text-xs font-medium text-black/40 dark:text-white/40 uppercase tracking-wide border-t border-black/5 dark:border-white/5">
                        All Workspaces
                      </div>
                    )}
                    {otherWorkspaces.map(workspace => (
                      <button
                        type="button"
                        key={workspace}
                        onClick={() => handleSelect(workspace)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                          workspace === currentWorkspace
                            ? "bg-black/5 dark:bg-white/5 text-black dark:text-white"
                            : "text-black/70 dark:text-white/70"
                        }`}
                      >
                        {workspace}
                      </button>
                    ))}
                  </>
                )}

                {workspaces.length === 0 && !loading && !error && (
                  <div className="px-3 py-4 text-xs text-black/50 dark:text-white/50 text-center">
                    No sites in this organization
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
