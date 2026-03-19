import { useQueryState } from "nuqs"
import { useMemo } from "react"
import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Spinner } from "@/components/ui/Spinner"
import { cn } from "@/lib/cn"
import { PARAM_KEYS, searchParam, selectedUserParam, sortAscParam, tabParam, usersSortParam } from "@/lib/searchParams"
import { UserActivity } from "./components/UserActivity"
import { UserDetail } from "./components/UserDetail"
import { UserRow } from "./components/UserRow"
import { useUsers } from "./hooks/useUsers"
import type { User } from "./users.types"

type Tab = "overview" | "activity"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
]

type SortKey = "name" | "status" | "last_active" | "created" | "orgs"

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "last_active", label: "Last Active" },
  { key: "created", label: "Created" },
  { key: "orgs", label: "Orgs" },
]

function userSortName(u: User): string {
  if (u.display_name) return u.display_name
  if (u.email) return u.email
  return u.user_id
}

function compareUsers(a: User, b: User, key: SortKey, asc: boolean): number {
  let cmp = 0
  switch (key) {
    case "name":
      cmp = userSortName(a).localeCompare(userSortName(b))
      break
    case "status":
      cmp = a.status.localeCompare(b.status)
      break
    case "last_active": {
      const aTime = a.last_active ? new Date(a.last_active).getTime() : 0
      const bTime = b.last_active ? new Date(b.last_active).getTime() : 0
      cmp = aTime - bTime
      break
    }
    case "created":
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      break
    case "orgs":
      cmp = a.org_count - b.org_count
      break
  }
  return asc ? cmp : -cmp
}

export function UsersPage() {
  const { users, loading, error, refresh } = useUsers()

  const [tab, setTab] = useQueryState(PARAM_KEYS.tab, tabParam)
  const [search, setSearch] = useQueryState(PARAM_KEYS.search, searchParam)
  const [sortKey, setSortKey] = useQueryState(PARAM_KEYS.sort, usersSortParam)
  const [sortAsc, setSortAsc] = useQueryState(PARAM_KEYS.sortAsc, sortAscParam)
  const [selectedUserId, setSelectedUserId] = useQueryState(PARAM_KEYS.selected, selectedUserParam)

  const filtered = search.trim()
    ? users.filter(u => {
        const q = search.toLowerCase()
        return (
          (u.email ? u.email.toLowerCase().includes(q) : false) ||
          (u.display_name ? u.display_name.toLowerCase().includes(q) : false) ||
          u.user_id.toLowerCase().includes(q)
        )
      })
    : users

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => compareUsers(a, b, sortKey, sortAsc)),
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

  const selectedUser = selectedUserId ? users.find(u => u.user_id === selectedUserId) : null

  const activeCount = users.filter(u => u.status === "active").length

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState title="Failed to load users" description={error} action={<Button onClick={refresh}>Retry</Button>} />
    )
  }

  return (
    <>
      <PageHeader title="Users" description={`${users.length} user${users.length !== 1 ? "s" : ""}`} />

      {/* Master-detail layout */}
      <div className="flex gap-6 min-h-0" style={{ height: "calc(100vh - 220px)" }}>
        {/* Left: user list */}
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
              placeholder="Search users..."
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

          {search.trim() && filtered.length !== users.length && (
            <p className="text-[12px] text-text-tertiary mb-2 px-1">
              {filtered.length} of {users.length}
            </p>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-0.5">
            {sorted.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[12px] text-text-tertiary">{search ? "No matches" : "No users"}</p>
              </div>
            ) : (
              sorted.map(user => (
                <UserRow
                  key={user.user_id}
                  user={user}
                  selected={user.user_id === selectedUserId}
                  onSelect={setSelectedUserId}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: tabs + detail panel */}
        <div className="flex-1 min-w-0 border-l border-border pl-6 flex flex-col min-h-0">
          {selectedUser ? (
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
                  <UserDetail user={selectedUser} />
                ) : (
                  <UserActivity userId={selectedUser.user_id} />
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[13px] text-text-tertiary">Select a user to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex gap-8 pt-5 mt-5 border-t border-border">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-tertiary">Total users</span>
          <span className="text-[12px] font-medium text-text-secondary tabular-nums">{users.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-tertiary">Active</span>
          <span className="text-[12px] font-medium text-text-secondary tabular-nums">{activeCount}</span>
        </div>
      </div>
    </>
  )
}
