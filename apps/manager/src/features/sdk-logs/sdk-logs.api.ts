import { api } from "@/lib/api"

export interface LogFile {
  name: string
  size: number
  mtime: number
}

interface ListResponse {
  files: LogFile[]
}

interface ReadResponse {
  lines: unknown[]
}

interface HealthResponse {
  ok: boolean
  logsDir?: string
  callCount?: number
  error?: string
}

export const sdkLogsApi = {
  list: () => api.get<ListResponse>("/manager/sdk-logs").then(r => r.files),
  read: (file: string) =>
    api.get<ReadResponse>(`/manager/sdk-logs/read?file=${encodeURIComponent(file)}`).then(r => r.lines),
  health: () => api.get<HealthResponse>("/manager/sdk-logs/health"),
}
