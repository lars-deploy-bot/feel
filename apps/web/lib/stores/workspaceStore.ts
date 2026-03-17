"use client"

import { WORKSPACE_STORAGE } from "@webalive/shared"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { validateWorktreeSlug } from "@/features/workspace/lib/worktree-utils"
import type { Organization } from "@/lib/api/types"
import { queueSyncToServer } from "./workspacePreferencesSync"

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
  currentWorktreeByWorkspace: Record<string, string | null>
  /** Workspace domain set via deep link that hasn't been confirmed by
   *  validateWorkspaceAvailability yet. Prevents the validator from clearing
   *  the workspace before the all-workspaces fetch has completed. Not persisted. */
  deepLinkPending: string | null
  /** Monotonic counter incremented on every explicit user intent (manual switch,
   *  deep link consumption). Async corrections (allWorkspaces coherence check,
   *  server sync) must capture this before awaiting and discard their result if
   *  it changed. Not persisted. */
  intentVersion: number
}

// Actions interface - grouped under stable object (Guide §14.3)
interface WorkspaceActions {
  actions: {
    setCurrentWorkspace: (workspace: string | null, orgId?: string) => void
    setCurrentWorktree: (workspace: string, worktree: string | null) => void
    setSelectedOrg: (orgId: string | null) => void
    autoSelectOrg: (organizations: Organization[]) => void
    autoSelectWorkspace: () => boolean // Returns true if a workspace was auto-selected
    validateAndCleanup: (organizations: Organization[]) => void
    validateWorkspaceAvailability: (availableWorkspaces: string[]) => void
    setDeepLinkPending: (workspace: string | null) => void
    setSelectedWorkspace: (workspace: string | null, orgId?: string) => void
    addRecentWorkspace: (domain: string, orgId: string) => void
    removeRecentWorkspace: (domain: string) => void
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
          set(state => {
            const nextWorktrees = { ...state.currentWorktreeByWorkspace }
            if (workspace && nextWorktrees[workspace] === undefined) {
              nextWorktrees[workspace] = null
            }
            const updates: Partial<WorkspaceState> = {
              currentWorkspace: workspace,
              currentWorktreeByWorkspace: nextWorktrees,
              intentVersion: state.intentVersion + 1,
            }
            // Manual switch clears deepLinkPending so deferred resolution
            // doesn't override the user's explicit choice.
            if (state.deepLinkPending && workspace !== state.deepLinkPending) {
              updates.deepLinkPending = null
            }
            return updates
          })
          // Also track in recent workspaces for history
          if (workspace && orgId) {
            actions.addRecentWorkspace(workspace, orgId)
          }
          // Sync to server for cross-device access
          queueSyncToServer()
        },

        setCurrentWorktree: (workspace: string, worktree: string | null) => {
          if (!workspace) return

          // Normalize and validate worktree to ensure consistent casing
          // This prevents issues where URL has "Feature" but workspaceKey uses "feature"
          let normalizedWorktree: string | null = null
          if (worktree) {
            const validation = validateWorktreeSlug(worktree)
            if (validation.valid) {
              normalizedWorktree = validation.slug
            } else {
              console.warn(`[WorkspaceStore] Invalid worktree slug rejected: "${worktree}" - ${validation.reason}`)
              // Invalid worktree - clear it rather than store bad data
              normalizedWorktree = null
            }
          }

          set(state => ({
            currentWorktreeByWorkspace: {
              ...state.currentWorktreeByWorkspace,
              [workspace]: normalizedWorktree,
            },
          }))
          queueSyncToServer()
        },

        setSelectedOrg: (orgId: string | null) => {
          set(state => {
            const updates: Partial<WorkspaceState> = {
              selectedOrgId: orgId,
              intentVersion: state.intentVersion + 1,
            }
            // Manual org switch cancels any deferred deep link resolution.
            // The user's explicit org choice takes precedence over stale URL intent.
            if (state.deepLinkPending) {
              updates.deepLinkPending = null
            }
            return updates
          })
          // Sync to server for cross-device access
          queueSyncToServer()
        },

        /**
         * Auto-select first organization if none selected
         * This is the single source of truth for org auto-selection logic
         */
        autoSelectOrg: (organizations: Organization[]) => {
          set(state => {
            // Only auto-select if no org currently selected and we have orgs
            if (!state.selectedOrgId && organizations.length > 0) {
              return { selectedOrgId: organizations[0].org_id }
            }
            return state
          })
        },

        /**
         * Auto-select the most recently accessed workspace if none is currently selected.
         * Returns true if a workspace was auto-selected, false otherwise.
         */
        autoSelectWorkspace: () => {
          const state = useWorkspaceStoreBase.getState()

          // Only auto-select if no workspace currently selected
          if (state.currentWorkspace) {
            return false
          }

          if (state.recentWorkspaces.length === 0) {
            return false
          }

          // If an org is already selected, only pick from that org's recents.
          // Picking across orgs would silently switch the org, surprising the user.
          const candidates = state.selectedOrgId
            ? state.recentWorkspaces.filter(r => r.orgId === state.selectedOrgId)
            : state.recentWorkspaces

          if (candidates.length === 0) {
            // Selected org has no recents — don't fall back to a different org's
            // workspace. That would silently switch the org, surprising the user.
            return false
          }

          const sorted = [...candidates].sort((a, b) => b.lastAccessed - a.lastAccessed)
          const mostRecent = sorted[0]
          set({
            currentWorkspace: mostRecent.domain,
            selectedOrgId: mostRecent.orgId,
          })
          return true
        },

        /**
         * Validate and clean up org references when org list changes.
         * Handles cases where user was kicked out, org was deleted, etc.
         *
         * This handles ORG-LEVEL cleanup only:
         * - Invalid selectedOrgId (user no longer member)
         * - Stale recentWorkspaces pointing to removed orgs
         *
         * This does NOT clear currentWorkspace based on recents — recents are not
         * authoritative for workspace-to-org mapping. Workspace clearing for
         * membership loss happens via the allWorkspaces coherence effect in
         * page.tsx (server-authoritative) or validateWorkspaceAvailability
         * (filesystem-authoritative).
         */
        validateAndCleanup: (organizations: Organization[]) => {
          set(state => {
            const validOrgIds = new Set(organizations.map(org => org.org_id))
            const updates: Partial<WorkspaceState> = {}

            // Check if selected org is still valid
            if (state.selectedOrgId && !validOrgIds.has(state.selectedOrgId)) {
              updates.selectedOrgId = null
            }

            // Filter out recent workspaces for orgs user is no longer member of
            const filteredRecent = state.recentWorkspaces.filter(workspace => validOrgIds.has(workspace.orgId))
            if (filteredRecent.length !== state.recentWorkspaces.length) {
              updates.recentWorkspaces = filteredRecent
            }

            return Object.keys(updates).length > 0 ? updates : state
          })

          // After cleanup, trigger auto-selection if needed
          actions.autoSelectOrg(organizations)
        },

        /**
         * Validate current workspace against available workspaces on this server.
         * Clears currentWorkspace if it's not available (e.g., site doesn't exist on filesystem).
         * Also cleans up recentWorkspaces to only include available ones.
         */
        validateWorkspaceAvailability: (availableWorkspaces: string[]) => {
          set(state => {
            const availableSet = new Set(availableWorkspaces)
            const updates: Partial<WorkspaceState> = {}

            if (state.currentWorkspace && !availableSet.has(state.currentWorkspace)) {
              if (state.deepLinkPending === state.currentWorkspace) {
                // Deep link workspace not yet in the available list — keep it.
                // The pending flag stays so a timeout can clear it if it never appears.
              } else {
                updates.currentWorkspace = null
              }
            }

            // Workspace confirmed available — clear pending flag
            if (state.deepLinkPending && availableSet.has(state.deepLinkPending)) {
              updates.deepLinkPending = null
            }

            // Filter recent workspaces to only include available ones
            const filteredRecent = state.recentWorkspaces.filter(w => availableSet.has(w.domain))
            if (filteredRecent.length !== state.recentWorkspaces.length) {
              updates.recentWorkspaces = filteredRecent
            }

            return Object.keys(updates).length > 0 ? updates : state
          })
        },

        setDeepLinkPending: (workspace: string | null) => {
          set({ deepLinkPending: workspace })
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
          // Sync to server for cross-device access
          queueSyncToServer()
        },

        removeRecentWorkspace: (domain: string) => {
          set(state => ({
            recentWorkspaces: state.recentWorkspaces.filter(w => w.domain !== domain),
          }))
          queueSyncToServer()
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
        currentWorktreeByWorkspace: {},
        deepLinkPending: null,
        intentVersion: 0,
        actions,
      }
    },
    {
      name: WORKSPACE_STORAGE.KEY,
      version: WORKSPACE_STORAGE.VERSION, // See @webalive/shared for history
      /**
       * skipHydration: true - Prevents automatic hydration on store creation
       *
       * This is the definitive fix for Next.js hydration race conditions.
       * Without this, Zustand persist reads localStorage in a microtask,
       * causing a gap where state is partially hydrated (currentWorkspace set)
       * but _hasHydrated is still false.
       *
       * With skipHydration, we explicitly call rehydrate() via StoreHydrator
       * component, ensuring hydration happens at a controlled time.
       *
       * @see https://github.com/pmndrs/zustand/issues/938
       * @see https://zustand.docs.pmnd.rs/integrations/persisting-store-data
       */
      skipHydration: true,
      partialize: state => ({
        currentWorkspace: state.currentWorkspace,
        selectedOrgId: state.selectedOrgId,
        recentWorkspaces: state.recentWorkspaces,
        currentWorktreeByWorkspace: state.currentWorktreeByWorkspace,
      }),
      migrate: (persistedState: unknown, version: number): WorkspaceState => {
        const state = persistedState as Partial<WorkspaceState>
        // Migration from older versions: add currentWorkspace field (v3+)
        if (version < WORKSPACE_STORAGE.VERSION) {
          return {
            currentWorkspace: null,
            selectedOrgId: state.selectedOrgId ?? null,
            recentWorkspaces: state.recentWorkspaces ?? [],
            currentWorktreeByWorkspace: state.currentWorktreeByWorkspace ?? {},
            deepLinkPending: null,
            intentVersion: 0,
          }
        }
        return {
          currentWorkspace: state.currentWorkspace ?? null,
          selectedOrgId: state.selectedOrgId ?? null,
          recentWorkspaces: state.recentWorkspaces ?? [],
          currentWorktreeByWorkspace: state.currentWorktreeByWorkspace ?? {},
          deepLinkPending: null,
          intentVersion: 0,
        }
      },
      onRehydrateStorage: () => (_state, error) => {
        // Called when rehydrate() completes
        if (error) {
          console.error("[WorkspaceStore] Hydration error:", error)
        }
        // Note: App-wide hydration is tracked by HydrationManager via useAppHydrated()
      },
    },
  ),
)

// Export base store for HydrationManager (needs access to persist.rehydrate())
export { useWorkspaceStoreBase }

// Atomic selectors (Guide §14.1)
export const useCurrentWorkspace = () => useWorkspaceStoreBase(state => state.currentWorkspace)
export const useCurrentWorktree = (workspace: string | null) =>
  useWorkspaceStoreBase(state => (workspace ? (state.currentWorktreeByWorkspace[workspace] ?? null) : null))
export const useSelectedOrgId = () => useWorkspaceStoreBase(state => state.selectedOrgId)
export const useIntentVersion = () => useWorkspaceStoreBase(state => state.intentVersion)
export const useRecentWorkspaces = () => useWorkspaceStoreBase(state => state.recentWorkspaces)

// Derived selector: get recent workspaces for a specific org
export const useRecentForOrg = (orgId: string) =>
  useWorkspaceStoreBase(state =>
    state.recentWorkspaces.filter(w => w.orgId === orgId).sort((a, b) => b.lastAccessed - a.lastAccessed),
  )

// Actions hook - stable reference (Guide §14.3)
export const useWorkspaceActions = () => useWorkspaceStoreBase(state => state.actions)
