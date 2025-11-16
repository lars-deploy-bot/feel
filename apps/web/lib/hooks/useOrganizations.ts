"use client"

import { useEffect, useState } from "react"
import { isOrganizationsResponse, type Organization } from "@/lib/api/types"
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
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState<string | null>(null)
  const { autoSelectOrg } = useWorkspaceActions()

  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/auth/organizations", { credentials: "include" })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Use shared type guard instead of manual checks
      if (isOrganizationsResponse(data)) {
        setOrganizations(data.organizations)

        // Auto-select via store (single source of truth)
        // Store logic handles checking if org is already selected
        autoSelectOrg(data.organizations)
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
    loading,
    error,
    refetch: fetchOrganizations,
  }
}
