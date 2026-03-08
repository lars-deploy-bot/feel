import { api } from "@/lib/api"
import type { OrgAutomationSummary } from "./automations.types"

interface AutomationsListResponse {
  data: OrgAutomationSummary[]
}

interface TextToCronResponse {
  data: { cron: string; timezone: string | null }
}

export interface UpdateJobPayload {
  name?: string
  description?: string | null
  action_prompt?: string | null
  action_model?: string | null
  action_target_page?: string | null
  cron_schedule?: string | null
  cron_timezone?: string | null
}

export const automationsApi = {
  list: () => api.get<AutomationsListResponse>("/manager/automations").then(r => r.data),
  setActive: (id: string, isActive: boolean) => api.patch(`/manager/automations/${id}/active`, { is_active: isActive }),
  update: (id: string, fields: UpdateJobPayload) => api.patch(`/manager/automations/${id}`, fields),
  delete: (id: string) => api.delete(`/manager/automations/${id}`),
  textToCron: (text: string) =>
    api.post<TextToCronResponse>("/manager/automations/text-to-cron", { text }).then(r => r.data),
}
