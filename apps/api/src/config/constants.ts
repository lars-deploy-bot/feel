export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
} as const

export const RATE_LIMIT = {
  WINDOW_MS: 60_000,
  MAX_REQUESTS: 100,
} as const

export const AUTH = {
  COOKIE_NAME: "alive_manager",
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60, // 7 days in seconds
} as const
