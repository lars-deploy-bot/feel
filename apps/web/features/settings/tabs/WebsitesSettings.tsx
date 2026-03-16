"use client"

import { LIMITS } from "@webalive/shared"
import { AlertTriangle, ArrowDown, ArrowUp, Building2, FolderOpen, Plus, Search, Shield, Star } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
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
  onDelete,
}: {
  data: AllWebsitesData
  searchQuery: string
  currentWorkspace: string | null
  onSwitch: (hostname: string, orgId: string) => void
  favorites: Set<string>
  onToggleFavorite: (hostname: string) => void
  onDelete?: (hostname: string) => void
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
                onDelete={onDelete}
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
  onDelete,
}: {
  workspaces: WorkspaceWithOrg[]
  currentWorkspace: string | null
  onSwitch: (hostname: string, orgId: string) => void
  onToggleFavorite: (hostname: string) => void
  onDelete?: (hostname: string) => void
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
            onDelete={onDelete}
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
      <div className="flex items-center rounded-lg border border-[#4a7c59]/[0.10] dark:border-[#7cb88a]/[0.08] h-[38px] sm:h-[37px]">
        {SORT_FIELDS.map((opt, i) => {
          const active = sort.field === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                onSortChange(sort.field === opt.value ? { ...sort, asc: !sort.asc } : { field: opt.value, asc: true })
              }
              className={`flex items-center gap-1 px-2.5 h-full text-xs font-medium transition-all ${i > 0 ? "border-l border-[#4a7c59]/[0.10] dark:border-[#7cb88a]/[0.08]" : ""} ${
                active
                  ? "bg-[#4a7c59]/[0.06] dark:bg-[#7cb88a]/[0.06] text-[#2c2a26] dark:text-[#e8e4dc]"
                  : "text-[#b5afa3] dark:text-[#5c574d] hover:text-[#5c574d] dark:hover:text-[#b5afa3]"
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

  const handleDelete = useCallback(
    async (hostname: string) => {
      try {
        const res = await fetch("/api/manager", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ domain: hostname }),
        })
        const data = await res.json()
        if (res.ok) {
          toast(`Deleted ${hostname}`)
          refetch()
        } else {
          toast(data?.error ?? "Failed to delete project")
        }
      } catch {
        toast("Failed to delete project")
      }
    },
    [refetch],
  )
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
          onDelete={isSuperadmin ? handleDelete : undefined}
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
          onDelete={isSuperadmin ? handleDelete : undefined}
        />

        {orgProjects.length > 0 && (
          <div>
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
                  onDelete={isSuperadmin ? handleDelete : undefined}
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

  const maxSites = isSuperadmin ? 999 : LIMITS.MAX_SITES_PER_USER
  const remaining = Math.max(0, maxSites - totalProjects)
  const atLimit = remaining === 0 && !isSuperadmin

  const description =
    showAllWebsites && allWebsitesData
      ? `All ${allWebsitesData.total} projects across all users`
      : isSuperadmin
        ? `${totalProjects} project${plural(totalProjects)}`
        : `${totalProjects} of ${maxSites} projects used`

  return (
    <SettingsTabLayout title="Projects" description={description}>
      <div className="space-y-5">
        {/* New project button + quota */}
        {!loading && !showAllWebsites && (
          <NewProjectButton
            atLimit={atLimit}
            remaining={remaining}
            isSuperadmin={isSuperadmin}
            onGithub={() => setShowImportModal(true)}
            onTemplate={() => setShowAddModal(true)}
          />
        )}

        {isSuperadmin && (
          <button
            type="button"
            onClick={() => setShowAllWebsites(!showAllWebsites)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              showAllWebsites
                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                : "bg-[#4a7c59]/[0.04] dark:bg-[#7cb88a]/[0.04] text-[#5c574d] dark:text-[#b5afa3] border border-[#4a7c59]/[0.10] dark:border-[#7cb88a]/[0.08] hover:border-[#4a7c59]/20 dark:hover:border-[#7cb88a]/16"
            }`}
          >
            <Shield size={12} />
            {showAllWebsites ? "Showing All" : "Show All"}
          </button>
        )}

        {!loading && !currentWorkspace && totalProjects > 0 && !showAllWebsites && (
          <div className="flex items-start gap-3 p-3 bg-amber-500/[0.05] border border-amber-500/15 rounded-xl">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-[#8a8578] dark:text-[#7a756b]">No project selected. Open one below to start.</p>
          </div>
        )}

        <SortToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} sort={sort} onSortChange={setSort} />

        {renderContent()}

        {showAddModal && <AddWebsiteModal onClose={() => setShowAddModal(false)} onSuccess={refetch} />}
        {showImportModal && (
          <GithubImportModal
            onClose={() => setShowImportModal(false)}
            onImported={domain => {
              setShowImportModal(false)
              refetch()
              switchWorkspace(domain, selectedOrg?.org_id ?? organizations[0]?.org_id ?? "")
            }}
          />
        )}
      </div>
    </SettingsTabLayout>
  )
}

// ---------------------------------------------------------------------------
// New Project Button — dropdown with "From GitHub" / "From template"
// ---------------------------------------------------------------------------

function NewProjectButton({
  atLimit,
  remaining,
  isSuperadmin,
  onGithub,
  onTemplate,
}: {
  atLimit: boolean
  remaining: number
  isSuperadmin: boolean
  onGithub: () => void
  onTemplate: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", keyHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", keyHandler)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex items-center gap-3">
      <button
        type="button"
        onClick={() => {
          if (atLimit) return
          setOpen(o => !o)
        }}
        disabled={atLimit}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-[#2c2a26] dark:bg-[#e8e4dc] text-[#faf8f5] dark:text-[#1a1816] hover:bg-[#3d3a34] dark:hover:bg-[#d4d0c8] disabled:opacity-30 active:scale-[0.98] transition-all"
      >
        <Plus size={15} strokeWidth={2} />
        New project
      </button>
      {!isSuperadmin && (
        <span
          className={`text-xs ${atLimit ? "text-red-500 dark:text-red-400" : "text-[#b5afa3] dark:text-[#5c574d]"}`}
        >
          {atLimit ? "Limit reached" : `${remaining} left`}
        </span>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-48 bg-[#faf8f5] dark:bg-[#1a1816] border border-[#4a7c59]/[0.12] dark:border-[#7cb88a]/[0.08] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onGithub()
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-[#2c2a26] dark:text-[#e8e4dc] hover:bg-[#4a7c59]/[0.06] dark:hover:bg-[#7cb88a]/[0.06] transition-colors"
            >
              From GitHub
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onTemplate()
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-[#2c2a26] dark:text-[#e8e4dc] hover:bg-[#4a7c59]/[0.06] dark:hover:bg-[#7cb88a]/[0.06] transition-colors"
            >
              From template
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
