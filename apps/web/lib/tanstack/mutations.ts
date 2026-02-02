/**
 * TanStack Query mutation utilities
 *
 * Provides:
 * - Type-safe mutation hooks
 * - Automatic cache invalidation
 * - Optimistic updates
 * - Error handling
 */

import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { fetcher, type ApiError } from "./fetcher"
import { queryKeys } from "./queryKeys"

// ============================================
// Mutation Types
// ============================================

interface MutationContext<T> {
  previousData?: T
}

// ============================================
// Organization Mutations
// ============================================

interface UpdateOrgParams {
  orgId: string
  name: string
}

/**
 * Update organization name
 * Automatically invalidates org cache on success
 */
export function useUpdateOrganization(
  options?: UseMutationOptions<{ ok: boolean }, ApiError, UpdateOrgParams, MutationContext<unknown>>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orgId, name }: UpdateOrgParams) => {
      return fetcher.patch<{ ok: boolean }>("/api/auth/organizations", {
        org_id: orgId,
        name,
      })
    },
    onSuccess: () => {
      // Invalidate org queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
      toast.success("Organization updated")
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to update organization")
    },
    ...options,
  })
}

// ============================================
// Workspace Mutations
// ============================================

interface CreateWebsiteParams {
  domain: string
  orgId: string
  templateId?: string
}

/**
 * Create a new website
 * Invalidates workspace cache on success
 */
export function useCreateWebsite(
  options?: UseMutationOptions<
    { ok: boolean; domain: string },
    ApiError,
    CreateWebsiteParams,
    MutationContext<unknown>
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ domain, orgId, templateId }: CreateWebsiteParams) => {
      return fetcher.post<{ ok: boolean; domain: string }>("/api/deploy-subdomain", {
        domain,
        org_id: orgId,
        template_id: templateId,
      })
    },
    onSuccess: data => {
      // Invalidate workspace queries
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      toast.success(`Created ${data.domain}`)
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to create website")
    },
    ...options,
  })
}

// ============================================
// Member Mutations
// ============================================

interface RemoveMemberParams {
  orgId: string
  userId: string
}

/**
 * Remove member from organization
 * Invalidates member cache on success
 */
export function useRemoveOrgMember(
  options?: UseMutationOptions<{ ok: boolean }, ApiError, RemoveMemberParams, MutationContext<unknown>>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orgId, userId }: RemoveMemberParams) => {
      return fetcher.delete<{ ok: boolean }>(`/api/auth/organizations/${orgId}/members/${userId}`)
    },
    onSuccess: (_, { orgId }) => {
      // Invalidate member queries for this org
      queryClient.invalidateQueries({ queryKey: queryKeys.orgMembers.forOrg(orgId) })
      toast.success("Member removed")
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to remove member")
    },
    ...options,
  })
}

// ============================================
// User Mutations
// ============================================

interface UpdateUserParams {
  name?: string
  email?: string
}

/**
 * Update user profile
 */
export function useUpdateUser(
  options?: UseMutationOptions<{ ok: boolean }, ApiError, UpdateUserParams, MutationContext<unknown>>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: UpdateUserParams) => {
      return fetcher.patch<{ ok: boolean }>("/api/user", params)
    },
    onSuccess: () => {
      // Invalidate user queries
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all })
      toast.success("Profile updated")
    },
    onError: (error: ApiError) => {
      toast.error(error.message || "Failed to update profile")
    },
    ...options,
  })
}

// ============================================
// Invalidation Helpers
// ============================================

/**
 * Invalidate all workspace-related queries
 * Use after adding/removing workspaces
 */
export function useInvalidateWorkspaces() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
  }
}

/**
 * Invalidate all organization-related queries
 * Use after updating organizations
 */
export function useInvalidateOrganizations() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
  }
}

/**
 * Invalidate user data
 * Use after profile updates or auth changes
 */
export function useInvalidateUser() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.user.all })
  }
}

/**
 * Invalidate automations data
 * Use after creating/updating/deleting automations
 */
export function useInvalidateAutomations() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.automations.all })
  }
}
