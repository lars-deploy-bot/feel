"use client"

import { useEffect, useState } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { WORKSPACE_STORAGE } from "@webalive/shared"
import type { Organization } from "@/lib/api/types"

// Re-export Organization type for backwards compatibility
export type { Organization }

export interface RecentWorkspace {
  domain: string
  lastAccessed: number
  orgId: string
}

const MAX_RECENT_PER_ORG = 6

// State interface
interface WorkspaceState {
  currentWorkspace: string | null // The active workspace (persisted)
  selectedOrgId: string | null
  recentWorkspaces: RecentWorkspace[]
  _hasHydrated: boolean // Track if localStorage has been loaded
}

// Actions interface - grouped under stable object (Guide §14.3)
interface WorkspaceActions {
  actions: {
    setCurrentWorkspace: (workspace: string | null, orgId?: string) => void
    setSelectedOrg: (orgId: string | null) => void
    autoSelectOrg: (organizations: Organization[]) => void
    validateAndCleanup: (organizations: Organization[]) => void
    setSelectedWorkspace: (workspace: string | null, orgId?: string) => void
    addRecentWorkspace: (domain: string, orgId: string) => void
    clearRecentWorkspaces: () => void
    getRecentForOrg: (orgId: string) => RecentWorkspace[]
  }
}

type WorkspaceStore = WorkspaceState & WorkspaceActions

const useWorkspaceStoreBase = create<WorkspaceStore>()(
  persist(
    set => {
      const actions = {
        /**
         * Set the current active workspace.
         * This is the single source of truth for which workspace is active.
         * Also updates recentWorkspaces if orgId is provided.
         */
        setCurrentWorkspace: (workspace: string | null, orgId?: string) => {
          set({ currentWorkspace: workspace })
          // Also track in recent workspaces for history
          if (workspace && orgId) {
            actions.addRecentWorkspace(workspace, orgId)
          }
        },

        setSelectedOrg: (orgId: string | null) => {
          set({ selectedOrgId: orgId })
        },

        /**
         * Auto-select first organization if none selected
         * This is the single source of truth for org auto-selection logic
         */
        autoSelectOrg: (organizations: Organization[]) => {
          set(state => {
            // Only auto-select if no org currently selected and we have orgs
            if (!state.selectedOrgId && organizations.length > 0) {
              console.log("[WorkspaceStore] Auto-selecting first organization:", organizations[0].name)
              return { selectedOrgId: organizations[0].org_id }
            }
            return state
          })
        },

        /**
         * Validate and clean up org references when org list changes
         * Handles cases where user was kicked out, org was deleted, etc.
         *
         * This is the central cleanup point for:
         * - Invalid selectedOrgId (user no longer member)
         * - Stale recentWorkspaces pointing to removed orgs
         */
        validateAndCleanup: (organizations: Organization[]) => {
          set(state => {
            const validOrgIds = new Set(organizations.map(org => org.org_id))
            const updates: Partial<WorkspaceState> = {}

            // Check if selected org is still valid
            if (state.selectedOrgId && !validOrgIds.has(state.selectedOrgId)) {
              console.log("[WorkspaceStore] Clearing invalid selectedOrgId:", state.selectedOrgId)
              updates.selectedOrgId = null
            }

            // Filter out recent workspaces for orgs user is no longer member of
            const filteredRecent = state.recentWorkspaces.filter(workspace => validOrgIds.has(workspace.orgId))
            if (filteredRecent.length !== state.recentWorkspaces.length) {
              console.log(
                "[WorkspaceStore] Cleaned up stale recent workspaces:",
                state.recentWorkspaces.length - filteredRecent.length,
                "removed",
              )
              updates.recentWorkspaces = filteredRecent
            }

            return Object.keys(updates).length > 0 ? updates : state
          })

          // After cleanup, trigger auto-selection if needed
          actions.autoSelectOrg(organizations)
        },

        setSelectedWorkspace: (workspace: string | null, orgId?: string) => {
          // Backward compatibility: delegates to setCurrentWorkspace
          actions.setCurrentWorkspace(workspace, orgId)
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
        currentWorkspace: null,
        selectedOrgId: null,
        recentWorkspaces: [],
        _hasHydrated: false,
        actions,
      }
    },
    {
      name: WORKSPACE_STORAGE.KEY,
      version: WORKSPACE_STORAGE.VERSION, // See @webalive/shared for history
      partialize: (state): Omit<WorkspaceState, "_hasHydrated"> => ({
        currentWorkspace: state.currentWorkspace,
        selectedOrgId: state.selectedOrgId,
        recentWorkspaces: state.recentWorkspaces,
      }),
      migrate: (persistedState: unknown, version: number): WorkspaceState => {
        const state = persistedState as Partial<WorkspaceState>
        // Migration from older versions: add currentWorkspace field (v3+)
        if (version < WORKSPACE_STORAGE.VERSION) {
          return {
            currentWorkspace: null,
            selectedOrgId: state.selectedOrgId ?? null,
            recentWorkspaces: state.recentWorkspaces ?? [],
            _hasHydrated: false,
          }
        }
        return {
          currentWorkspace: state.currentWorkspace ?? null,
          selectedOrgId: state.selectedOrgId ?? null,
          recentWorkspaces: state.recentWorkspaces ?? [],
          _hasHydrated: false,
        }
      },
      onRehydrateStorage: () => state => {
        // Called when hydration completes (localStorage loaded)
        // state is the rehydrated state (or undefined if error)
        console.log("[WorkspaceStore] Hydration complete, state:", !!state)
      },
    },
  ),
)

// Atomic selectors (Guide §14.1)
export const useCurrentWorkspace = () => useWorkspaceStoreBase(state => state.currentWorkspace)
export const useSelectedOrgId = () => useWorkspaceStoreBase(state => state.selectedOrgId)
export const useRecentWorkspaces = () => useWorkspaceStoreBase(state => state.recentWorkspaces)

// Use persist.hasHydrated() for SSR-safe hydration checking
// This is the recommended pattern for Next.js - don't use internal state
export const useHasHydrated = () => {
  // Always start with false on SSR, check persist.hasHydrated() on client only
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // persist API is only available on client
    const persist = useWorkspaceStoreBase.persist

    // Check if already hydrated
    if (persist.hasHydrated()) {
      setHydrated(true)
      return
    }

    // Subscribe to hydration completion
    const unsub = persist.onFinishHydration(() => {
      setHydrated(true)
    })

    return () => {
      unsub()
    }
  }, [])

  return hydrated
}

// Derived selector: get recent workspaces for a specific org
export const useRecentForOrg = (orgId: string) =>
  useWorkspaceStoreBase(state =>
    state.recentWorkspaces.filter(w => w.orgId === orgId).sort((a, b) => b.lastAccessed - a.lastAccessed),
  )

// Actions hook - stable reference (Guide §14.3)
export const useWorkspaceActions = () => useWorkspaceStoreBase(state => state.actions)
