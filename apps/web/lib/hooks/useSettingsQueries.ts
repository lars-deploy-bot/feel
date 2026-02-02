import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import type { Organization } from "@/lib/api/types"
import { authStore } from "@/lib/stores/authStore"
import { useWorkspaceActions } from "@/lib/stores/workspaceStore"
import { fetcher, ApiError } from "@/lib/tanstack/fetcher"
import { queryKeys } from "@/lib/tanstack/queryKeys"

// ============================================
// Types
// ============================================

export interface OrgMember {
  user_id: string
  email: string
  display_name: string | null
  role: "owner" | "admin" | "member"
}

interface OrganizationsResponse {
  organizations: Organization[]
  current_user_id?: string
}

// ============================================
// Organization Queries
// ============================================

/**
 * Fetch user organizations with full response (includes current_user_id)
 *
 * Benefits:
 * - Automatic caching (10 min fresh - orgs rarely change)
 * - Automatic deduplication (10 components = 1 request)
 * - Type-safe query key for invalidation
 * - Auth store integration (handles 401, marks authenticated on success)
 *
 * @example
 * const { data, isLoading, error } = useOrganizationsQuery()
 * // data?.organizations, data?.current_user_id
 */
export function useOrganizationsQuery() {
  const { validateAndCleanup } = useWorkspaceActions()

  const query = useQuery<OrganizationsResponse, ApiError>({
    queryKey: queryKeys.organizations.list(),
    queryFn: async () => {
      const response = await fetch("/api/auth/organizations", { credentials: "include" })

      if (!response.ok) {
        if (response.status === 401) {
          authStore.handleSessionExpired("Your session has expired. Please log in again to continue.")
          throw new ApiError("Session expired", 401)
        }
        const errorData = await response.json().catch(() => ({}))
        throw new ApiError(errorData.error || `HTTP ${response.status}`, response.status)
      }

      const data = await response.json()
      return data as OrganizationsResponse
    },
    staleTime: 10 * 60 * 1000, // 10 min - orgs rarely change
  })

  // Handle success side effects
  useEffect(() => {
    if (query.data?.organizations) {
      authStore.setAuthenticated()
      validateAndCleanup(query.data.organizations)
    }
  }, [query.data, validateAndCleanup])

  return query
}

// ============================================
// Workspace Queries
// ============================================

/**
 * Fetch workspaces for a specific organization
 * Per-org caching prevents unnecessary refetches
 *
 * @example
 * const { data: workspaces } = useWorkspacesQuery(orgId)
 */
export function useWorkspacesQuery(orgId: string) {
  return useQuery<string[], ApiError>({
    queryKey: queryKeys.workspaces.forOrg(orgId),
    queryFn: () => fetcher.get<string[]>(`/api/auth/workspaces?org_id=${orgId}`),
    enabled: !!orgId,
  })
}

/**
 * Fetch ALL workspaces for ALL organizations in ONE request
 * Much faster than N individual requests
 *
 * Performance:
 * - Settings page: 1 request instead of N (50-70% faster)
 * - Repeated opens: instant from cache (0 requests)
 *
 * @example
 * const { data: allWorkspaces } = useAllWorkspacesQuery(organizations)
 * // Returns: { "org-id-1": ["site1.com", "site2.com"], "org-id-2": ["site3.com"] }
 */
export function useAllWorkspacesQuery(organizations: Organization[]) {
  return useQuery<Record<string, string[]>, ApiError>({
    queryKey: queryKeys.workspaces.allForUser(),
    queryFn: () => fetcher.get<Record<string, string[]>>("/api/auth/all-workspaces"),
    enabled: organizations.length > 0,
  })
}

// ============================================
// Member Queries
// ============================================

/**
 * Fetch organization members
 * Cached per org with type-safe key for invalidation
 *
 * @example
 * const { data: members } = useOrgMembersQuery(orgId)
 */
export function useOrgMembersQuery(orgId: string) {
  return useQuery<OrgMember[], ApiError>({
    queryKey: queryKeys.orgMembers.forOrg(orgId),
    queryFn: () => fetcher.get<OrgMember[]>(`/api/auth/organizations/${orgId}/members`),
    enabled: !!orgId,
  })
}

// ============================================
// Automation Queries
// ============================================

export interface AutomationJob {
  id: string
  site_id: string
  name: string
  description: string | null
  trigger_type: "cron" | "webhook" | "one-time"
  cron_schedule: string | null
  cron_timezone: string | null
  run_at: string | null
  action_type: "prompt" | "sync" | "publish"
  action_prompt: string | null
  action_source: string | null
  action_target_page: string | null
  is_active: boolean
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
  created_at: string
  hostname?: string
}

interface AutomationsResponse {
  automations: AutomationJob[]
}

/**
 * Fetch automations for current user
 *
 * @example
 * const { data, isLoading, refetch } = useAutomationsQuery()
 */
export function useAutomationsQuery() {
  return useQuery<AutomationsResponse, ApiError>({
    queryKey: queryKeys.automations.list(),
    queryFn: () => fetcher.get<AutomationsResponse>("/api/automations"),
    staleTime: 2 * 60 * 1000, // 2 min - automations can change
  })
}

// ============================================
// Sites Queries
// ============================================

export interface Site {
  id: string
  hostname: string
  org_id: string
}

interface SitesResponse {
  sites: Site[]
}

/**
 * Fetch sites for current user (used in automations, etc.)
 *
 * @example
 * const { data } = useSitesQuery()
 */
export function useSitesQuery() {
  return useQuery<SitesResponse, ApiError>({
    queryKey: queryKeys.sites.list(),
    queryFn: () => fetcher.get<SitesResponse>("/api/sites"),
    staleTime: 5 * 60 * 1000, // 5 min - sites rarely change
  })
}
