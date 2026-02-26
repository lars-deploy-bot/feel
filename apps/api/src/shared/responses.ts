import type { ErrorCode } from "../infra/errors"

export function ok<T extends Record<string, unknown>>(data: T) {
  return { ok: true as const, ...data }
}

export function err(code: ErrorCode, message: string, details?: Record<string, unknown>) {
  return {
    ok: false as const,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  }
}

export function paginated<T>(items: T[], cursor: string | null, hasMore: boolean) {
  return {
    ok: true as const,
    data: items,
    cursor,
    hasMore,
  }
}
