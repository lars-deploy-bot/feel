import { createMiddleware } from "hono/factory"
import { RATE_LIMIT } from "../config/constants"
import { RateLimitError } from "../infra/errors"
import type { AppBindings } from "../types/hono"

// Sliding window: Map<ip, timestamps[]>
const windows = new Map<string, number[]>()

// Periodically clean up stale entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT.WINDOW_MS
  for (const [ip, timestamps] of windows) {
    const filtered = timestamps.filter(t => t > cutoff)
    if (filtered.length === 0) {
      windows.delete(ip)
    } else {
      windows.set(ip, filtered)
    }
  }
}, CLEANUP_INTERVAL_MS)

function getClientIp(req: Request): string {
  // Prefer X-Forwarded-For (set by Caddy/nginx), fall back to connection info
  const forwarded = req.headers.get("X-Forwarded-For")
  if (forwarded) {
    const first = forwarded.split(",")[0]
    if (first) return first.trim()
  }
  return "unknown"
}

export const rateLimitMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const ip = getClientIp(c.req.raw)
  const now = Date.now()
  const cutoff = now - RATE_LIMIT.WINDOW_MS

  const timestamps = windows.get(ip) ?? []
  const recent = timestamps.filter(t => t > cutoff)

  if (recent.length >= RATE_LIMIT.MAX_REQUESTS) {
    const oldestInWindow = recent[0] ?? now
    const retryAfterSec = Math.ceil((oldestInWindow + RATE_LIMIT.WINDOW_MS - now) / 1000)

    c.header("Retry-After", String(retryAfterSec))
    throw new RateLimitError()
  }

  recent.push(now)
  windows.set(ip, recent)

  return next()
})
