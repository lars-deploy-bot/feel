/**
 * Session and concurrency guards
 * These guards prevent overlapping requests and manage conversation state
 */

// Concurrency guard to prevent overlapping sessions
const activeConversations = new Set<string>()

/**
 * Attempt to lock a conversation to prevent concurrent requests
 * Returns true if lock was acquired, false if conversation is already in progress
 */
export function tryLockConversation(key: string): boolean {
  if (activeConversations.has(key)) {
    return false
  }
  activeConversations.add(key)
  return true
}

/**
 * Release a conversation lock after request completes
 * Should be called in finally block to ensure cleanup
 */
export function unlockConversation(key: string): void {
  activeConversations.delete(key)
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
