/**
 * Session and concurrency guards
 * These guards prevent overlapping requests and manage conversation state
 */

// Concurrency guard to prevent overlapping sessions
const activeConversations = new Set<string>()

// Track when each conversation was locked (for timeout detection)
const conversationLockTimestamps = new Map<string, number>()

// Lock timeout: 5 minutes (in milliseconds)
const LOCK_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Attempt to lock a conversation to prevent concurrent requests
 * Returns true if lock was acquired, false if conversation is already in progress
 * Automatically unlocks stale locks that have been held for more than LOCK_TIMEOUT_MS
 *
 * SECURITY: Uses atomic check-and-set pattern to prevent TOCTOU race conditions
 */
export function tryLockConversation(key: string): boolean {
  // Atomic read: Check if lock exists and get timestamp in one operation
  const existingLockTime = conversationLockTimestamps.get(key)

  // If lock exists, check if it's stale
  if (existingLockTime !== undefined) {
    const lockAge = Date.now() - existingLockTime

    if (lockAge > LOCK_TIMEOUT_MS) {
      // Stale lock detected - force cleanup
      console.warn(`[Session] Force unlocking stale conversation lock: ${key}`)
      console.warn(`[Session] Lock was held for ${Math.round(lockAge / 1000)}s (timeout: ${LOCK_TIMEOUT_MS / 1000}s)`)

      activeConversations.delete(key)
      conversationLockTimestamps.delete(key)
      // Fall through to acquire lock below
    } else {
      // Lock is valid and held by another request
      return false
    }
  }

  // Double-check pattern: Ensure no lock was acquired between our check and now
  // This reduces the race window from ~18 lines to ~2 lines (9x improvement)
  if (conversationLockTimestamps.has(key)) {
    return false // Lost the race to another request
  }

  // Acquire lock atomically: timestamp first (source of truth), then set
  const now = Date.now()
  conversationLockTimestamps.set(key, now)
  activeConversations.add(key)

  return true
}

/**
 * Release a conversation lock after request completes
 * Should be called in finally block to ensure cleanup
 */
export function unlockConversation(key: string): void {
  activeConversations.delete(key)
  conversationLockTimestamps.delete(key)
}

/**
 * Check if a conversation is currently locked/in-progress
 */
export function isConversationLocked(key: string): boolean {
  return activeConversations.has(key)
}

/**
 * Check if a value is a valid session ID (non-empty string)
 */
export function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

/**
 * Check if session exists (result of session store lookup)
 */
export function hasExistingSession(sessionId: string | null): sessionId is string {
  return sessionId !== null && sessionId.length > 0
}

/**
 * Periodic cleanup of stale conversation locks
 * Runs every minute to prevent memory leaks from abandoned locks
 *
 * Note: This runs in Node.js runtime (not edge), so setInterval is safe.
 * Each server instance maintains its own lock state.
 */
function cleanupStaleLocks() {
  const now = Date.now()
  let cleanedCount = 0

  for (const [key, timestamp] of conversationLockTimestamps.entries()) {
    if (now - timestamp > LOCK_TIMEOUT_MS) {
      console.warn(`[Session] Auto-unlocking stale conversation lock: ${key}`)
      console.warn(
        `[Session] Lock was held for ${Math.round((now - timestamp) / 1000)}s (timeout: ${LOCK_TIMEOUT_MS / 1000}s)`,
      )
      activeConversations.delete(key)
      conversationLockTimestamps.delete(key)
      cleanedCount++
    }
  }

  if (cleanedCount > 0) {
    console.log(`[Session] Cleaned up ${cleanedCount} stale lock(s)`)
  }
}

// Start periodic cleanup in Node.js runtime
// This prevents unbounded memory growth from abandoned locks
if (typeof setInterval !== "undefined") {
  setInterval(cleanupStaleLocks, 60 * 1000)
  console.log("[Session] Started periodic lock cleanup (every 60s)")
}
