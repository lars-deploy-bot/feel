import { api } from "@/lib/api"
import type { OrgAutomationSummary } from "./automations.types"

interface AutomationsListResponse {
  data: OrgAutomationSummary[]
}

export const automationsApi = {
  list: () => api.get<AutomationsListResponse>("/manager/automations").then(r => r.data),
}
