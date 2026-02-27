import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the repository before importing cache
vi.mock("../session-repository", () => ({
  isSessionRevokedInDb: vi.fn(),
}))

const { isRevoked, markRevoked, _clearCache, _getCacheSize } = await import("../session-cache")
const { isSessionRevokedInDb } = await import("../session-repository")

beforeEach(() => {
  vi.clearAllMocks()
  _clearCache()
})

afterEach(() => {
  _clearCache()
})

describe("session-cache", () => {
  it("queries DB on cache miss", async () => {
    vi.mocked(isSessionRevokedInDb).mockResolvedValue(false)

    const result = await isRevoked("sid-1")
    expect(result).toBe(false)
    expect(isSessionRevokedInDb).toHaveBeenCalledWith("sid-1")
  })

  it("caches DB result and serves from cache on next call", async () => {
    vi.mocked(isSessionRevokedInDb).mockResolvedValue(false)

    await isRevoked("sid-1")
    await isRevoked("sid-1")

    // Only one DB call — second served from cache
    expect(isSessionRevokedInDb).toHaveBeenCalledTimes(1)
  })

  it("markRevoked immediately caches as revoked", async () => {
    markRevoked("sid-2")

    // Should not hit DB at all
    const result = await isRevoked("sid-2")
    expect(result).toBe(true)
    expect(isSessionRevokedInDb).not.toHaveBeenCalled()
  })

  it("re-queries DB after TTL expires", async () => {
    vi.mocked(isSessionRevokedInDb).mockResolvedValue(false)

    await isRevoked("sid-3")
    expect(isSessionRevokedInDb).toHaveBeenCalledTimes(1)

    // Advance time past TTL (60s)
    vi.useFakeTimers()
    vi.advanceTimersByTime(61_000)

    await isRevoked("sid-3")
    expect(isSessionRevokedInDb).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })

  it("fails open when DB is unreachable", async () => {
    vi.mocked(isSessionRevokedInDb).mockRejectedValue(new Error("DB down"))

    const result = await isRevoked("sid-4")
    expect(result).toBe(false)
  })

  it("tracks cache size", () => {
    expect(_getCacheSize()).toBe(0)
    markRevoked("a")
    markRevoked("b")
    expect(_getCacheSize()).toBe(2)
    _clearCache()
    expect(_getCacheSize()).toBe(0)
  })
})
