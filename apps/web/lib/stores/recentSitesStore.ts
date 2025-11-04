import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface RecentSite {
  domain: string
  lastAccessed: number
}

export interface RecentSitesStore {
  sites: RecentSite[]
  addSite: (domain: string) => void
  removeSite: (domain: string) => void
  clearSites: () => void
}

const MAX_RECENT_SITES = 5

export const useRecentSitesStore = create<RecentSitesStore>()(
  persist(
    set => ({
      sites: [],

      addSite: (domain: string) => {
        if (!domain?.trim()) return

        set(state => {
          // Remove if already exists
          const filtered = state.sites.filter(site => site.domain !== domain)
          // Add to front with current timestamp
          return {
            sites: [{ domain: domain.trim(), lastAccessed: Date.now() }, ...filtered].slice(0, MAX_RECENT_SITES),
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
    }),
    {
      name: "recent-sites-storage",
      version: 1,
    },
  ),
)
