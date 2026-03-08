import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock Redis so we don't need a real connection
const mockCreateRedisClient = vi.hoisted(() => vi.fn())
vi.mock("@webalive/redis", () => ({
  createRedisClient: mockCreateRedisClient,
}))

// We need to reset the module singletons between tests
// The factory uses module-level singletons, so we re-import fresh each time

describe("createRefreshLockManager", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.REFRESH_LOCK_STRATEGY
    delete process.env.REDIS_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  async function importFactory() {
    const mod = await import("../refresh-lock")
    return mod
  }

  it("strategy 'memory' creates InMemoryRefreshLockManager", async () => {
    const { createRefreshLockManager, InMemoryRefreshLockManager } = await importFactory()
    const manager = createRefreshLockManager({ strategy: "memory" })
    expect(manager).toBeInstanceOf(InMemoryRefreshLockManager)
  })

  it("strategy 'redis' throws when no redisUrl provided", async () => {
    const { createRefreshLockManager } = await importFactory()
    expect(() => createRefreshLockManager({ strategy: "redis" })).toThrow(
      "REFRESH_LOCK_STRATEGY=redis requires REDIS_URL",
    )
  })

  it("strategy 'redis' creates RedisRefreshLockManager when redisUrl provided", async () => {
    mockCreateRedisClient.mockReturnValue({})
    const { createRefreshLockManager, RedisRefreshLockManager } = await importFactory()
    const manager = createRefreshLockManager({ strategy: "redis", redisUrl: "redis://localhost:6379" })
    expect(manager).toBeInstanceOf(RedisRefreshLockManager)
  })

  it("strategy 'auto' uses Redis when REDIS_URL is set", async () => {
    mockCreateRedisClient.mockReturnValue({})
    process.env.REDIS_URL = "redis://localhost:6379"
    const { createRefreshLockManager, RedisRefreshLockManager } = await importFactory()
    const manager = createRefreshLockManager({ strategy: "auto" })
    expect(manager).toBeInstanceOf(RedisRefreshLockManager)
  })

  it("strategy 'auto' falls back to memory with warning when no REDIS_URL", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { createRefreshLockManager, InMemoryRefreshLockManager } = await importFactory()
    const manager = createRefreshLockManager({ strategy: "auto" })
    expect(manager).toBeInstanceOf(InMemoryRefreshLockManager)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("in-memory locks"))
    warnSpy.mockRestore()
  })

  it("reads strategy from REFRESH_LOCK_STRATEGY env var", async () => {
    process.env.REFRESH_LOCK_STRATEGY = "memory"
    const { createRefreshLockManager, InMemoryRefreshLockManager } = await importFactory()
    const manager = createRefreshLockManager()
    expect(manager).toBeInstanceOf(InMemoryRefreshLockManager)
  })

  it("reads redisUrl from REDIS_URL env var", async () => {
    mockCreateRedisClient.mockReturnValue({})
    process.env.REDIS_URL = "redis://from-env:6379"
    const { createRefreshLockManager, RedisRefreshLockManager } = await importFactory()
    const manager = createRefreshLockManager({ strategy: "redis" })
    expect(manager).toBeInstanceOf(RedisRefreshLockManager)
    expect(mockCreateRedisClient).toHaveBeenCalledWith("redis://from-env:6379")
  })

  it("option redisUrl overrides REDIS_URL env var", async () => {
    mockCreateRedisClient.mockReturnValue({})
    process.env.REDIS_URL = "redis://from-env:6379"
    const { createRefreshLockManager } = await importFactory()
    createRefreshLockManager({ strategy: "redis", redisUrl: "redis://from-option:6379" })
    expect(mockCreateRedisClient).toHaveBeenCalledWith("redis://from-option:6379")
  })
})
