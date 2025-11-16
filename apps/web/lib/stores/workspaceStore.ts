"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface Organization {
  org_id: string
  name: string
  credits: number
  workspace_count?: number
}

export interface RecentWorkspace {
  domain: string
  lastAccessed: number
  orgId: string
}

const MAX_RECENT_PER_ORG = 3

// State interface
interface WorkspaceState {
  selectedOrgId: string | null
  recentWorkspaces: RecentWorkspace[]
}

// Actions interface - grouped under stable object (Guide §14.3)
interface WorkspaceActions {
  actions: {
    setSelectedOrg: (orgId: string | null) => void
    setSelectedWorkspace: (workspace: string | null, orgId?: string) => void
    addRecentWorkspace: (domain: string, orgId: string) => void
    clearRecentWorkspaces: () => void
    getRecentForOrg: (orgId: string) => RecentWorkspace[]
  }
}

// Extended type for backwards compatibility
type WorkspaceStoreWithCompat = WorkspaceState &
  WorkspaceActions & {
    // Legacy direct action exports for backwards compatibility
    setSelectedOrg: (orgId: string | null) => void
    setSelectedWorkspace: (workspace: string | null, orgId?: string) => void
    addRecentWorkspace: (domain: string, orgId: string) => void
    clearRecentWorkspaces: () => void
    getRecentForOrg: (orgId: string) => RecentWorkspace[]
  }

const useWorkspaceStoreBase = create<WorkspaceStoreWithCompat>()(
  persist(
    set => {
      const actions = {
        setSelectedOrg: (orgId: string | null) => {
          set({ selectedOrgId: orgId })
        },

        setSelectedWorkspace: (workspace: string | null, orgId?: string) => {
          // Backward compatibility: just add to recent workspaces
          // The actual selected workspace is managed by useWorkspace hook (sessionStorage)
          if (workspace && orgId) {
            actions.addRecentWorkspace(workspace, orgId)
          }
        },

        addRecentWorkspace: (domain: string, orgId: string) => {
          set(state => {
            const filtered = state.recentWorkspaces.filter(w => w.domain !== domain || w.orgId !== orgId)
            const newRecent: RecentWorkspace = {
              domain,
              orgId,
              lastAccessed: Date.now(),
            }

            // Group by org and limit per org
            const byOrg = new Map<string, RecentWorkspace[]>()
            for (const recent of [newRecent, ...filtered]) {
              if (!byOrg.has(recent.orgId)) {
                byOrg.set(recent.orgId, [])
              }
              const orgRecents = byOrg.get(recent.orgId)!
              if (orgRecents.length < MAX_RECENT_PER_ORG) {
                orgRecents.push(recent)
              }
            }

            return {
              recentWorkspaces: Array.from(byOrg.values()).flat(),
            }
          })
        },

        clearRecentWorkspaces: () => {
          set({ recentWorkspaces: [] })
        },

        getRecentForOrg: (_orgId: string) => {
          // This is a selector function, but included in actions for convenience
          // In practice, use the hook selector instead
          return []
        },
      }

      return {
        selectedOrgId: null,
        recentWorkspaces: [],
        actions,
        // Legacy direct exports for backwards compatibility
        ...actions,
      }
    },
    {
      name: "workspace-storage",
      version: 2, // Incremented due to state shape change
      partialize: state => ({
        selectedOrgId: state.selectedOrgId,
        recentWorkspaces: state.recentWorkspaces,
      }),
    },
  ),
)

// Atomic selectors (Guide §14.1)
export const useSelectedOrgId = () => useWorkspaceStoreBase(state => state.selectedOrgId)
export const useRecentWorkspaces = () => useWorkspaceStoreBase(state => state.recentWorkspaces)

// Derived selector: get recent workspaces for a specific org
export const useRecentForOrg = (orgId: string) =>
  useWorkspaceStoreBase(state =>
    state.recentWorkspaces.filter(w => w.orgId === orgId).sort((a, b) => b.lastAccessed - a.lastAccessed),
  )

// Actions hook - stable reference (Guide §14.3)
export const useWorkspaceActions = () => useWorkspaceStoreBase(state => state.actions)

// Legacy export for backwards compatibility
export const useWorkspaceStore = useWorkspaceStoreBase
