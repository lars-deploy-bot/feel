import { delly, patchy, postty } from "@/lib/api/api-client"
import { validateRequest } from "@/lib/api/schemas"

export const agentsApi = {
  update: async (id: string, fields: Record<string, unknown>): Promise<void> => {
    const body = validateRequest("automations/update", fields)
    await patchy("automations/update", body, undefined, `/api/automations/${id}`)
  },

  setActive: async (id: string, isActive: boolean): Promise<void> => {
    const body = validateRequest("automations/update", { is_active: isActive })
    await patchy("automations/update", body, undefined, `/api/automations/${id}`)
  },

  trigger: async (id: string): Promise<void> => {
    const body = validateRequest("automations/trigger")
    await postty("automations/trigger", body, undefined, `/api/automations/${id}/trigger`)
  },

  delete: async (id: string): Promise<void> => {
    const body = validateRequest("automations/delete")
    await delly("automations/delete", body, `/api/automations/${id}`)
  },
}
