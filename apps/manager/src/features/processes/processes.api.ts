import { api } from "@/lib/api"
import type { ProcessEntry } from "./processes.types"

interface ProcessesListResponse {
  data: ProcessEntry[]
}

export const processesApi = {
  list: () => api.get<ProcessesListResponse>("/manager/processes").then(r => r.data),
}
