/**
 * Cancellation Registry - Simple in-memory registry for stream cancellation
 *
 * Responsibilities:
 * - Store cancellation callbacks for active streams
 * - Allow explicit cancellation via requestId
 * - Cleanup completed/cancelled streams
 */

interface CancelEntry {
  cancel: () => void
  userId: string
  conversationKey: string
  createdAt: number
}

/**
 * Global registry of active streams that can be cancelled
 * Key: requestId, Value: cancel callback + metadata
 */
const registry = new Map<string, CancelEntry>()

/**
 * Register a stream for cancellation
 */
export function registerCancellation(
  requestId: string,
  userId: string,
  conversationKey: string,
  cancel: () => void,
): void {
  registry.set(requestId, {
    cancel,
    userId,
    conversationKey,
    createdAt: Date.now(),
  })
}

/**
 * Cancel a stream by requestId
 * Returns true if stream was found and cancelled, false if not found
 * Automatically unregisters after cancelling to prevent double-cancellation
 */
export function cancelStream(requestId: string, userId: string): boolean {
  const entry = registry.get(requestId)

  if (!entry) {
    return false // Already completed or never existed
  }

  // Security: only owner can cancel
  if (entry.userId !== userId) {
    throw new Error("Unauthorized: cannot cancel another user's stream")
  }

  entry.cancel()
  registry.delete(requestId) // Auto-cleanup after cancel
  return true
}

/**
 * Cancel a stream by conversationKey (fallback when requestId not available yet)
 * Handles super-early Stop case where user clicks Stop before receiving requestId
 * Returns true if stream was found and cancelled, false if not found
 */
export function cancelStreamByConversationKey(conversationKey: string, userId: string): boolean {
  // Find the entry with matching conversationKey
  for (const [requestId, entry] of registry.entries()) {
    if (entry.conversationKey === conversationKey) {
      // Security: only owner can cancel
      if (entry.userId !== userId) {
        throw new Error("Unauthorized: cannot cancel another user's stream")
      }

      entry.cancel()
      registry.delete(requestId) // Auto-cleanup after cancel
      return true
    }
  }

  return false // No active stream found for this conversation
}

/**
 * Unregister a stream (called when stream completes)
 */
export function unregisterCancellation(requestId: string): void {
  registry.delete(requestId)
}

/**
 * Get registry size (for testing/debugging)
 */
export function getRegistrySize(): number {
  return registry.size
}

/**
 * TTL-based cleanup for orphaned entries
 * Runs every 5 minutes, removes entries older than 10 minutes
 * This is a safety net for streams that crashed or didn't clean up properly
 */
const TTL_MS = 10 * 60 * 1000 // 10 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

let cleanupInterval: NodeJS.Timeout | null = null

export function startTTLCleanup(): void {
  if (cleanupInterval) {
    return // Already running
  }

  cleanupInterval = setInterval(() => {
    const now = Date.now()
    let cleanedCount = 0

    for (const [requestId, entry] of registry) {
      if (now - entry.createdAt > TTL_MS) {
        console.warn(`[Registry TTL] Cleaning up stale entry: ${requestId} (age: ${Math.round((now - entry.createdAt) / 1000)}s)`)
        entry.cancel()
        registry.delete(requestId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Registry TTL] Cleaned up ${cleanedCount} stale entries`)
    }
  }, CLEANUP_INTERVAL_MS)

  console.log("[Registry TTL] Cleanup started (check every 5min, TTL: 10min)")
}

/**
 * Stop TTL cleanup (for testing)
 */
export function stopTTLCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}
