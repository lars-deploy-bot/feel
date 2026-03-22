import { api } from "@/lib/api"
import type { ServiceEntry } from "./services.types"

interface ServicesListResponse {
  data: ServiceEntry[]
}

export const servicesApi = {
  list: () => api.get<ServicesListResponse>("/manager/services").then(r => r.data),
}
