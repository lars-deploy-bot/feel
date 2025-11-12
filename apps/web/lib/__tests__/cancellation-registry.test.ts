import { describe, expect, test } from "vitest"
import {
  cancelStream,
  cancelStreamByConversationKey,
  getRegistrySize,
  registerCancellation,
  unregisterCancellation,
} from "../stream/cancellation-registry"

describe("Cancellation Registry", () => {
  // Note: Registry is global, so we need to be careful about test isolation
  // In a real scenario, we'd want to add a clearRegistry() function for testing

  test("should register and cancel a stream", () => {
    let cancelled = false
    const requestId = "test-request-1"
    const userId = "user-123"
    const convKey = "user-123::workspace::conv-1"

    registerCancellation(requestId, userId, convKey, () => {
      cancelled = true
    })

    expect(getRegistrySize()).toBeGreaterThanOrEqual(1)

    const result = cancelStream(requestId, userId)
    expect(result).toBe(true)
    expect(cancelled).toBe(true)
  })

  test("should return false when cancelling non-existent stream", () => {
    const result = cancelStream("non-existent-id", "user-123")
    expect(result).toBe(false)
  })

  test("should throw error when cancelling another user's stream", () => {
    let cancelled = false
    const requestId = "test-request-2"
    const ownerUserId = "user-owner"
    const attackerUserId = "user-attacker"
    const convKey = "user-owner::workspace::conv-2"

    registerCancellation(requestId, ownerUserId, convKey, () => {
      cancelled = true
    })

    expect(() => {
      cancelStream(requestId, attackerUserId)
    }).toThrow("Unauthorized")

    expect(cancelled).toBe(false)

    // Cleanup
    unregisterCancellation(requestId)
  })

  test("should unregister a stream", () => {
    const requestId = "test-request-3"
    const userId = "user-123"
    const convKey = "user-123::workspace::conv-3"

    registerCancellation(requestId, userId, convKey, () => {})

    const sizeBefore = getRegistrySize()
    unregisterCancellation(requestId)
    const sizeAfter = getRegistrySize()

    expect(sizeAfter).toBe(sizeBefore - 1)

    // Should return false when trying to cancel after unregister
    const result = cancelStream(requestId, userId)
    expect(result).toBe(false)
  })

  test("should handle multiple registrations", () => {
    const cancellations: string[] = []

    registerCancellation("req-1", "user-1", "user-1::ws::conv-1", () => cancellations.push("req-1"))
    registerCancellation("req-2", "user-1", "user-1::ws::conv-2", () => cancellations.push("req-2"))
    registerCancellation("req-3", "user-2", "user-2::ws::conv-3", () => cancellations.push("req-3"))

    cancelStream("req-1", "user-1")
    cancelStream("req-3", "user-2")

    expect(cancellations).toEqual(["req-1", "req-3"])

    // Cleanup
    unregisterCancellation("req-1")
    unregisterCancellation("req-2")
    unregisterCancellation("req-3")
  })

  test("should be idempotent for cancellation", () => {
    let cancelCount = 0
    const requestId = "test-request-4"
    const userId = "user-123"
    const convKey = "user-123::workspace::conv-4"

    registerCancellation(requestId, userId, convKey, () => {
      cancelCount++
    })

    // First cancel should work
    expect(cancelStream(requestId, userId)).toBe(true)
    expect(cancelCount).toBe(1)

    // Second cancel should return false (not found)
    expect(cancelStream(requestId, userId)).toBe(false)
    expect(cancelCount).toBe(1) // Should not increment

    // Cleanup
    unregisterCancellation(requestId)
  })

  test("should cancel stream by conversationKey (super-early Stop fallback)", () => {
    let cancelled = false
    const requestId = "test-request-5"
    const userId = "user-123"
    const convKey = "user-123::workspace::conv-5"

    registerCancellation(requestId, userId, convKey, () => {
      cancelled = true
    })

    // Cancel by conversationKey instead of requestId
    const result = cancelStreamByConversationKey(convKey, userId)
    expect(result).toBe(true)
    expect(cancelled).toBe(true)
  })

  test("should return false when cancelling non-existent conversationKey", () => {
    const result = cancelStreamByConversationKey("non-existent-key", "user-123")
    expect(result).toBe(false)
  })

  test("should throw error when cancelling another user's stream by conversationKey", () => {
    let cancelled = false
    const requestId = "test-request-6"
    const ownerUserId = "user-owner"
    const attackerUserId = "user-attacker"
    const convKey = "user-owner::workspace::conv-6"

    registerCancellation(requestId, ownerUserId, convKey, () => {
      cancelled = true
    })

    expect(() => {
      cancelStreamByConversationKey(convKey, attackerUserId)
    }).toThrow("Unauthorized")

    expect(cancelled).toBe(false)

    // Cleanup
    unregisterCancellation(requestId)
  })

  test("should handle multiple streams with same conversationKey prefix", () => {
    const cancellations: string[] = []

    // Different conversations but similar keys
    registerCancellation("req-1", "user-1", "user-1::ws::conv-abc", () => cancellations.push("req-1"))
    registerCancellation("req-2", "user-1", "user-1::ws::conv-abcd", () => cancellations.push("req-2"))
    registerCancellation("req-3", "user-2", "user-2::ws::conv-abc", () => cancellations.push("req-3"))

    // Cancel by exact conversationKey match
    const result1 = cancelStreamByConversationKey("user-1::ws::conv-abc", "user-1")
    expect(result1).toBe(true)
    expect(cancellations).toEqual(["req-1"])

    // Other streams should still be active
    const result2 = cancelStreamByConversationKey("user-1::ws::conv-abcd", "user-1")
    expect(result2).toBe(true)
    expect(cancellations).toEqual(["req-1", "req-2"])

    // Cleanup
    unregisterCancellation("req-1")
    unregisterCancellation("req-2")
    unregisterCancellation("req-3")
  })
})
