"use client"

import { AlertTriangle, Building2, Globe, Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { AddWorkspaceModal } from "@/components/modals/AddWorkspaceModal"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { SearchInput } from "@/components/ui/SearchInput"
import type { Organization } from "@/lib/api/types"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { SettingsTabLayout } from "./SettingsTabLayout"
import { orgSitesCache, useWorkspaceSwitch, WorkspacesGrid } from "./WorkspaceSettings"

// Hook to fetch workspaces for all organizations
function useAllOrgWorkspaces(organizations: Organization[]) {
  const [allWorkspaces, setAllWorkspaces] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (organizations.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    const results: Record<string, string[]> = {}

    await Promise.all(
      organizations.map(async org => {
        const cached = orgSitesCache.get(org.org_id)
        if (cached) {
          results[org.org_id] = cached
          return
        }

        try {
          const res = await fetch(`/api/auth/workspaces?org_id=${org.org_id}`, { credentials: "include" })
          const data = res.ok ? await res.json() : null
          const workspaces = data?.ok ? data.workspaces : []
          results[org.org_id] = workspaces
          if (workspaces.length) orgSitesCache.set(org.org_id, workspaces)
        } catch {
          results[org.org_id] = []
        }
      }),
    )

    setAllWorkspaces(results)
    setLoading(false)
  }, [organizations])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { allWorkspaces, loading, refetch: fetchAll }
}

// Organization group header with workspace grid
function OrgWebsitesGroup({
  org,
  workspaces,
  currentWorkspace,
  onSwitch,
}: {
  org: Organization
  workspaces: string[]
  currentWorkspace: string | null
  onSwitch: (workspace: string, orgId: string) => void
}) {
  // Wrap onSwitch to include orgId
  const handleSwitch = useCallback(
    (workspace: string) => {
      onSwitch(workspace, org.org_id)
    },
    [onSwitch, org.org_id],
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={14} className="text-black/40 dark:text-white/40" />
        <h4 className="text-sm font-medium text-black dark:text-white">{org.name}</h4>
        <span className="text-xs text-black/40 dark:text-white/40">
          ({workspaces.length} website{workspaces.length !== 1 ? "s" : ""})
        </span>
      </div>
      <WorkspacesGrid
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        loading={false}
        error={null}
        onSwitch={handleSwitch}
      />
    </div>
  )
}

export function WebsitesSettings() {
  const { organizations, loading: orgsLoading } = useOrganizations()
  const { allWorkspaces, loading: websitesLoading, refetch } = useAllOrgWorkspaces(organizations)
  const { currentWorkspace, switchWorkspace } = useWorkspaceSwitch()
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const loading = orgsLoading || websitesLoading
  const query = searchQuery.toLowerCase()

  // Filter workspaces by search
  const filteredGroups = organizations
    .map(org => ({
      org,
      workspaces: (allWorkspaces[org.org_id] || []).filter(w => !query || w.toLowerCase().includes(query)),
    }))
    .filter(g => g.workspaces.length > 0 || !query)

  const totalWebsites = Object.values(allWorkspaces).reduce((sum, ws) => sum + ws.length, 0)
  const filteredCount = filteredGroups.reduce((sum, g) => sum + g.workspaces.length, 0)

  const renderContent = () => {
    if (loading) return <LoadingSpinner message="Loading websites..." />
    if (organizations.length === 0) return <EmptyState icon={Globe} message="No organizations found" />
    if (filteredCount === 0 && query) return <EmptyState icon={Search} message={`No websites match "${searchQuery}"`} />

    return (
      <div className="space-y-6">
        {filteredGroups.map(({ org, workspaces }) => (
          <OrgWebsitesGroup
            key={org.org_id}
            org={org}
            workspaces={workspaces}
            currentWorkspace={currentWorkspace}
            onSwitch={switchWorkspace}
          />
        ))}
      </div>
    )
  }

  return (
    <SettingsTabLayout
      title="Websites"
      description={`All your websites across ${organizations.length} organization${organizations.length !== 1 ? "s" : ""}`}
    >
      <div className="space-y-5">
        {/* Warning when no workspace selected */}
        {!loading && !currentWorkspace && totalWebsites > 0 && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
            <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <span className="font-medium">No site selected.</span>{" "}
              <span className="text-amber-600 dark:text-amber-400">Click on a website below to start chatting.</span>
            </div>
          </div>
        )}

        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search websites..." />

        {query && (
          <p className="text-xs text-black/50 dark:text-white/50">
            {filteredCount} of {totalWebsites} websites match &quot;{searchQuery}&quot;
          </p>
        )}

        {renderContent()}

        {!loading && (
          <div className="flex justify-start pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 active:scale-[0.98] transition-all"
            >
              + Add Website
            </button>
          </div>
        )}

        {showAddModal && <AddWorkspaceModal onClose={() => setShowAddModal(false)} onSuccess={refetch} />}
      </div>
    </SettingsTabLayout>
  )
}
