import { api } from "@/lib/api"
import type { Organization } from "./orgs.types"

interface OrgsListResponse {
  data: Organization[]
}

export const orgsApi = {
  list: () => api.get<OrgsListResponse>("/manager/orgs").then(r => r.data),

  create: (data: { name: string; credits?: number; owner_user_id?: string }) =>
    api.post<{ data: Organization }>("/manager/orgs", data).then(r => r.data),

  updateCredits: (orgId: string, credits: number) => api.patch(`/manager/orgs/${orgId}/credits`, { credits }),

  deleteOrg: (orgId: string) => api.delete(`/manager/orgs/${orgId}`),

  addMember: (orgId: string, userId: string, role: string) =>
    api.post(`/manager/orgs/${orgId}/members`, { user_id: userId, role }),

  removeMember: (orgId: string, userId: string) => api.delete(`/manager/orgs/${orgId}/members/${userId}`),
}
