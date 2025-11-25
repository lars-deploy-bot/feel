"use client"

import { useEffect, useState } from "react"
import { isOrganizationsResponse, type Organization } from "@/lib/api/types"
import { authStore } from "@/lib/stores/authStore"
import { useWorkspaceActions } from "@/lib/stores/workspaceStore"

interface UseOrganizationsOptions {
  /**
   * Whether to fetch immediately on mount
   * @default true
   */
  immediate?: boolean
}

interface UseOrganizationsReturn {
  organizations: Organization[]
  currentUserId: string | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch organizations with automatic org selection
 *
 * This is the single source of truth for organization fetching.
 * The Zustand store handles the auto-selection logic.
 *
 * ## Auth Integration
 *
 * This hook integrates with the auth store for 401 handling:
 * - On 401: Calls `authStore.handleSessionExpired()` which triggers the SessionExpiredModal
 * - On success: Calls `authStore.setAuthenticated()` to confirm valid session
 * - Non-auth errors are still stored in local `error` state
 *
 * @example
 * ```tsx
 * const { organizations, loading, error, refetch } = useOrganizations()
 *
 * if (loading) return <Spinner />
 * if (error) return <Error message={error} onRetry={refetch} />
 *
 * return <OrgList organizations={organizations} />
 * ```
 */
export function useOrganizations(options: UseOrganizationsOptions = {}): UseOrganizationsReturn {
  const { immediate = true } = options

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState<string | null>(null)
  const { validateAndCleanup } = useWorkspaceActions()

  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/auth/organizations", { credentials: "include" })

      if (!response.ok) {
        // Handle 401 via auth store - triggers SessionExpiredModal
        if (response.status === 401) {
          authStore.handleSessionExpired("Your session has expired. Please log in again to continue.")
          // Don't set local error - the modal handles this
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Use shared type guard instead of manual checks
      if (isOrganizationsResponse(data)) {
        setOrganizations(data.organizations)
        setCurrentUserId(data.current_user_id)

        // Mark as authenticated on successful fetch
        authStore.setAuthenticated()

        // Centralized cleanup: validates selected org and recent workspaces against new org list
        // This handles cases where user was kicked out, org was deleted, etc.
        validateAndCleanup(data.organizations)
      } else {
        const error = (data as { error?: string }).error || "Failed to load organizations"
        throw new Error(error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Network error - please try again"
      console.error("[useOrganizations] Failed to fetch organizations:", err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (immediate) {
      fetchOrganizations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    organizations,
    currentUserId,
    loading,
    error,
    refetch: fetchOrganizations,
  }
}
