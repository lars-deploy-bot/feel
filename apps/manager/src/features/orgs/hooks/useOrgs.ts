import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { orgsApi } from "../orgs.api"
import type { Organization } from "../orgs.types"

const ORGS_KEY: readonly ["orgs"] = ["orgs"]

export function useOrgs() {
  const queryClient = useQueryClient()

  const {
    data: orgs = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ORGS_KEY,
    queryFn: orgsApi.list,
    staleTime: 30_000,
  })

  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to fetch organizations") : null

  const updateCreditsMutation = useMutation({
    mutationFn: ({ orgId, credits }: { orgId: string; credits: number }) => orgsApi.updateCredits(orgId, credits),
    onSuccess: (_, { orgId, credits }) => {
      queryClient.setQueryData<Organization[]>(ORGS_KEY, prev =>
        prev?.map(org => (org.org_id === orgId ? { ...org, credits } : org)),
      )
    },
  })

  const deleteOrgMutation = useMutation({
    mutationFn: (orgId: string) => orgsApi.deleteOrg(orgId),
    onSuccess: (_, orgId) => {
      queryClient.setQueryData<Organization[]>(ORGS_KEY, prev => prev?.filter(org => org.org_id !== orgId))
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: ({ orgId, userId, role }: { orgId: string; userId: string; role: string }) =>
      orgsApi.addMember(orgId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGS_KEY })
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) => orgsApi.removeMember(orgId, userId),
    onSuccess: (_, { orgId, userId }) => {
      queryClient.setQueryData<Organization[]>(ORGS_KEY, prev =>
        prev?.map(org =>
          org.org_id === orgId
            ? {
                ...org,
                members: org.members.filter(m => m.user_id !== userId),
                member_count: org.member_count - 1,
              }
            : org,
        ),
      )
    },
  })

  const createOrgMutation = useMutation({
    mutationFn: ({ name, credits, ownerUserId }: { name: string; credits: number; ownerUserId?: string }) =>
      orgsApi.create({ name, credits, owner_user_id: ownerUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGS_KEY })
    },
  })

  return {
    orgs,
    loading,
    error,
    refresh: () => queryClient.invalidateQueries({ queryKey: ORGS_KEY }),
    updateCredits: (orgId: string, credits: number) => updateCreditsMutation.mutateAsync({ orgId, credits }),
    deleteOrg: (orgId: string) => deleteOrgMutation.mutateAsync(orgId),
    addMember: async (orgId: string, userId: string, role: string): Promise<void> => {
      await addMemberMutation.mutateAsync({ orgId, userId, role })
    },
    removeMember: async (orgId: string, userId: string): Promise<void> => {
      await removeMemberMutation.mutateAsync({ orgId, userId })
    },
    createOrg: async (name: string, credits: number, ownerUserId?: string): Promise<void> => {
      await createOrgMutation.mutateAsync({ name, credits, ownerUserId })
    },
  }
}
