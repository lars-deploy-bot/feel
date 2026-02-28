import type { WorkspaceInfo } from "@/lib/hooks/useSettingsQueries"

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

export type SortField = "favorites" | "name" | "date"

export interface SortState {
  field: SortField
  asc: boolean
}

export const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: "favorites", label: "Favorites" },
  { value: "name", label: "Name" },
  { value: "date", label: "Created" },
]

/** Sort workspaces by field + direction. Preserves subtype via generic. */
export function sortWorkspaces<T extends WorkspaceInfo>(workspaces: T[], sort: SortState): T[] {
  return [...workspaces].sort((a, b) => {
    const dir = sort.asc ? 1 : -1
    if (sort.field === "date") return dir * a.createdAt.localeCompare(b.createdAt)
    // "name" and "favorites" both sort alphabetically (favorites partitioning is handled by the caller)
    return dir * a.hostname.localeCompare(b.hostname)
  })
}

// ---------------------------------------------------------------------------
// Workspace with org context (for cross-org favorites list)
// ---------------------------------------------------------------------------

export interface WorkspaceWithOrg extends WorkspaceInfo {
  orgId: string
}

// ---------------------------------------------------------------------------
// Superadmin all-websites response
// ---------------------------------------------------------------------------

export interface AllWebsitesData {
  total: number
  websitesByOrg: Record<
    string,
    {
      orgName: string
      websites: Array<{
        hostname: string
        port: number
        credits: number
        orgId: string
        orgName: string
        ownerEmail: string
        createdAt: string
      }>
    }
  >
}
