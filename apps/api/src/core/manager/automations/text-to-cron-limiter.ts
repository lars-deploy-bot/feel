/**
 * Redis-backed rate limiter for text-to-cron (Groq API).
 *
 * Sliding window per user_id: 10 requests per 60 seconds.
 * Uses Redis sorted sets for atomic, restart-safe counting.
 */

import { randomUUID } from "node:crypto"
import { createRedisClient } from "@webalive/redis"
import { env } from "../../../config/env"
import { RateLimitError } from "../../../infra/errors"

const MAX_REQUESTS = 10
const WINDOW_MS = 60_000
const KEY_PREFIX = "ratelimit:text-to-cron:"

let redis: ReturnType<typeof createRedisClient> = null

function getRedis() {
  if (!redis) {
    redis = createRedisClient(env.REDIS_URL)
  }
  return redis
}

/**
 * Check rate limit for a user. Throws RateLimitError if exceeded.
 * Records the request atomically — check and increment in one call.
 */
export async function checkTextToCronLimit(userId: string): Promise<void> {
  const client = getRedis()
  if (!client) {
    throw new Error("Redis is required for rate limiting")
  }

  const key = `${KEY_PREFIX}${userId}`
  const now = Date.now()
  const member = `${now}:${randomUUID()}`
  const windowStart = now - WINDOW_MS

  // Atomic pipeline: clean old entries, count, add new entry, set TTL
  const results = await client
    .multi()
    .zremrangebyscore(key, 0, windowStart)
    .zcard(key)
    .zadd(key, now, member)
    .expire(key, Math.ceil(WINDOW_MS / 1000))
    .exec()

  if (!results) {
    throw new Error("Redis pipeline returned null")
  }

  // results[1] is the ZCARD result: [error, count]
  const cardResult = results[1]
  if (!cardResult || cardResult[0]) throw cardResult?.[0] ?? new Error("ZCARD failed")
  const count = cardResult[1] as number

  if (count >= MAX_REQUESTS) {
    // Undo the ZADD we just did — user is over limit
    await client.zrem(key, member)
    throw new RateLimitError()
  }
}
