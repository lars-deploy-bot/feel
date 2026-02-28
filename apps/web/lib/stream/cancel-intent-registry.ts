/**
 * Cancel Intent Registry
 *
 * Stores short-lived "stop requested" intents for super-early cancellation
 * races where the cancel endpoint is hit before the stream route registers.
 */

interface CancelIntent {
  userId: string
  createdAt: number
}

const INTENT_TTL_MS = 15_000
const intentsByConversationKey = new Map<string, CancelIntent>()

function pruneExpiredIntents(now: number): void {
  for (const [conversationKey, intent] of intentsByConversationKey.entries()) {
    if (now - intent.createdAt > INTENT_TTL_MS) {
      intentsByConversationKey.delete(conversationKey)
    }
  }
}

export function registerCancelIntent(conversationKey: string, userId: string): void {
  const now = Date.now()
  pruneExpiredIntents(now)
  intentsByConversationKey.set(conversationKey, {
    userId,
    createdAt: now,
  })
}

/**
 * Consume (remove) a pending intent if it exists and is owned by the user.
 * Returns true when an intent was consumed.
 */
export function consumeCancelIntent(conversationKey: string, userId: string): boolean {
  const now = Date.now()
  pruneExpiredIntents(now)

  const intent = intentsByConversationKey.get(conversationKey)
  if (!intent) return false
  if (intent.userId !== userId) return false

  intentsByConversationKey.delete(conversationKey)
  return true
}

export function hasCancelIntent(conversationKey: string, userId: string): boolean {
  const now = Date.now()
  pruneExpiredIntents(now)

  const intent = intentsByConversationKey.get(conversationKey)
  return !!intent && intent.userId === userId
}

export function clearCancelIntent(conversationKey: string): void {
  intentsByConversationKey.delete(conversationKey)
}

export function getCancelIntentCount(): number {
  const now = Date.now()
  pruneExpiredIntents(now)
  return intentsByConversationKey.size
}

export function clearAllCancelIntents(): void {
  intentsByConversationKey.clear()
}
