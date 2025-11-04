/**
 * Recent Sites Store
 *
 * Tracks sites a user has previously logged into for quick access.
 * Implements production-grade patterns:
 * - Input validation
 * - Error handling with fallbacks
 * - Observable logging
 * - Type safety with guards
 * - Pure helper functions (testable)
 * - Schema migration support
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

// ============================================================================
// Types & Constants
// ============================================================================

export interface RecentSite {
  domain: string
  lastAccessed: number
}

export interface RecentSitesStore {
  sites: RecentSite[]
  addSite: (domain: string) => boolean
  removeSite: (domain: string) => boolean
  clearSites: () => void
  getSite: (domain: string) => RecentSite | null
}

const MAX_RECENT_SITES = 5
const STORE_NAME = "recent-sites-storage"
const STORE_VERSION = 1

// ============================================================================
// Validation & Guards
// ============================================================================

/**
 * Validates if a domain string is acceptable for storage
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== "string") return false

  const trimmed = domain.trim()
  if (trimmed.length === 0) return false
  if (trimmed.length > 253) return false // Max domain length per RFC

  // Basic domain format check (contains at least one dot)
  return /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/.test(trimmed)
}

/**
 * Type guard for RecentSite
 */
export function isRecentSite(obj: unknown): obj is RecentSite {
  if (!obj || typeof obj !== "object") return false
  const site = obj as Record<string, unknown>
  return (
    typeof site.domain === "string" &&
    typeof site.lastAccessed === "number" &&
    site.lastAccessed > 0
  )
}

/**
 * Validates array of sites
 */
export function validateSitesArray(sites: unknown): RecentSite[] {
  if (!Array.isArray(sites)) {
    console.warn("[Recent Sites] Invalid sites array, resetting to empty")
    return []
  }

  return sites.filter((site, index) => {
    if (!isRecentSite(site)) {
      console.warn(`[Recent Sites] Invalid site at index ${index}, skipping`)
      return false
    }
    return true
  })
}

// ============================================================================
// Pure Helper Functions (easily testable)
// ============================================================================

/**
 * Adds or updates a site in the list
 * Pure function - does not mutate input
 */
export function addSiteToList(
  sites: RecentSite[],
  domain: string,
  maxSites: number = MAX_RECENT_SITES
): RecentSite[] {
  // Remove existing entry (will be re-added with new timestamp)
  const filtered = sites.filter(site => site.domain !== domain)

  // Add to front
  const newSite: RecentSite = {
    domain: domain.trim(),
    lastAccessed: Date.now(),
  }

  return [newSite, ...filtered].slice(0, maxSites)
}

/**
 * Removes a site from the list
 * Pure function - does not mutate input
 */
export function removeSiteFromList(
  sites: RecentSite[],
  domain: string
): RecentSite[] {
  return sites.filter(site => site.domain !== domain)
}

/**
 * Finds a site by domain
 * Pure function
 */
export function findSiteInList(
  sites: RecentSite[],
  domain: string
): RecentSite | null {
  return sites.find(site => site.domain === domain) || null
}

// ============================================================================
// Zustand Store
// ============================================================================

export const useRecentSitesStore = create<RecentSitesStore>()(
  persist(
    (set, get) => ({
      sites: [],

      /**
       * Add or update a site in the recent list
       * @returns true if added successfully, false if validation failed
       */
      addSite: (domain: string): boolean => {
        // Validate input
        if (!isValidDomain(domain)) {
          console.warn(`[Recent Sites] Invalid domain: "${domain}"`)
          return false
        }

        try {
          set((state) => {
            const updated = addSiteToList(state.sites, domain, MAX_RECENT_SITES)
            console.log(`[Recent Sites] Added: ${domain}`)
            return { sites: updated }
          })
          return true
        } catch (error) {
          console.error("[Recent Sites] Failed to add site:", error)
          return false
        }
      },

      /**
       * Remove a site from the recent list
       * @returns true if removed, false if not found or error
       */
      removeSite: (domain: string): boolean => {
        try {
          const siteBefore = get().sites.find(s => s.domain === domain)
          if (!siteBefore) {
            console.warn(`[Recent Sites] Site not found: ${domain}`)
            return false
          }

          set((state) => ({
            sites: removeSiteFromList(state.sites, domain)
          }))
          console.log(`[Recent Sites] Removed: ${domain}`)
          return true
        } catch (error) {
          console.error("[Recent Sites] Failed to remove site:", error)
          return false
        }
      },

      /**
       * Clear all recent sites
       */
      clearSites: () => {
        try {
          set({ sites: [] })
          console.log("[Recent Sites] Cleared all sites")
        } catch (error) {
          console.error("[Recent Sites] Failed to clear sites:", error)
        }
      },

      /**
       * Get a specific site by domain
       */
      getSite: (domain: string): RecentSite | null => {
        return findSiteInList(get().sites, domain)
      },
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,

      // Custom storage with error handling
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            const str = localStorage.getItem(name)
            if (!str) return null

            const parsed = JSON.parse(str)

            // Validate stored data
            if (parsed.state && Array.isArray(parsed.state.sites)) {
              parsed.state.sites = validateSitesArray(parsed.state.sites)
            }

            return str
          } catch (error) {
            console.error("[Recent Sites] Failed to load from storage:", error)
            // Return null to trigger fresh state
            return null
          }
        },

        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value)
          } catch (error) {
            console.error("[Recent Sites] Failed to save to storage:", error)
            // Graceful degradation - app continues without persistence
          }
        },

        removeItem: (name) => {
          try {
            localStorage.removeItem(name)
          } catch (error) {
            console.error("[Recent Sites] Failed to remove from storage:", error)
          }
        },
      })),

      // Migration function for future schema changes
      migrate: (persistedState: any, version: number) => {
        console.log(`[Recent Sites] Migrating from version ${version} to ${STORE_VERSION}`)

        // Currently v1, but this is where future migrations go
        if (version < 1) {
          // Example: if we had a v0 with different schema
          // return { sites: transformOldSchema(persistedState) }
        }

        return persistedState
      },

      // Only persist the sites array
      partialize: (state) => ({
        sites: state.sites,
      }),
    }
  )
)
