import { api } from "@/lib/api"
import type { DiskData } from "./disk.types"

interface DiskResponse {
  data: DiskData
}

export const diskApi = {
  get: () => api.get<DiskResponse>("/manager/disk").then(r => r.data),
}
