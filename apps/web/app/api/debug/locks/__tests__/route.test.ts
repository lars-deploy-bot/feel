/**
 * Tests for GET /api/debug/locks endpoint
 *
 * This endpoint exposes conversation locks, cancellation registry, and worker pool state
 * for debugging and E2E testing. It must be blocked in production.
 *
 * Required tests:
 * - Production access blocked (returns 403)
 * - Development access returns expected structure
 * - Worker pool state (enabled/disabled modes)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tabKey } from "@/features/auth/lib/sessionStore"

// Mock session module
vi.mock("@/features/auth/types/session", () => ({
  getLockedConversations: vi.fn(),
}))

// Mock cancellation registry
vi.mock("@/lib/stream/cancellation-registry", () => ({
  getRegistryState: vi.fn(),
}))

// Mock worker pool module
vi.mock("@webalive/worker-pool", () => ({
  getWorkerPool: vi.fn(),
}))

// Import after mocking
const { GET } = await import("../route")
const { getLockedConversations } = await import("@/features/auth/types/session")
const { getRegistryState } = await import("@/lib/stream/cancellation-registry")
const { WORKER_POOL } = await import("@webalive/shared")
const { getWorkerPool } = await import("@webalive/worker-pool")

describe("GET /api/debug/locks", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock values
    vi.mocked(getLockedConversations).mockReturnValue([])
    vi.mocked(getRegistryState).mockReturnValue([])

    // Mock worker pool when WORKER_POOL.ENABLED is true
    if (WORKER_POOL.ENABLED) {
      vi.mocked(getWorkerPool).mockImplementation(
        () =>
          ({
            getStats: () => ({
              totalWorkers: 0,
              activeWorkers: 0,
              idleWorkers: 0,
              maxWorkers: 0,
              dynamicMaxWorkers: 0,
              queuedRequests: 0,
              retiredAfterCancel: 0,
              groupTerminations: 0,
              groupKillEscalations: 0,
              queueRejectedUser: 0,
              queueRejectedWorkspace: 0,
              queueRejectedGlobal: 0,
              loadShedEvents: 0,
              orphansReaped: 0,
            }),
            getWorkerInfo: () => [],
          }) as never,
      )
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("Production Access Blocked", () => {
    it("should return 403 in production environment", async () => {
      // Set production environment
      vi.stubEnv("NODE_ENV", "production")

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.ok).toBe(false)
      expect(data.error).toBe("FORBIDDEN")
      expect(data.message).toContain("don't have permission")
    })

    it("should not expose any debug information in production", async () => {
      vi.stubEnv("NODE_ENV", "production")

      const response = await GET()
      const data = await response.json()

      // Ensure no sensitive debug info is leaked
      expect(data.locks).toBeUndefined()
      expect(data.cancellationRegistry).toBeUndefined()
      expect(data.workerPool).toBeUndefined()
      expect(data.timestamp).toBeUndefined()
    })
  })

  describe("Development Access (Happy Path)", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development")
    })

    it("should return 200 in development environment", async () => {
      const response = await GET()

      expect(response.status).toBe(200)
    })

    it("should return expected JSON structure", async () => {
      vi.mocked(getLockedConversations).mockReturnValue([
        { key: tabKey({ userId: "user1", workspace: "workspace1", tabGroupId: "tg1", tabId: "conv1" }), ageMs: 1000 },
      ])
      vi.mocked(getRegistryState).mockReturnValue([
        { requestId: "req1", userId: "user1", conversationKey: "conv1", ageMs: 1000 },
      ])

      const response = await GET()
      const data = await response.json()

      // Check top-level structure
      expect(data).toHaveProperty("timestamp")
      expect(data).toHaveProperty("locks")
      expect(data).toHaveProperty("cancellationRegistry")
      expect(data).toHaveProperty("workerPool")

      // Check timestamp is valid ISO string
      expect(() => new Date(data.timestamp)).not.toThrow()
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp)

      // Check locks structure
      expect(data.locks).toHaveProperty("count")
      expect(data.locks).toHaveProperty("keys")
      expect(typeof data.locks.count).toBe("number")
      expect(Array.isArray(data.locks.keys)).toBe(true)

      // Check cancellation registry structure
      expect(data.cancellationRegistry).toHaveProperty("count")
      expect(data.cancellationRegistry).toHaveProperty("entries")
      expect(typeof data.cancellationRegistry.count).toBe("number")
      expect(Array.isArray(data.cancellationRegistry.entries)).toBe(true)
    })

    it("should return correct lock count and keys", async () => {
      const mockLocks = [
        { key: tabKey({ userId: "user1", workspace: "workspace1", tabGroupId: "tg1", tabId: "conv1" }), ageMs: 1000 },
        { key: tabKey({ userId: "user2", workspace: "workspace2", tabGroupId: "tg2", tabId: "conv2" }), ageMs: 2000 },
        { key: tabKey({ userId: "user3", workspace: "workspace3", tabGroupId: "tg3", tabId: "conv3" }), ageMs: 3000 },
      ]
      vi.mocked(getLockedConversations).mockReturnValue(mockLocks)

      const response = await GET()
      const data = await response.json()

      expect(data.locks.count).toBe(3)
      expect(data.locks.keys).toEqual(mockLocks)
    })

    it("should return correct cancellation registry entries", async () => {
      const mockEntries = [
        { requestId: "req1", userId: "user1", conversationKey: "conv1", ageMs: 1000 },
        { requestId: "req2", userId: "user2", conversationKey: "conv2", ageMs: 2000 },
      ]
      vi.mocked(getRegistryState).mockReturnValue(mockEntries)

      const response = await GET()
      const data = await response.json()

      expect(data.cancellationRegistry.count).toBe(2)
      expect(data.cancellationRegistry.entries).toEqual(mockEntries)
    })

    it("should return empty state when no locks or registry entries exist", async () => {
      vi.mocked(getLockedConversations).mockReturnValue([])
      vi.mocked(getRegistryState).mockReturnValue([])

      const response = await GET()
      const data = await response.json()

      expect(data.locks.count).toBe(0)
      expect(data.locks.keys).toEqual([])
      expect(data.cancellationRegistry.count).toBe(0)
      expect(data.cancellationRegistry.entries).toEqual([])
    })
  })

  describe("Worker Pool State", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development")
    })

    it("should return worker pool state based on WORKER_POOL.ENABLED", async () => {
      const response = await GET()
      const data = await response.json()

      // The response structure depends on WORKER_POOL.ENABLED
      expect(data.workerPool).toBeDefined()
      expect(typeof data.workerPool.enabled).toBe("boolean")

      if (!WORKER_POOL.ENABLED) {
        // When disabled, should only have enabled: false
        expect(data.workerPool).toEqual({ enabled: false })
        expect(getWorkerPool).not.toHaveBeenCalled()
      } else {
        // When enabled, should have stats and workers
        expect(data.workerPool).toHaveProperty("stats")
        expect(data.workerPool).toHaveProperty("workers")
        expect(getWorkerPool).toHaveBeenCalled()
      }
    })

    it("should include worker pool in response structure", async () => {
      const response = await GET()
      const data = await response.json()

      // Regardless of enabled state, workerPool must be in response
      expect(data).toHaveProperty("workerPool")
      expect(data.workerPool).toHaveProperty("enabled")
    })
  })

  describe("Test Environment Handling", () => {
    it("should allow access in test environment", async () => {
      vi.stubEnv("NODE_ENV", "test")

      const response = await GET()

      // test is not "production", so should be allowed
      expect(response.status).toBe(200)
    })
  })
})
