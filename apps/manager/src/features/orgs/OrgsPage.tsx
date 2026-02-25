import { formatTokensAsDollars } from "@webalive/shared/constants"
import { useQueryState } from "nuqs"
import { useCallback, useMemo, useState } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { DeleteModal } from "@/components/overlays/DeleteModal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { cn } from "@/lib/cn"
import { orgsSortParam, PARAM_KEYS, searchParam, selectedOrgParam, sortAscParam, tabParam } from "@/lib/searchParams"
import { AddMemberModal } from "./components/AddMemberModal"
import { CreateOrgModal } from "./components/CreateOrgModal"
import { OrgCard } from "./components/OrgCard"
import { OrgDetail } from "./components/OrgDetail"
import { useOrgs } from "./hooks/useOrgs"
import type { Organization } from "./orgs.types"

type Tab = "overview" | "activity"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
]

type SortKey = "name" | "credits" | "members" | "projects" | "created"

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "credits", label: "Balance" },
  { key: "members", label: "Members" },
  { key: "projects", label: "Projects" },
  { key: "created", label: "Created" },
]

function compareOrgs(a: Organization, b: Organization, key: SortKey, asc: boolean): number {
  let cmp = 0
  switch (key) {
    case "name":
      cmp = a.name.localeCompare(b.name)
      break
    case "credits":
      cmp = a.credits - b.credits
      break
    case "members":
      cmp = a.member_count - b.member_count
      break
    case "projects":
      cmp = a.domain_count - b.domain_count
      break
    case "created":
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      break
  }
  return asc ? cmp : -cmp
}

export function OrgsPage() {
  const { orgs, loading, error, refresh, updateCredits, deleteOrg, addMember, removeMember, createOrg } = useOrgs()

  const [tab, setTab] = useQueryState(PARAM_KEYS.tab, tabParam)
  const [search, setSearch] = useQueryState(PARAM_KEYS.search, searchParam)
  const [sortKey, setSortKey] = useQueryState(PARAM_KEYS.sort, orgsSortParam)
  const [sortAsc, setSortAsc] = useQueryState(PARAM_KEYS.sortAsc, sortAscParam)
  const [selectedOrgId, setSelectedOrgId] = useQueryState(PARAM_KEYS.selected, selectedOrgParam)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [addMemberTarget, setAddMemberTarget] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const filtered = search.trim()
    ? orgs.filter(org => {
        const q = search.toLowerCase()
        return (
          org.name.toLowerCase().includes(q) ||
          org.org_id.toLowerCase().includes(q) ||
          org.members.some(m => m.email.toLowerCase().includes(q))
        )
      })
    : orgs

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareOrgs(a, b, sortKey, sortAsc)),
    [filtered, sortKey, sortAsc],
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === "name")
    }
  }

  const selectedOrg = selectedOrgId ? orgs.find(o => o.org_id === selectedOrgId) : null

  const totalCredits = orgs.reduce((sum, org) => sum + org.credits, 0)
  const totalMembers = orgs.reduce((sum, org) => sum + org.member_count, 0)
  const totalProjects = orgs.reduce((sum, org) => sum + org.domain_count, 0)

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteOrg(deleteTarget)
      if (selectedOrgId === deleteTarget) setSelectedOrgId(null)
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteTarget, deleteOrg, selectedOrgId, setSelectedOrgId])

  if (loading && orgs.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load organizations"
        description={error}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Organizations"
        description={`${orgs.length} organization${orgs.length !== 1 ? "s" : ""}`}
        action={
          <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
            Create
          </Button>
        }
      />

      {/* Master-detail layout */}
      <div className="flex gap-6 min-h-0" style={{ height: "calc(100vh - 220px)" }}>
        {/* Left: org list (always visible) */}
        <div className="w-[320px] flex-shrink-0 flex flex-col min-h-0">
          {/* Search */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <circle cx="5.5" cy="5.5" r="4.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <Input
              placeholder="Search organizations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            {SORT_OPTIONS.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSort(s.key)}
                className={cn(
                  "px-2 py-0.5 text-[11px] rounded-md transition-colors duration-100 cursor-pointer",
                  sortKey === s.key
                    ? "bg-surface-secondary text-text-primary font-medium"
                    : "text-text-tertiary hover:text-text-secondary",
                )}
              >
                {s.label}
                {sortKey === s.key && <span className="ml-0.5 text-[10px]">{sortAsc ? "\u2191" : "\u2193"}</span>}
              </button>
            ))}
          </div>

          {search.trim() && filtered.length !== orgs.length && (
            <p className="text-[12px] text-text-tertiary mb-2 px-1">
              {filtered.length} of {orgs.length}
            </p>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-0.5">
            {sorted.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[12px] text-text-tertiary">{search ? "No matches" : "No organizations"}</p>
              </div>
            ) : (
              sorted.map(org => (
                <OrgCard
                  key={org.org_id}
                  org={org}
                  selected={org.org_id === selectedOrgId}
                  onSelect={setSelectedOrgId}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: tabs + detail panel */}
        <div className="flex-1 min-w-0 border-l border-border pl-6 flex flex-col min-h-0">
          {selectedOrg ? (
            <>
              {/* Tabs */}
              <div className="flex gap-0.5 p-[3px] bg-surface-secondary/50 rounded-md w-fit mb-5">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "px-2.5 py-[3px] text-[12px] rounded-[5px] transition-colors duration-100 cursor-pointer",
                      tab === t.id
                        ? "bg-surface text-text-primary shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]"
                        : "text-text-tertiary hover:text-text-secondary",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {tab === "overview" ? (
                  <OrgDetail
                    org={selectedOrg}
                    onSaveCredits={updateCredits}
                    onDelete={id => setDeleteTarget(id)}
                    onAddMember={id => setAddMemberTarget(id)}
                    onRemoveMember={removeMember}
                  />
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-[13px] text-text-tertiary">
                      Credit changes, member updates, and organization events will appear here.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[13px] text-text-tertiary">Select an organization to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex gap-8 pt-5 mt-5 border-t border-border">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-tertiary">Organizations</span>
          <span className="text-[12px] font-medium text-text-secondary tabular-nums">{orgs.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-tertiary">Total balance</span>
          <span className="text-[12px] font-medium text-text-secondary tabular-nums">
            {formatTokensAsDollars(totalCredits)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-tertiary">Members</span>
          <span className="text-[12px] font-medium text-text-secondary tabular-nums">{totalMembers}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-tertiary">Projects</span>
          <span className="text-[12px] font-medium text-text-secondary tabular-nums">{totalProjects}</span>
        </div>
      </div>

      <DeleteModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        entityName="Organization"
        loading={deleteLoading}
      />

      {addMemberTarget && (
        <AddMemberModal
          open
          onClose={() => setAddMemberTarget(null)}
          onAdd={(userId, role) => addMember(addMemberTarget, userId, role)}
        />
      )}

      <CreateOrgModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createOrg} />
    </>
  )
}
