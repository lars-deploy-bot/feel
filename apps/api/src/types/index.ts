export type { AppBindings, AppType, AppVariables, Env } from "./hono"

import type { ErrorCode } from "../infra/errors"

export interface ApiResponse<T> {
  ok: true
  data: T
}

export interface ErrorResponse {
  ok: false
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

export interface PaginatedResponse<T> {
  ok: true
  data: T[]
  cursor: string | null
  hasMore: boolean
}
