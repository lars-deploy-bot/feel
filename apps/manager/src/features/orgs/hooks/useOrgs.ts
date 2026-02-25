import { useCallback, useEffect, useState } from "react"
import { orgsApi } from "../orgs.api"
import type { Organization } from "../orgs.types"

export function useOrgs() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await orgsApi.list()
      setOrgs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch organizations")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  const updateCredits = useCallback(async (orgId: string, credits: number) => {
    await orgsApi.updateCredits(orgId, credits)
    setOrgs(prev => prev.map(org => (org.org_id === orgId ? { ...org, credits } : org)))
  }, [])

  const deleteOrg = useCallback(async (orgId: string) => {
    await orgsApi.deleteOrg(orgId)
    setOrgs(prev => prev.filter(org => org.org_id !== orgId))
  }, [])

  const addMember = useCallback(
    async (orgId: string, userId: string, role: string) => {
      await orgsApi.addMember(orgId, userId, role)
      await fetchOrgs()
    },
    [fetchOrgs],
  )

  const removeMember = useCallback(async (orgId: string, userId: string) => {
    await orgsApi.removeMember(orgId, userId)
    setOrgs(prev =>
      prev.map(org =>
        org.org_id === orgId
          ? {
              ...org,
              members: org.members.filter(m => m.user_id !== userId),
              member_count: org.member_count - 1,
            }
          : org,
      ),
    )
  }, [])

  const createOrg = useCallback(
    async (name: string, credits: number, ownerUserId?: string) => {
      await orgsApi.create({ name, credits, owner_user_id: ownerUserId })
      await fetchOrgs()
    },
    [fetchOrgs],
  )

  return {
    orgs,
    loading,
    error,
    refresh: fetchOrgs,
    updateCredits,
    deleteOrg,
    addMember,
    removeMember,
    createOrg,
  }
}
