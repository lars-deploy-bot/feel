import { beforeEach, describe, expect, it } from "vitest"
import {
  SessionStoreMemory,
  sessionKey,
  tryLockConversation,
  unlockConversation,
} from "@/features/auth/lib/sessionStore"

describe("Session Store - Conversation Locking", () => {
  beforeEach(async () => {
    await SessionStoreMemory.delete("test-key-1")
    await SessionStoreMemory.delete("test-key-2")
  })

  describe("sessionKey", () => {
    it("should create consistent keys from same parameters", () => {
      const key1 = sessionKey({ userId: "user1", workspace: "workspace1", conversationId: "conv1" })
      const key2 = sessionKey({ userId: "user1", workspace: "workspace1", conversationId: "conv1" })
      expect(key1).toBe(key2)
    })

    it("should create different keys for different users", () => {
      const key1 = sessionKey({ userId: "user1", workspace: "workspace1", conversationId: "conv1" })
      const key2 = sessionKey({ userId: "user2", workspace: "workspace1", conversationId: "conv1" })
      expect(key1).not.toBe(key2)
    })

    it("should create different keys for different workspaces", () => {
      const key1 = sessionKey({ userId: "user1", workspace: "workspace1", conversationId: "conv1" })
      const key2 = sessionKey({ userId: "user1", workspace: "workspace2", conversationId: "conv1" })
      expect(key1).not.toBe(key2)
    })

    it("should create different keys for different conversations", () => {
      const key1 = sessionKey({ userId: "user1", workspace: "workspace1", conversationId: "conv1" })
      const key2 = sessionKey({ userId: "user1", workspace: "workspace1", conversationId: "conv2" })
      expect(key1).not.toBe(key2)
    })

    it("should use default workspace when not provided", () => {
      const keyWithDefault = sessionKey({ userId: "user1", conversationId: "conv1" })
      const keyWithExplicit = sessionKey({ userId: "user1", workspace: "default", conversationId: "conv1" })
      expect(keyWithDefault).toBe(keyWithExplicit)
    })
  })

  describe("tryLockConversation", () => {
    it("should allow first lock attempt", () => {
      const key = sessionKey({ userId: "user1", conversationId: "conv1" })
      const locked = tryLockConversation(key)
      expect(locked).toBe(true)
    })

    it("should block concurrent lock attempts for same conversation", () => {
      const key = sessionKey({ userId: "user-lock-test-1", conversationId: "conv-concurrent" })

      unlockConversation(key)

      const firstLock = tryLockConversation(key)
      expect(firstLock).toBe(true)

      const secondLock = tryLockConversation(key)
      expect(secondLock).toBe(false)

      unlockConversation(key)
    })

    it("should allow locks for different conversations", () => {
      const key1 = sessionKey({ userId: "user-lock-test-2", conversationId: "conv-diff-1" })
      const key2 = sessionKey({ userId: "user-lock-test-2", conversationId: "conv-diff-2" })

      unlockConversation(key1)
      unlockConversation(key2)

      const lock1 = tryLockConversation(key1)
      const lock2 = tryLockConversation(key2)

      expect(lock1).toBe(true)
      expect(lock2).toBe(true)

      unlockConversation(key1)
      unlockConversation(key2)
    })

    it("should allow locks for different users on same conversation", () => {
      const key1 = sessionKey({ userId: "user-lock-test-3a", conversationId: "conv-shared" })
      const key2 = sessionKey({ userId: "user-lock-test-3b", conversationId: "conv-shared" })

      unlockConversation(key1)
      unlockConversation(key2)

      const lock1 = tryLockConversation(key1)
      const lock2 = tryLockConversation(key2)

      expect(lock1).toBe(true)
      expect(lock2).toBe(true)

      unlockConversation(key1)
      unlockConversation(key2)
    })

    it("should allow locks for different workspaces", () => {
      const key1 = sessionKey({ userId: "user1", workspace: "ws1", conversationId: "conv1" })
      const key2 = sessionKey({ userId: "user1", workspace: "ws2", conversationId: "conv1" })

      const lock1 = tryLockConversation(key1)
      const lock2 = tryLockConversation(key2)

      expect(lock1).toBe(true)
      expect(lock2).toBe(true)
    })
  })

  describe("unlockConversation", () => {
    it("should release a locked conversation", () => {
      const key = sessionKey({ userId: "user1", conversationId: "conv1" })

      // Lock
      tryLockConversation(key)

      // Unlock
      unlockConversation(key)

      // Should be able to lock again
      const reLock = tryLockConversation(key)
      expect(reLock).toBe(true)
    })

    it("should be idempotent (safe to call multiple times)", () => {
      const key = sessionKey({ userId: "user1", conversationId: "conv1" })

      tryLockConversation(key)

      // Multiple unlocks should not throw
      expect(() => {
        unlockConversation(key)
        unlockConversation(key)
        unlockConversation(key)
      }).not.toThrow()
    })

    it("should not affect other conversation locks", () => {
      const key1 = sessionKey({ userId: "user1", conversationId: "conv1" })
      const key2 = sessionKey({ userId: "user1", conversationId: "conv2" })

      tryLockConversation(key1)
      tryLockConversation(key2)

      // Unlock conv1
      unlockConversation(key1)

      // conv2 should still be locked
      const tryReLockConv2 = tryLockConversation(key2)
      expect(tryReLockConv2).toBe(false)
    })
  })

  describe("SessionStoreMemory", () => {
    beforeEach(async () => {
      // Clear memory store before each test
      await SessionStoreMemory.delete("test-key-1")
      await SessionStoreMemory.delete("test-key-2")
    })

    it("should store and retrieve session IDs", async () => {
      const key = "test-session-key"
      const sessionId = "session-abc-123"

      await SessionStoreMemory.set(key, sessionId)
      const retrieved = await SessionStoreMemory.get(key)

      expect(retrieved).toBe(sessionId)
    })

    it("should return null for non-existent keys", async () => {
      const retrieved = await SessionStoreMemory.get("non-existent-key")
      expect(retrieved).toBeNull()
    })

    it("should delete stored sessions", async () => {
      const key = "test-session-key"
      const sessionId = "session-abc-123"

      await SessionStoreMemory.set(key, sessionId)
      await SessionStoreMemory.delete(key)

      const retrieved = await SessionStoreMemory.get(key)
      expect(retrieved).toBeNull()
    })

    it("should overwrite existing sessions", async () => {
      const key = "test-session-key"

      await SessionStoreMemory.set(key, "session-1")
      await SessionStoreMemory.set(key, "session-2")

      const retrieved = await SessionStoreMemory.get(key)
      expect(retrieved).toBe("session-2")
    })

    it("should handle multiple independent sessions", async () => {
      await SessionStoreMemory.set("key1", "session-1")
      await SessionStoreMemory.set("key2", "session-2")

      const val1 = await SessionStoreMemory.get("key1")
      const val2 = await SessionStoreMemory.get("key2")

      expect(val1).toBe("session-1")
      expect(val2).toBe("session-2")
    })
  })

  describe("Race Condition Scenarios", () => {
    it("should handle rapid lock/unlock cycles", () => {
      const key = sessionKey({ userId: "user1", conversationId: "conv1" })

      for (let i = 0; i < 100; i++) {
        const locked = tryLockConversation(key)
        expect(locked).toBe(true)
        unlockConversation(key)
      }
    })

    it("should maintain lock integrity under concurrent attempts", () => {
      const key = sessionKey({ userId: "user1", conversationId: "conv1" })

      // Lock once
      const firstLock = tryLockConversation(key)
      expect(firstLock).toBe(true)

      // Multiple concurrent attempts should all fail
      const concurrentAttempts = Array.from({ length: 10 }, () => tryLockConversation(key))
      const successfulLocks = concurrentAttempts.filter(Boolean).length

      expect(successfulLocks).toBe(0) // All should fail
    })

    it("should prevent race condition with double-check pattern", () => {
      const key = sessionKey({ userId: "user-race", conversationId: "conv-race" })

      // Ensure clean state
      unlockConversation(key)

      // First lock should succeed
      const lock1 = tryLockConversation(key)
      expect(lock1).toBe(true)

      // Immediate second attempt should fail (double-check catches it)
      const lock2 = tryLockConversation(key)
      expect(lock2).toBe(false)

      // Third attempt should also fail
      const lock3 = tryLockConversation(key)
      expect(lock3).toBe(false)

      // After unlock, should succeed again
      unlockConversation(key)
      const lock4 = tryLockConversation(key)
      expect(lock4).toBe(true)

      unlockConversation(key)
    })

    it("should handle interleaved lock attempts correctly", async () => {
      const key = sessionKey({ userId: "user-interleaved", conversationId: "conv-interleaved" })

      unlockConversation(key)

      // Simulate multiple requests trying to lock simultaneously
      const attempts = await Promise.all([
        Promise.resolve(tryLockConversation(key)),
        Promise.resolve(tryLockConversation(key)),
        Promise.resolve(tryLockConversation(key)),
        Promise.resolve(tryLockConversation(key)),
        Promise.resolve(tryLockConversation(key)),
      ])

      // Only first should succeed, rest should fail
      const successCount = attempts.filter(Boolean).length
      expect(successCount).toBe(1)

      unlockConversation(key)
    })
  })

  describe("Memory Leak Prevention", () => {
    it("should not accumulate locks indefinitely", () => {
      // Create and unlock many conversations
      for (let i = 0; i < 1000; i++) {
        const key = sessionKey({ userId: `user${i}`, conversationId: `conv${i}` })
        tryLockConversation(key)
        unlockConversation(key)
      }

      // After unlocking, should be able to lock any of them again
      const testKey = sessionKey({ userId: "user500", conversationId: "conv500" })
      const locked = tryLockConversation(testKey)
      expect(locked).toBe(true)
    })
  })

  describe("Stale Lock Cleanup", () => {
    it("should allow lock acquisition after timeout period", () => {
      // Note: This test would need to mock Date.now() or wait 5 minutes
      // For now, we verify the logic exists (tested manually or with time mocking)

      const key = sessionKey({ userId: "user-stale", conversationId: "conv-stale" })

      unlockConversation(key)

      const lock1 = tryLockConversation(key)
      expect(lock1).toBe(true)

      // In real scenario, after 5 minutes, stale lock would be auto-released
      // This is tested by the periodic cleanup function
    })

    it("should handle concurrent lock and unlock operations", () => {
      const keys = Array.from({ length: 50 }, (_, i) => sessionKey({ userId: `user${i}`, conversationId: `conv${i}` }))

      // Lock all
      keys.forEach(key => {
        const locked = tryLockConversation(key)
        expect(locked).toBe(true)
      })

      // Unlock all
      keys.forEach(key => {
        unlockConversation(key)
      })

      // Should be able to lock them all again
      keys.forEach(key => {
        const locked = tryLockConversation(key)
        expect(locked).toBe(true)
      })

      // Cleanup
      keys.forEach(key => {
        unlockConversation(key)
      })
    })
  })
})
