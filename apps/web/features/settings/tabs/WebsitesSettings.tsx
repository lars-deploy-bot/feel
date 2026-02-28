"use client"

import { AlertTriangle, ArrowDown, ArrowUp, Building2, FolderOpen, Search, Shield, Star } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AddWebsiteModal } from "@/components/modals/AddWebsiteModal"
import { GithubImportModal } from "@/components/modals/GithubImportModal"
import { EmptyState } from "@/components/ui/EmptyState"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { SearchInput } from "@/components/ui/SearchInput"
import { useSuperadmin } from "@/hooks/use-superadmin"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { useAllWorkspacesQuery } from "@/lib/hooks/useSettingsQueries"
import { useSelectedOrgId } from "@/lib/stores/workspaceStore"
import { PROJECT_GRID, ProjectCard } from "../components/ProjectCard"
import { SectionHeader } from "../components/SectionHeader"
import { useFavorites } from "../hooks/useFavorites"
import { plural } from "../lib/format"
import type { AllWebsitesData, SortState, WorkspaceWithOrg } from "../lib/project-types"
import { SORT_FIELDS, sortWorkspaces } from "../lib/project-types"
import { SettingsTabLayout } from "./SettingsTabLayout"
import { useWorkspaceSwitch } from "./WorkspaceSettings"

// ---------------------------------------------------------------------------
// Superadmin: all projects view
// ---------------------------------------------------------------------------

function AllProjectsView({
  data,
  searchQuery,
  currentWorkspace,
  onSwitch,
  favorites,
  onToggleFavorite,
}: {
  data: AllWebsitesData
  searchQuery: string
  currentWorkspace: string | null
  onSwitch: (hostname: string, orgId: string) => void
  favorites: Set<string>
  onToggleFavorite: (hostname: string) => void
}) {
  const query = searchQuery.toLowerCase()

  const filteredOrgs = Object.entries(data.websitesByOrg)
    .map(([orgId, { orgName, websites }]) => ({
      orgId,
      orgName,
      websites: websites.filter(
        w => !query || w.hostname.toLowerCase().includes(query) || w.ownerEmail.toLowerCase().includes(query),
      ),
    }))
    .filter(g => g.websites.length > 0)

  if (filteredOrgs.length === 0) {
    return <EmptyState icon={Search} message={`No projects match "${searchQuery}"`} />
  }

  return (
    <div className="space-y-6">
      {filteredOrgs.map(({ orgId, orgName, websites }) => (
        <div key={orgId}>
          <SectionHeader icon={Building2} title={orgName} count={websites.length} />
          <div className={PROJECT_GRID}>
            {websites.map(site => (
              <ProjectCard
                key={site.hostname}
                hostname={site.hostname}
                orgId={orgId}
                createdAt={site.createdAt}
                isCurrent={currentWorkspace === site.hostname}
                isFavorite={favorites.has(site.hostname)}
                onSwitch={onSwitch}
                onToggleFavorite={onToggleFavorite}
                subtitle={site.ownerEmail}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Favorites section header (cross-org)
// ---------------------------------------------------------------------------

function FavoritesSection({
  workspaces,
  currentWorkspace,
  onSwitch,
  onToggleFavorite,
}: {
  workspaces: WorkspaceWithOrg[]
  currentWorkspace: string | null
  onSwitch: (hostname: string, orgId: string) => void
  onToggleFavorite: (hostname: string) => void
}) {
  if (workspaces.length === 0) return null

  return (
    <div>
      <SectionHeader
        icon={Star}
        iconClassName="text-amber-500 dark:text-amber-400"
        title="Favorites"
        count={workspaces.length}
      />
      <div className={PROJECT_GRID}>
        {workspaces.map(ws => (
          <ProjectCard
            key={ws.hostname}
            hostname={ws.hostname}
            orgId={ws.orgId}
            createdAt={ws.createdAt}
            isCurrent={ws.hostname === currentWorkspace}
            isFavorite
            onSwitch={onSwitch}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sort toolbar
// ---------------------------------------------------------------------------

function SortToolbar({
  searchQuery,
  onSearchChange,
  sort,
  onSortChange,
}: {
  searchQuery: string
  onSearchChange: (value: string) => void
  sort: SortState
  onSortChange: (next: SortState) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <SearchInput value={searchQuery} onChange={onSearchChange} placeholder="Search..." className="w-48 sm:w-56" />
      <div className="flex items-center rounded-lg border border-black/10 dark:border-white/10 h-[38px] sm:h-[37px]">
        {SORT_FIELDS.map((opt, i) => {
          const active = sort.field === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                onSortChange(sort.field === opt.value ? { ...sort, asc: !sort.asc } : { field: opt.value, asc: true })
              }
              className={`flex items-center gap-1 px-2.5 h-full text-xs font-medium transition-all ${i > 0 ? "border-l border-black/10 dark:border-white/10" : ""} ${
                active
                  ? "bg-black/[0.06] dark:bg-white/[0.06] text-black dark:text-white"
                  : "text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
              }`}
            >
              {opt.label}
              {active && opt.value !== "favorites" && (sort.asc ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WebsitesSettings() {
  const { organizations, loading: orgsLoading } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()
  const { data: allWorkspaces, isLoading: websitesLoading, refetch } = useAllWorkspacesQuery(organizations)
  const { currentWorkspace, switchWorkspace } = useWorkspaceSwitch()
  const { favorites, toggle: toggleFavorite } = useFavorites()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sort, setSort] = useState<SortState>({ field: "favorites", asc: true })

  // Superadmin
  const isSuperadmin = useSuperadmin()
  const [showAllWebsites, setShowAllWebsites] = useState(false)
  const [allWebsitesData, setAllWebsitesData] = useState<AllWebsitesData | null>(null)
  const [allWebsitesLoading, setAllWebsitesLoading] = useState(false)

  useEffect(() => {
    if (!showAllWebsites || !isSuperadmin) return

    const controller = new AbortController()
    setAllWebsitesLoading(true)
    fetch("/api/admin/all-websites", { credentials: "include", signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (data.ok !== false) setAllWebsitesData(data)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error("Failed to fetch all websites:", err)
      })
      .finally(() => {
        if (!controller.signal.aborted) setAllWebsitesLoading(false)
      })
    return () => controller.abort()
  }, [showAllWebsites, isSuperadmin])

  const loading = orgsLoading || websitesLoading
  const query = searchQuery.toLowerCase()
  const selectedOrg = organizations.find(o => o.org_id === selectedOrgId) ?? organizations[0]

  // Cross-org favorites (only computed in favorites sort mode)
  const favoritesList = useMemo((): WorkspaceWithOrg[] => {
    if (sort.field !== "favorites" || !allWorkspaces) return []
    const allFlat = organizations.flatMap(org => {
      const ws = allWorkspaces[org.org_id]
      return ws ? ws.map(w => ({ ...w, orgId: org.org_id })) : []
    })
    return sortWorkspaces(
      allFlat.filter(w => favorites.has(w.hostname) && (!query || w.hostname.toLowerCase().includes(query))),
      sort,
    )
  }, [organizations, allWorkspaces, favorites, sort, query])

  // Current org's projects — exclude favorites when in favorites mode (they're shown above)
  const orgProjects = useMemo(() => {
    if (!selectedOrg || !allWorkspaces) return []
    const ws = allWorkspaces[selectedOrg.org_id]
    if (!ws) return []
    return sortWorkspaces(
      ws.filter(
        w =>
          (!query || w.hostname.toLowerCase().includes(query)) &&
          (sort.field !== "favorites" || !favorites.has(w.hostname)),
      ),
      sort,
    )
  }, [selectedOrg, allWorkspaces, query, sort, favorites])

  const totalProjects = (() => {
    if (!selectedOrg || !allWorkspaces) return 0
    const ws = allWorkspaces[selectedOrg.org_id]
    return ws ? ws.length : 0
  })()
  const filteredCount = favoritesList.length + orgProjects.length

  const renderContent = () => {
    if (showAllWebsites && isSuperadmin) {
      if (allWebsitesLoading) return <LoadingSpinner message="Loading all projects..." />
      if (!allWebsitesData) return <EmptyState icon={FolderOpen} message="No projects found" />
      return (
        <AllProjectsView
          data={allWebsitesData}
          searchQuery={searchQuery}
          currentWorkspace={currentWorkspace}
          onSwitch={switchWorkspace}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )
    }

    if (loading) return <LoadingSpinner message="Loading projects..." />
    if (organizations.length === 0) return <EmptyState icon={FolderOpen} message="No organizations found" />
    if (filteredCount === 0 && query) return <EmptyState icon={Search} message={`No projects match "${searchQuery}"`} />

    return (
      <div className="space-y-6">
        <FavoritesSection
          workspaces={favoritesList}
          currentWorkspace={currentWorkspace}
          onSwitch={switchWorkspace}
          onToggleFavorite={toggleFavorite}
        />

        {orgProjects.length > 0 && (
          <div>
            <SectionHeader icon={Building2} title={selectedOrg.name} count={orgProjects.length} />
            <div className={PROJECT_GRID}>
              {orgProjects.map(ws => (
                <ProjectCard
                  key={ws.hostname}
                  hostname={ws.hostname}
                  orgId={selectedOrg.org_id}
                  createdAt={ws.createdAt}
                  isCurrent={ws.hostname === currentWorkspace}
                  isFavorite={favorites.has(ws.hostname)}
                  onSwitch={switchWorkspace}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </div>
        )}

        {orgProjects.length === 0 && favoritesList.length === 0 && !query && (
          <EmptyState icon={FolderOpen} message="No projects yet" />
        )}
      </div>
    )
  }

  const description =
    showAllWebsites && allWebsitesData
      ? `All ${allWebsitesData.total} projects across all users`
      : `${totalProjects} project${plural(totalProjects)}`

  return (
    <SettingsTabLayout title="Projects" description={description}>
      <div className="space-y-5">
        {isSuperadmin && (
          <button
            type="button"
            onClick={() => setShowAllWebsites(!showAllWebsites)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              showAllWebsites
                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                : "bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70 border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20"
            }`}
          >
            <Shield size={14} />
            {showAllWebsites ? "Showing All Projects" : "Show All Projects"}
          </button>
        )}

        {!loading && !currentWorkspace && totalProjects > 0 && !showAllWebsites && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
            <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <span className="font-medium">No project selected.</span>{" "}
              <span className="text-amber-600 dark:text-amber-400">Click on a project below to start chatting.</span>
            </div>
          </div>
        )}

        <SortToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} sort={sort} onSortChange={setSort} />

        {renderContent()}

        {!loading && !showAllWebsites && (
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 active:scale-[0.98] transition-all"
            >
              Open from GitHub
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-lg text-sm font-medium border border-black/15 dark:border-white/15 text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all"
            >
              Start from template
            </button>
          </div>
        )}

        {showAddModal && <AddWebsiteModal onClose={() => setShowAddModal(false)} onSuccess={refetch} />}
        {showImportModal && (
          <GithubImportModal
            onClose={() => setShowImportModal(false)}
            onImported={domain => {
              window.location.href = `/chat?wk=${encodeURIComponent(domain)}`
            }}
          />
        )}
      </div>
    </SettingsTabLayout>
  )
}
