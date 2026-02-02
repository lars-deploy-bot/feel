/**
 * Tests for session recovery when worker restarts cause "No conversation found" errors
 *
 * Problem: Workers create ephemeral temp HOME directories. When workers restart,
 * session files are lost, but session IDs remain in the store. This causes
 * "No conversation found with session ID" errors when trying to resume.
 *
 * Solution: Detect this error, clear the stale session, and retry without resume.
 *
 * These tests verify the recovery logic works correctly WITHOUT making real API calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"

// Types for our mocks
interface MockQueryOptions {
  requestId: string
  payload: {
    message: string
    resume?: string
    [key: string]: unknown
  }
  onMessage: (msg: unknown) => void
  signal?: AbortSignal
}

interface MockSessionStore {
  get: Mock<() => Promise<string | null>>
  set: Mock<(key: string, value: string) => Promise<void>>
  delete: Mock<(key: string) => Promise<void>>
}

interface MockWorkerPool {
  query: Mock<(opts: unknown) => Promise<{ success: boolean }>>
}

describe("Session Recovery - No conversation found", () => {
  let mockSessionStore: MockSessionStore
  let mockWorkerPool: MockWorkerPool
  let queryCallCount: number
  let lastQueryPayload: MockQueryOptions["payload"] | null

  beforeEach(() => {
    vi.clearAllMocks()
    queryCallCount = 0
    lastQueryPayload = null

    // Mock session store
    mockSessionStore = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    }

    // Mock worker pool
    mockWorkerPool = {
      query: vi.fn(),
    }
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  /**
   * Simulates the session recovery logic from route.ts
   * This is the core logic we're testing, extracted for unit testing
   */
  async function runQueryWithSessionRecovery(
    existingSessionId: string | null,
    sessionKey: string,
  ): Promise<{ success: boolean; retried: boolean; error?: string }> {
    const runQuery = async (resumeId: string | undefined) => {
      queryCallCount++
      lastQueryPayload = {
        message: "test message",
        resume: resumeId,
      }

      // Simulate the worker pool query
      return mockWorkerPool.query({
        requestId: "test-request-id",
        payload: lastQueryPayload,
      })
    }

    try {
      await runQuery(existingSessionId || undefined)
      return { success: true, retried: false }
    } catch (err) {
      // This is the exact logic from route.ts
      const errorMessage = err instanceof Error ? err.message : String(err)
      const isSessionNotFound =
        errorMessage.includes("No conversation found") ||
        (errorMessage.includes("session") && errorMessage.includes("not found"))

      if (isSessionNotFound && existingSessionId && sessionKey) {
        try {
          // Clear stale session from store
          await mockSessionStore.delete(sessionKey)

          // Retry without resume - start fresh conversation
          await runQuery(undefined)
          return { success: true, retried: true }
        } catch (retryErr) {
          return {
            success: false,
            retried: true,
            error: retryErr instanceof Error ? retryErr.message : String(retryErr),
          }
        }
      }

      return {
        success: false,
        retried: false,
        error: errorMessage,
      }
    }
  }

  describe("when session exists and worker returns 'No conversation found'", () => {
    it("should clear stale session and retry without resume", async () => {
      const existingSessionId = "stale-session-abc123"
      const sessionKey = "user::workspace::tab"

      // First call fails with "No conversation found"
      // Second call (retry) succeeds
      mockWorkerPool.query
        .mockRejectedValueOnce(new Error("No conversation found with session ID stale-session-abc123"))
        .mockResolvedValueOnce({ success: true })

      const result = await runQueryWithSessionRecovery(existingSessionId, sessionKey)

      // Should have retried
      expect(result.success).toBe(true)
      expect(result.retried).toBe(true)

      // Should have called query twice
      expect(queryCallCount).toBe(2)

      // Should have deleted stale session
      expect(mockSessionStore.delete).toHaveBeenCalledWith(sessionKey)
      expect(mockSessionStore.delete).toHaveBeenCalledTimes(1)

      // Second call should NOT have resume
      expect(lastQueryPayload?.resume).toBeUndefined()
    })

    it("should detect various 'session not found' error messages", async () => {
      const sessionKey = "user::workspace::tab"
      // These are the error patterns that SHOULD trigger recovery
      // Based on Claude SDK actual error messages
      const errorVariants = [
        "No conversation found with session ID abc123",
        "No conversation found",
        "session not found", // lowercase matches
      ]

      for (const errorMessage of errorVariants) {
        // Reset state for each iteration
        mockWorkerPool.query.mockReset()
        mockSessionStore.delete.mockReset()
        queryCallCount = 0

        mockWorkerPool.query.mockRejectedValueOnce(new Error(errorMessage)).mockResolvedValueOnce({ success: true })

        const result = await runQueryWithSessionRecovery("old-session", sessionKey)

        expect(result.retried).toBe(true)
        expect(result.success).toBe(true)
        expect(mockSessionStore.delete).toHaveBeenCalledWith(sessionKey)
      }
    })

    it("should propagate error if retry also fails", async () => {
      const existingSessionId = "stale-session-abc123"
      const sessionKey = "user::workspace::tab"

      // Both calls fail
      mockWorkerPool.query
        .mockRejectedValueOnce(new Error("No conversation found"))
        .mockRejectedValueOnce(new Error("API rate limit exceeded"))

      const result = await runQueryWithSessionRecovery(existingSessionId, sessionKey)

      expect(result.success).toBe(false)
      expect(result.retried).toBe(true)
      expect(result.error).toBe("API rate limit exceeded")
      expect(queryCallCount).toBe(2)
    })
  })

  describe("when no existing session", () => {
    it("should not attempt recovery for new conversations", async () => {
      mockWorkerPool.query.mockResolvedValueOnce({ success: true })

      const result = await runQueryWithSessionRecovery(null, "user::workspace::tab")

      expect(result.success).toBe(true)
      expect(result.retried).toBe(false)
      expect(queryCallCount).toBe(1)
      expect(mockSessionStore.delete).not.toHaveBeenCalled()
    })
  })

  describe("when error is NOT session-related", () => {
    it("should not retry for API errors", async () => {
      const existingSessionId = "valid-session"
      const sessionKey = "user::workspace::tab"

      mockWorkerPool.query.mockRejectedValueOnce(new Error("API key invalid"))

      const result = await runQueryWithSessionRecovery(existingSessionId, sessionKey)

      expect(result.success).toBe(false)
      expect(result.retried).toBe(false)
      expect(result.error).toBe("API key invalid")
      expect(queryCallCount).toBe(1)
      expect(mockSessionStore.delete).not.toHaveBeenCalled()
    })

    it("should not retry for rate limit errors", async () => {
      mockWorkerPool.query.mockRejectedValueOnce(new Error("Rate limit exceeded"))

      const result = await runQueryWithSessionRecovery("valid-session", "user::workspace::tab")

      expect(result.success).toBe(false)
      expect(result.retried).toBe(false)
      expect(mockSessionStore.delete).not.toHaveBeenCalled()
    })

    it("should not retry for network errors", async () => {
      mockWorkerPool.query.mockRejectedValueOnce(new Error("ECONNREFUSED"))

      const result = await runQueryWithSessionRecovery("valid-session", "user::workspace::tab")

      expect(result.success).toBe(false)
      expect(result.retried).toBe(false)
      expect(mockSessionStore.delete).not.toHaveBeenCalled()
    })
  })

  describe("edge cases", () => {
    it("should handle missing sessionKey gracefully", async () => {
      mockWorkerPool.query.mockRejectedValueOnce(new Error("No conversation found"))

      // sessionKey is empty string (falsy)
      const result = await runQueryWithSessionRecovery("stale-session", "")

      // Should NOT retry because sessionKey is falsy
      expect(result.success).toBe(false)
      expect(result.retried).toBe(false)
      expect(mockSessionStore.delete).not.toHaveBeenCalled()
    })

    it("should handle non-Error thrown values", async () => {
      mockWorkerPool.query
        .mockRejectedValueOnce("No conversation found") // string, not Error
        .mockResolvedValueOnce({ success: true })

      const result = await runQueryWithSessionRecovery("stale-session", "user::workspace::tab")

      // Should still detect and retry
      expect(result.success).toBe(true)
      expect(result.retried).toBe(true)
    })
  })
})

describe("Session Recovery - Error Detection Patterns", () => {
  /**
   * Test the exact error detection logic used in route.ts
   */
  function isSessionNotFoundError(errorMessage: string): boolean {
    return (
      errorMessage.includes("No conversation found") ||
      (errorMessage.includes("session") && errorMessage.includes("not found"))
    )
  }

  it("should match Claude SDK session errors", () => {
    // These are the actual error messages from Claude SDK
    expect(isSessionNotFoundError("No conversation found with session ID abc123")).toBe(true)
    expect(isSessionNotFoundError("No conversation found")).toBe(true)
  })

  it("should match lowercase session errors", () => {
    // Only lowercase "session" matches due to case-sensitive check
    expect(isSessionNotFoundError("session not found")).toBe(true)
    expect(isSessionNotFoundError("the session was not found")).toBe(true)
  })

  it("should NOT match uppercase Session (case-sensitive)", () => {
    // The current implementation is case-sensitive for "session"
    // This documents the actual behavior - if we want case-insensitive,
    // we'd need to update the production code
    expect(isSessionNotFoundError("Session not found")).toBe(false)
  })

  it("should NOT match unrelated errors", () => {
    expect(isSessionNotFoundError("API key invalid")).toBe(false)
    expect(isSessionNotFoundError("Rate limit exceeded")).toBe(false)
    expect(isSessionNotFoundError("Network error")).toBe(false)
    expect(isSessionNotFoundError("session expired")).toBe(false) // different error type
    expect(isSessionNotFoundError("conversation timeout")).toBe(false)
  })
})
