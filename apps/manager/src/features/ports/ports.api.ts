import { api } from "@/lib/api"
import type { PortEntry } from "./ports.types"

interface PortsListResponse {
  data: PortEntry[]
}

export const portsApi = {
  list: () => api.get<PortsListResponse>("/manager/ports").then(r => r.data),
}
