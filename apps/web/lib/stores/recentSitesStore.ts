"use client"

/**
 * @deprecated This store has been replaced by workspaceStore.ts
 * Use `useWorkspaceStore` and `useRecentForOrg` instead.
 * This file is kept for backwards compatibility but will be removed in a future version.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface RecentSite {
  domain: string
  lastAccessed: number
}

const MAX_RECENT_SITES = 5

// State interface
interface RecentSitesState {
  sites: RecentSite[]
}

// Actions interface - grouped under stable object (Guide §14.3)
interface RecentSitesActions {
  actions: {
    addSite: (domain: string) => void
    removeSite: (domain: string) => void
    clearSites: () => void
  }
}

// Extended type for backwards compatibility
type RecentSitesStoreWithCompat = RecentSitesState &
  RecentSitesActions & {
    // Legacy direct action exports for backwards compatibility
    addSite: (domain: string) => void
    removeSite: (domain: string) => void
    clearSites: () => void
  }

const useRecentSitesStoreBase = create<RecentSitesStoreWithCompat>()(
  persist(
    set => {
      const actions = {
        addSite: (domain: string) => {
          const trimmed = domain?.trim()
          if (!trimmed) return

          set(state => {
            // Remove if already exists
            const filtered = state.sites.filter(site => site.domain !== trimmed)
            // Add to front with current timestamp
            return {
              sites: [{ domain: trimmed, lastAccessed: Date.now() }, ...filtered].slice(0, MAX_RECENT_SITES),
            }
          })
        },

        removeSite: (domain: string) => {
          set(state => ({
            sites: state.sites.filter(site => site.domain !== domain),
          }))
        },

        clearSites: () => {
          set({ sites: [] })
        },
      }

      return {
        sites: [],
        actions,
        // Legacy direct exports for backwards compatibility
        ...actions,
      }
    },
    {
      name: "recent-sites-storage",
      version: 1,
      partialize: state => ({
        sites: state.sites,
      }),
    },
  ),
)

// Atomic selector: sites list (Guide §14.1)
export const useRecentSites = () => useRecentSitesStoreBase(state => state.sites)

// Actions hook - stable reference (Guide §14.3)
export const useRecentSitesActions = () => useRecentSitesStoreBase(state => state.actions)

// Legacy export for backwards compatibility
export const useRecentSitesStore = useRecentSitesStoreBase
