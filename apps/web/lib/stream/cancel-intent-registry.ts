/**
 * Cancel Intent Registry
 *
 * Process-safe storage for short-lived "stop requested" intents.
 * Primary use:
 * - super-early cancellation race (cancel arrives before stream registers)
 * - cross-process cancellation when stream/cancel hit different Bun workers
 *
 * Backing store:
 * - Redis (production, shared across processes)
 * - In-memory fallback (standalone/tests)
 */

import { getRedisUrl } from "@webalive/env/server"
import { createRedisClient } from "@webalive/redis"

interface CancelIntent {
  userId: string
  createdAt: number
}

function isCancelIntent(value: unknown): value is CancelIntent {
  if (!value || typeof value !== "object") return false
  return typeof Reflect.get(value, "userId") === "string" && typeof Reflect.get(value, "createdAt") === "number"
}

const INTENT_TTL_MS = 15_000
const INTENT_TTL_SECONDS = Math.ceil(INTENT_TTL_MS / 1000)
const INTENT_KEY_PREFIX = "stream-cancel-intent:"
type IntentScope = "conversation" | "request"

// In-memory fallback (used when Redis is unavailable, e.g. standalone/tests)
const memoryIntents = new Map<string, CancelIntent>()

let redisClient: ReturnType<typeof createRedisClient> | null = null
let redisInitialized = false

function getRedis() {
  if (!redisInitialized) {
    redisClient = createRedisClient(getRedisUrl())
    redisInitialized = true
  }
  // ioredis with maxRetriesPerRequest:null queues commands forever while connecting.
  // Return null when not ready so withRedisFallback uses the in-memory path.
  if (redisClient && redisClient.status !== "ready") {
    return null
  }
  return redisClient
}

function buildScopeKey(scope: IntentScope, id: string): string {
  return `${scope}:${id}`
}

function buildRedisKey(scope: IntentScope, id: string): string {
  return `${INTENT_KEY_PREFIX}${buildScopeKey(scope, id)}`
}

function pruneExpiredMemoryIntents(now: number): void {
  for (const [key, intent] of memoryIntents.entries()) {
    if (now - intent.createdAt > INTENT_TTL_MS) {
      memoryIntents.delete(key)
    }
  }
}

type RedisClient = NonNullable<ReturnType<typeof getRedis>>

async function withRedisFallback<T>(
  operation: (redis: RedisClient) => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  const redis = getRedis()
  if (!redis) return fallback()
  try {
    return await operation(redis)
  } catch {
    return fallback()
  }
}

async function registerIntent(scope: IntentScope, id: string, userId: string): Promise<void> {
  const now = Date.now()
  const key = buildRedisKey(scope, id)
  const payload: CancelIntent = { userId, createdAt: now }

  await withRedisFallback(
    async redis => {
      await redis.setex(key, INTENT_TTL_SECONDS, JSON.stringify(payload))
    },
    () => {
      pruneExpiredMemoryIntents(now)
      memoryIntents.set(buildScopeKey(scope, id), { userId, createdAt: now })
    },
  )
}

const CONSUME_INTENT_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end

local decoded = cjson.decode(raw)
if decoded.userId ~= ARGV[1] then return -1 end

redis.call('DEL', KEYS[1])
return 1
`

async function consumeIntent(scope: IntentScope, id: string, userId: string): Promise<boolean> {
  const now = Date.now()
  const scopeKey = buildScopeKey(scope, id)
  const key = buildRedisKey(scope, id)

  return withRedisFallback(
    async redis => {
      const result = await redis.eval(CONSUME_INTENT_SCRIPT, 1, key, userId)
      return result === 1
    },
    () => {
      pruneExpiredMemoryIntents(now)
      const intent = memoryIntents.get(scopeKey)
      if (!intent || intent.userId !== userId) return false
      memoryIntents.delete(scopeKey)
      return true
    },
  )
}

async function hasIntent(scope: IntentScope, id: string, userId: string): Promise<boolean> {
  const now = Date.now()
  const scopeKey = buildScopeKey(scope, id)
  const key = buildRedisKey(scope, id)

  return withRedisFallback(
    async redis => {
      const raw = await redis.get(key)
      if (!raw) return false
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!isCancelIntent(parsed)) return false
        return parsed.userId === userId
      } catch {
        return false
      }
    },
    () => {
      pruneExpiredMemoryIntents(now)
      const intent = memoryIntents.get(scopeKey)
      return !!intent && intent.userId === userId
    },
  )
}

async function clearIntent(scope: IntentScope, id: string): Promise<void> {
  const scopeKey = buildScopeKey(scope, id)

  await withRedisFallback(
    async redis => {
      await redis.del(buildRedisKey(scope, id))
    },
    () => {
      memoryIntents.delete(scopeKey)
    },
  )
}

/**
 * Register a cancel intent by conversation key.
 */
export async function registerCancelIntent(conversationKey: string, userId: string): Promise<void> {
  await registerIntent("conversation", conversationKey, userId)
}

/**
 * Register a cancel intent by requestId.
 * Used when a cancel call targets requestId but lands on another process.
 */
export async function registerCancelIntentByRequestId(requestId: string, userId: string): Promise<void> {
  await registerIntent("request", requestId, userId)
}

/**
 * Consume (remove) a pending conversation intent if it exists and belongs to user.
 */
export async function consumeCancelIntent(conversationKey: string, userId: string): Promise<boolean> {
  return consumeIntent("conversation", conversationKey, userId)
}

/**
 * Consume (remove) a pending request-scoped intent if it exists and belongs to user.
 */
export async function consumeCancelIntentByRequestId(requestId: string, userId: string): Promise<boolean> {
  return consumeIntent("request", requestId, userId)
}

export async function hasCancelIntent(conversationKey: string, userId: string): Promise<boolean> {
  return hasIntent("conversation", conversationKey, userId)
}

export async function hasCancelIntentByRequestId(requestId: string, userId: string): Promise<boolean> {
  return hasIntent("request", requestId, userId)
}

export async function clearCancelIntent(conversationKey: string): Promise<void> {
  await clearIntent("conversation", conversationKey)
}

export async function clearCancelIntentByRequestId(requestId: string): Promise<void> {
  await clearIntent("request", requestId)
}

export async function getCancelIntentCount(): Promise<number> {
  const now = Date.now()

  return withRedisFallback(
    async redis => {
      const keys = await redis.keys(`${INTENT_KEY_PREFIX}*`)
      return keys.length
    },
    () => {
      pruneExpiredMemoryIntents(now)
      return memoryIntents.size
    },
  )
}

/**
 * Test helper: clears in-memory intents only.
 * Redis-backed intents are TTL-managed; tests in this repo run without Redis.
 */
export function clearAllCancelIntents(): void {
  memoryIntents.clear()
}
