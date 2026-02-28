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

async function registerIntent(scope: IntentScope, id: string, userId: string): Promise<void> {
  const redis = getRedis()
  const now = Date.now()

  if (!redis) {
    pruneExpiredMemoryIntents(now)
    memoryIntents.set(buildScopeKey(scope, id), {
      userId,
      createdAt: now,
    })
    return
  }

  const key = buildRedisKey(scope, id)
  const payload: CancelIntent = { userId, createdAt: now }
  await redis.setex(key, INTENT_TTL_SECONDS, JSON.stringify(payload))
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
  const redis = getRedis()
  const now = Date.now()
  const scopeKey = buildScopeKey(scope, id)

  if (!redis) {
    pruneExpiredMemoryIntents(now)
    const intent = memoryIntents.get(scopeKey)
    if (!intent || intent.userId !== userId) {
      return false
    }
    memoryIntents.delete(scopeKey)
    return true
  }

  const key = buildRedisKey(scope, id)
  const result = await redis.eval(CONSUME_INTENT_SCRIPT, 1, key, userId)
  return result === 1
}

async function hasIntent(scope: IntentScope, id: string, userId: string): Promise<boolean> {
  const redis = getRedis()
  const now = Date.now()
  const scopeKey = buildScopeKey(scope, id)

  if (!redis) {
    pruneExpiredMemoryIntents(now)
    const intent = memoryIntents.get(scopeKey)
    return !!intent && intent.userId === userId
  }

  const key = buildRedisKey(scope, id)
  const raw = await redis.get(key)
  if (!raw) return false

  try {
    const parsed = JSON.parse(raw) as Partial<CancelIntent>
    return parsed.userId === userId
  } catch {
    return false
  }
}

async function clearIntent(scope: IntentScope, id: string): Promise<void> {
  const redis = getRedis()
  const scopeKey = buildScopeKey(scope, id)

  if (!redis) {
    memoryIntents.delete(scopeKey)
    return
  }

  await redis.del(buildRedisKey(scope, id))
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
  const redis = getRedis()
  const now = Date.now()

  if (!redis) {
    pruneExpiredMemoryIntents(now)
    return memoryIntents.size
  }

  const keys = await redis.keys(`${INTENT_KEY_PREFIX}*`)
  return keys.length
}

/**
 * Test helper: clears in-memory intents only.
 * Redis-backed intents are TTL-managed; tests in this repo run without Redis.
 */
export function clearAllCancelIntents(): void {
  memoryIntents.clear()
}
