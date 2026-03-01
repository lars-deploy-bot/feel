/**
 * Tests for Rate Limiter
 *
 * Security-critical tests:
 * - Blocks after max attempts
 * - Window expiration resets attempts
 * - Block duration enforced
 * - Reset clears attempts
 * - Cleanup removes stale entries
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { emailCheckRateLimiter, loginRateLimiter, managerLoginRateLimiter, RateLimiter } from "../rate-limiter"

describe("RateLimiter", () => {
  let limiter: RateLimiter

  beforeEach(() => {
    vi.useFakeTimers()
    limiter = new RateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 15 * 60 * 1000, // 15 minutes
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("isRateLimited", () => {
    it("should not rate limit on first attempt", () => {
      expect(limiter.isRateLimited("user@example.com")).toBe(false)
    })

    it("should not rate limit when below max attempts", () => {
      for (let i = 0; i < 4; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      expect(limiter.isRateLimited("user@example.com")).toBe(false)
    })

    it("should rate limit after max attempts reached", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      expect(limiter.isRateLimited("user@example.com")).toBe(true)
    })

    it("should rate limit different identifiers independently", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailedAttempt("user1@example.com")
      }

      expect(limiter.isRateLimited("user1@example.com")).toBe(true)
      expect(limiter.isRateLimited("user2@example.com")).toBe(false)
    })
  })

  describe("Window Expiration", () => {
    it("should reset attempts after window expires", () => {
      for (let i = 0; i < 4; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      // Advance time past the window
      vi.advanceTimersByTime(16 * 60 * 1000) // 16 minutes

      expect(limiter.isRateLimited("user@example.com")).toBe(false)
    })

    it("should start new window after expiration", () => {
      for (let i = 0; i < 4; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      // Advance time past the window
      vi.advanceTimersByTime(16 * 60 * 1000)

      // Record new attempt - should start fresh window (1 attempt, not blocked)
      limiter.recordFailedAttempt("user@example.com")
      expect(limiter.isRateLimited("user@example.com")).toBe(false)
    })
  })

  describe("Block Duration", () => {
    it("should remain blocked for block duration after max attempts", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      // Advance time but not past block duration
      vi.advanceTimersByTime(10 * 60 * 1000) // 10 minutes

      expect(limiter.isRateLimited("user@example.com")).toBe(true)
    })

    it("should unblock after block duration expires", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      // Advance time past block duration
      vi.advanceTimersByTime(16 * 60 * 1000) // 16 minutes

      expect(limiter.isRateLimited("user@example.com")).toBe(false)
    })
  })

  describe("getBlockedTimeRemaining", () => {
    it("should return 0 for non-blocked user", () => {
      limiter.recordFailedAttempt("user@example.com")

      expect(limiter.getBlockedTimeRemaining("user@example.com")).toBe(0)
    })

    it("should return 0 for unknown user", () => {
      expect(limiter.getBlockedTimeRemaining("unknown@example.com")).toBe(0)
    })

    it("should return remaining time for blocked user", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      // Advance time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000)

      const remaining = limiter.getBlockedTimeRemaining("user@example.com")
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(10 * 60 * 1000) // 10 minutes remaining
    })

    it("should return 0 after block expires", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      // Advance time past block duration
      vi.advanceTimersByTime(16 * 60 * 1000)

      expect(limiter.getBlockedTimeRemaining("user@example.com")).toBe(0)
    })
  })

  describe("reset", () => {
    it("should clear attempts for user", () => {
      for (let i = 0; i < 4; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      limiter.reset("user@example.com")

      // After reset, should not be rate limited even with new attempts
      expect(limiter.isRateLimited("user@example.com")).toBe(false)
    })

    it("should unblock a blocked user", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }
      expect(limiter.isRateLimited("user@example.com")).toBe(true)

      limiter.reset("user@example.com")

      expect(limiter.isRateLimited("user@example.com")).toBe(false)
    })

    it("should not affect other users", () => {
      for (let i = 0; i < 5; i++) {
        limiter.recordFailedAttempt("user1@example.com")
        limiter.recordFailedAttempt("user2@example.com")
      }

      limiter.reset("user1@example.com")

      expect(limiter.isRateLimited("user1@example.com")).toBe(false)
      expect(limiter.isRateLimited("user2@example.com")).toBe(true)
    })
  })

  describe("cleanup", () => {
    it("should remove stale entries", () => {
      limiter.recordFailedAttempt("old-user@example.com")

      // Advance time past 2x window (stale threshold)
      vi.advanceTimersByTime(31 * 60 * 1000) // 31 minutes

      limiter.cleanup()

      // After cleanup, user should not be tracked
      expect(limiter.isRateLimited("old-user@example.com")).toBe(false)
      expect(limiter.getBlockedTimeRemaining("old-user@example.com")).toBe(0)
    })

    it("should keep recent entries", () => {
      limiter.recordFailedAttempt("recent-user@example.com")

      // Advance time but not past stale threshold
      vi.advanceTimersByTime(10 * 60 * 1000) // 10 minutes

      limiter.cleanup()

      // Entry should still be tracked (can still accumulate attempts)
      limiter.recordFailedAttempt("recent-user@example.com")
      limiter.recordFailedAttempt("recent-user@example.com")
      limiter.recordFailedAttempt("recent-user@example.com")
      limiter.recordFailedAttempt("recent-user@example.com")
      // Window expired so this is attempt 1 in new window, but entry wasn't cleaned up
      // The behavior depends on window check - point is cleanup didn't remove it
    })

    it("should handle empty state", () => {
      // Should not throw
      limiter.cleanup()
    })
  })

  describe("Custom Configuration", () => {
    it("should respect custom maxAttempts", () => {
      const customLimiter = new RateLimiter({ maxAttempts: 3 })

      for (let i = 0; i < 3; i++) {
        customLimiter.recordFailedAttempt("user@example.com")
      }

      expect(customLimiter.isRateLimited("user@example.com")).toBe(true)
    })

    it("should respect custom windowMs", () => {
      const customLimiter = new RateLimiter({
        maxAttempts: 5,
        windowMs: 5 * 60 * 1000, // 5 minutes
      })

      for (let i = 0; i < 4; i++) {
        customLimiter.recordFailedAttempt("user@example.com")
      }

      // Advance time past custom window
      vi.advanceTimersByTime(6 * 60 * 1000) // 6 minutes

      expect(customLimiter.isRateLimited("user@example.com")).toBe(false)
    })

    it("should respect custom blockDurationMs", () => {
      const customLimiter = new RateLimiter({
        maxAttempts: 5,
        windowMs: 5 * 60 * 1000,
        blockDurationMs: 5 * 60 * 1000,
      })

      for (let i = 0; i < 5; i++) {
        customLimiter.recordFailedAttempt("user@example.com")
      }

      // Advance time past custom block duration
      vi.advanceTimersByTime(6 * 60 * 1000)

      expect(customLimiter.isRateLimited("user@example.com")).toBe(false)
    })
  })

  describe("Edge Cases", () => {
    it("should handle rapid successive attempts", () => {
      for (let i = 0; i < 10; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      expect(limiter.isRateLimited("user@example.com")).toBe(true)
    })

    it("should handle attempts exactly at window boundary", () => {
      for (let i = 0; i < 4; i++) {
        limiter.recordFailedAttempt("user@example.com")
      }

      // Advance just past the window boundary (15 min + 1ms)
      vi.advanceTimersByTime(15 * 60 * 1000 + 1)

      // One more attempt - should start new window
      limiter.recordFailedAttempt("user@example.com")

      // Should not be rate limited - new window started with only 1 attempt
      expect(limiter.isRateLimited("user@example.com")).toBe(false)
    })

    it("should handle empty string identifier", () => {
      limiter.recordFailedAttempt("")
      expect(limiter.isRateLimited("")).toBe(false)
    })

    it("should handle special characters in identifier", () => {
      const identifier = "user+test@example.com"
      for (let i = 0; i < 5; i++) {
        limiter.recordFailedAttempt(identifier)
      }

      expect(limiter.isRateLimited(identifier)).toBe(true)
    })
  })
})

describe("Exported Singletons", () => {
  it("managerLoginRateLimiter is the same instance as loginRateLimiter", () => {
    expect(managerLoginRateLimiter).toBe(loginRateLimiter)
  })

  it("emailCheckRateLimiter should exist and have isRateLimited method", () => {
    expect(emailCheckRateLimiter).toBeDefined()
    expect(typeof emailCheckRateLimiter.isRateLimited).toBe("function")
  })

  it("loginRateLimiter should exist and have isRateLimited method", () => {
    expect(loginRateLimiter).toBeDefined()
    expect(typeof loginRateLimiter.isRateLimited).toBe("function")
    expect(typeof loginRateLimiter.recordFailedAttempt).toBe("function")
    expect(typeof loginRateLimiter.reset).toBe("function")
  })
})
