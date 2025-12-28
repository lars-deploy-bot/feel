import { beforeEach, describe, expect, it, vi } from "vitest"

// In-memory storage for mocked database
const mockSessions = new Map<string, { sdk_session_id: string }>()

// Helper to create session key for storage
function makeDbKey(userId: string, domainId: string, conversationId: string) {
  return `${userId}::${domainId}::${conversationId}`
}

// Mock Supabase clients before importing sessionStore
vi.mock("@/lib/supabase/app", () => ({
  createAppClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { domain_id: "test-domain-id" }, error: null })),
        })),
      })),
    })),
  })),
}))

vi.mock("@/lib/supabase/iam", () => ({
  createIamClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "sessions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, userId: string) => ({
              eq: vi.fn((_col: string, domainId: string) => ({
                eq: vi.fn((_col: string, conversationId: string) => ({
                  single: vi.fn(async () => {
                    const key = makeDbKey(userId, domainId, conversationId)
                    const data = mockSessions.get(key)
                    return { data: data || null, error: null }
                  }),
                })),
              })),
            })),
          })),
          upsert: vi.fn(
            async (data: { user_id: string; domain_id: string; conversation_id: string; sdk_session_id: string }) => {
              const key = makeDbKey(data.user_id, data.domain_id, data.conversation_id)
              mockSessions.set(key, { sdk_session_id: data.sdk_session_id })
              return { data: null, error: null }
            },
          ),
          delete: vi.fn(() => ({
            eq: vi.fn((_col: string, userId: string) => ({
              eq: vi.fn((_col: string, domainId: string) => ({
                eq: vi.fn(async (_col: string, conversationId: string) => {
                  const key = makeDbKey(userId, domainId, conversationId)
                  mockSessions.delete(key)
                  return { data: null, error: null }
                }),
              })),
            })),
          })),
        }
      }
      return {}
    }),
  })),
}))

import {
  SessionStoreMemory,
  sessionKey,
  tryLockConversation,
  unlockConversation,
} from "@/features/auth/lib/sessionStore"

// Use real workspace and user from migrated database (demo.goalive.nl)
const TEST_WORKSPACE = "demo.goalive.nl"
const TEST_USER_ID = "ace1261c-2b9a-4845-8d41-4f6ecab8cb37" // demo.goalive.nl user

describe("Session Store - Conversation Locking", () => {
  beforeEach(async () => {
    // Clear mock database
    mockSessions.clear()

    await SessionStoreMemory.delete(
      sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-1" }),
    )
    await SessionStoreMemory.delete(
      sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-2" }),
    )
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
      const key = sessionKey({ userId: "user1", conversationId: "conv1" })
      expect(key).toContain("default")
    })

    it("should handle special characters in parameters", () => {
      const key = sessionKey({
        userId: "user-with-dash",
        workspace: "workspace.with.dots",
        conversationId: "conv_with_underscore",
      })
      expect(key).toBeTruthy()
      expect(typeof key).toBe("string")
    })
  })

  describe("Conversation Locking", () => {
    it("should acquire lock for new conversation", () => {
      const key = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-lock-1" })
      const acquired = tryLockConversation(key)
      expect(acquired).toBe(true)
      unlockConversation(key)
    })

    it("should prevent concurrent locks", () => {
      const key = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-lock-2" })

      const first = tryLockConversation(key)
      const second = tryLockConversation(key)

      expect(first).toBe(true)
      expect(second).toBe(false)

      unlockConversation(key)
    })

    it("should release lock and allow reacquisition", () => {
      const key = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-lock-3" })

      tryLockConversation(key)
      unlockConversation(key)

      const reacquired = tryLockConversation(key)
      expect(reacquired).toBe(true)

      unlockConversation(key)
    })

    it("should handle multiple independent conversation locks", () => {
      const key1 = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-multi-1" })
      const key2 = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-multi-2" })

      const lock1 = tryLockConversation(key1)
      const lock2 = tryLockConversation(key2)

      expect(lock1).toBe(true)
      expect(lock2).toBe(true)

      unlockConversation(key1)
      unlockConversation(key2)
    })

    it("should allow same conversation for different users", () => {
      const key1 = sessionKey({ userId: "user1", workspace: TEST_WORKSPACE, conversationId: "shared-conv" })
      const key2 = sessionKey({ userId: "user2", workspace: TEST_WORKSPACE, conversationId: "shared-conv" })

      const lock1 = tryLockConversation(key1)
      const lock2 = tryLockConversation(key2)

      expect(lock1).toBe(true)
      expect(lock2).toBe(true)

      unlockConversation(key1)
      unlockConversation(key2)
    })

    it("should be idempotent when unlocking", () => {
      const key = sessionKey({
        userId: TEST_USER_ID,
        workspace: TEST_WORKSPACE,
        conversationId: "test-conv-idempotent",
      })

      tryLockConversation(key)
      unlockConversation(key)
      unlockConversation(key) // Second unlock should not throw

      const reacquired = tryLockConversation(key)
      expect(reacquired).toBe(true)

      unlockConversation(key)
    })

    it("should handle rapid lock/unlock cycles", () => {
      const key = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-rapid" })

      for (let i = 0; i < 10; i++) {
        const acquired = tryLockConversation(key)
        expect(acquired).toBe(true)
        unlockConversation(key)
      }
    })
  })

  describe("SessionStoreMemory", () => {
    beforeEach(async () => {
      // Clear memory store before each test
      await SessionStoreMemory.delete(
        sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-1" }),
      )
      await SessionStoreMemory.delete(
        sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-2" }),
      )
    })

    it("should store and retrieve session IDs", async () => {
      const key = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-store-1" })
      const sessionId = "session-abc-123"

      await SessionStoreMemory.set(key, sessionId)
      const retrieved = await SessionStoreMemory.get(key)

      expect(retrieved).toBe(sessionId)
    })

    it("should return null for non-existent keys", async () => {
      const key = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "non-existent" })
      const retrieved = await SessionStoreMemory.get(key)
      expect(retrieved).toBeNull()
    })

    it("should delete stored sessions", async () => {
      const key = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-delete" })
      const sessionId = "session-abc-123"

      await SessionStoreMemory.set(key, sessionId)
      await SessionStoreMemory.delete(key)

      const retrieved = await SessionStoreMemory.get(key)
      expect(retrieved).toBeNull()
    })

    it("should overwrite existing sessions", async () => {
      const key = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-overwrite" })

      await SessionStoreMemory.set(key, "session-1")
      await SessionStoreMemory.set(key, "session-2")

      const retrieved = await SessionStoreMemory.get(key)
      expect(retrieved).toBe("session-2")
    })

    it("should handle multiple independent sessions", async () => {
      const key1 = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-multi-a" })
      const key2 = sessionKey({ userId: TEST_USER_ID, workspace: TEST_WORKSPACE, conversationId: "test-conv-multi-b" })

      await SessionStoreMemory.set(key1, "session-1")
      await SessionStoreMemory.set(key2, "session-2")

      const retrieved1 = await SessionStoreMemory.get(key1)
      const retrieved2 = await SessionStoreMemory.get(key2)

      expect(retrieved1).toBe("session-1")
      expect(retrieved2).toBe("session-2")
    })
  })
})
