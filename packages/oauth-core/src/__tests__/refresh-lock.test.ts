import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InMemoryRefreshLockManager } from "../refresh-lock"

describe("InMemoryRefreshLockManager", () => {
  let lockManager: InMemoryRefreshLockManager

  beforeEach(() => {
    lockManager = new InMemoryRefreshLockManager(false)
  })

  afterEach(() => {
    lockManager.clearAll()
  })

  // ---------------------------------------------------------------
  // Basic lock/unlock lifecycle
  // ---------------------------------------------------------------

  it("executes refreshFn and returns its result", async () => {
    const result = await lockManager.withLock("user:google", async () => "new-access-token")
    expect(result).toBe("new-access-token")
  })

  it("cleans up lock after refreshFn resolves", async () => {
    expect(lockManager.getActiveLockCount()).toBe(0)
    await lockManager.withLock("user:google", async () => "token")
    expect(lockManager.getActiveLockCount()).toBe(0)
  })

  it("cleans up lock after refreshFn rejects", async () => {
    await expect(
      lockManager.withLock("user:google", async () => {
        throw new Error("provider error")
      }),
    ).rejects.toThrow("provider error")

    expect(lockManager.getActiveLockCount()).toBe(0)
  })

  // ---------------------------------------------------------------
  // Concurrent callers get the SAME promise (deduplication)
  // ---------------------------------------------------------------

  it("coalesces concurrent calls for the same key into one execution", async () => {
    let callCount = 0
    const slowRefresh = () =>
      new Promise<string>(resolve => {
        callCount++
        setTimeout(() => resolve(`token-${callCount}`), 50)
      })

    // Fire 5 concurrent requests for the same key
    const results = await Promise.all([
      lockManager.withLock("user:google", slowRefresh),
      lockManager.withLock("user:google", slowRefresh),
      lockManager.withLock("user:google", slowRefresh),
      lockManager.withLock("user:google", slowRefresh),
      lockManager.withLock("user:google", slowRefresh),
    ])

    // The refresh function should only have been called ONCE
    expect(callCount).toBe(1)
    // All callers get the same result
    expect(new Set(results).size).toBe(1)
    expect(results[0]).toBe("token-1")
  })

  it("does NOT coalesce calls for different keys", async () => {
    let callCount = 0
    const refresh = async () => {
      callCount++
      return `token-${callCount}`
    }

    const [a, b] = await Promise.all([
      lockManager.withLock("user1:google", refresh),
      lockManager.withLock("user2:google", refresh),
    ])

    expect(callCount).toBe(2)
    expect(a).not.toBe(b)
  })

  // ---------------------------------------------------------------
  // When the shared promise rejects, ALL waiters get the error
  // ---------------------------------------------------------------

  it("propagates rejection to all concurrent waiters", async () => {
    const failingRefresh = () =>
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error("invalid_grant")), 20)
      })

    const promises = [
      lockManager.withLock("user:google", failingRefresh),
      lockManager.withLock("user:google", failingRefresh),
      lockManager.withLock("user:google", failingRefresh),
    ]

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      expect(result.status).toBe("rejected")
      if (result.status === "rejected") {
        expect(result.reason.message).toBe("invalid_grant")
      }
    }
  })

  // ---------------------------------------------------------------
  // Stale lock cleanup
  // ---------------------------------------------------------------

  it("removes stale locks older than 30s and allows new refresh", async () => {
    // Start a long-running "stuck" refresh that never resolves
    const neverResolves = new Promise<string>(() => {
      /* intentionally never resolves */
    })
    // Don't await — just register it
    const stuckPromise = lockManager.withLock("user:google", () => neverResolves)

    expect(lockManager.getActiveLockCount()).toBe(1)

    // Fast-forward time by 31 seconds
    vi.useFakeTimers()
    vi.advanceTimersByTime(31_000)

    // The stale lock should be cleaned up, allowing a new refresh
    const result = await lockManager.withLock("user:google", async () => "fresh-token")
    expect(result).toBe("fresh-token")

    vi.useRealTimers()
    // The stuck promise is abandoned — that's fine, it's been cleaned up
    void stuckPromise
  })

  // ---------------------------------------------------------------
  // clearAll
  // ---------------------------------------------------------------

  it("clearAll removes all active locks", async () => {
    // Start some locks that won't resolve quickly
    const pending1 = lockManager.withLock(
      "a",
      () => new Promise<string>(resolve => setTimeout(() => resolve("a"), 100)),
    )
    const pending2 = lockManager.withLock(
      "b",
      () => new Promise<string>(resolve => setTimeout(() => resolve("b"), 100)),
    )

    expect(lockManager.getActiveLockCount()).toBe(2)
    lockManager.clearAll()
    expect(lockManager.getActiveLockCount()).toBe(0)

    // Wait for the original promises to settle
    await Promise.allSettled([pending1, pending2])
  })

  // ---------------------------------------------------------------
  // Sequential refresh after previous one completes
  // ---------------------------------------------------------------

  it("allows a new refresh after the previous one completes", async () => {
    const result1 = await lockManager.withLock("user:google", async () => "token-v1")
    const result2 = await lockManager.withLock("user:google", async () => "token-v2")

    expect(result1).toBe("token-v1")
    expect(result2).toBe("token-v2")
  })

  // ---------------------------------------------------------------
  // Warning on multi-instance use
  // ---------------------------------------------------------------

  it("logs a warning when created with warnOnUse=true", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    new InMemoryRefreshLockManager(true)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("in-memory locks"))
    warnSpy.mockRestore()
  })

  it("does not log a warning when created with warnOnUse=false", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    new InMemoryRefreshLockManager(false)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
