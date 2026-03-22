import { api } from "@/lib/api"
import type { ContainerEntry } from "./docker.types"

interface DockerListResponse {
  data: ContainerEntry[]
}

export const dockerApi = {
  list: () => api.get<DockerListResponse>("/manager/docker").then(r => r.data),
}
