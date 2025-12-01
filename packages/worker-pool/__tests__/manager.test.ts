import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WorkerPoolManager, resetWorkerPool, getWorkerPool } from "../src/manager"
import { createConfig, DEFAULT_CONFIG } from "../src/config"

// NOTE: We intentionally do NOT use vi.mock() for any node modules here.
// Bun's mock system applies globally across ALL test files in the process,
// which breaks other tests (like lifecycle.test.ts) that need real implementations.
//
// Instead, these tests focus on WorkerPoolManager's public interface
// without spawning actual workers. The manager handles missing sockets/workers
// gracefully, so no mocking is needed.

describe("WorkerPoolManager", () => {
  let manager: WorkerPoolManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new WorkerPoolManager({
      maxWorkers: 5,
      inactivityTimeoutMs: 1000,
      socketDir: "/tmp/test-workers",
    })
  })

  afterEach(async () => {
    manager.stopEvictionTimer()
    await resetWorkerPool()
  })

  describe("configuration", () => {
    it("should use default config values", () => {
      const config = createConfig()
      expect(config.maxWorkers).toBe(DEFAULT_CONFIG.maxWorkers)
      expect(config.inactivityTimeoutMs).toBe(DEFAULT_CONFIG.inactivityTimeoutMs)
      expect(config.maxAgeMs).toBe(DEFAULT_CONFIG.maxAgeMs)
      expect(config.evictionStrategy).toBe("lru")
    })

    it("should allow config overrides", () => {
      const config = createConfig({
        maxWorkers: 10,
        inactivityTimeoutMs: 5000,
      })
      expect(config.maxWorkers).toBe(10)
      expect(config.inactivityTimeoutMs).toBe(5000)
      // Other values should be default
      expect(config.maxAgeMs).toBe(DEFAULT_CONFIG.maxAgeMs)
    })
  })

  describe("getWorkerInfo", () => {
    it("should return empty array when no workers", () => {
      const info = manager.getWorkerInfo()
      expect(info).toEqual([])
    })
  })

  describe("getStats", () => {
    it("should return correct stats when no workers", () => {
      const stats = manager.getStats()
      expect(stats).toEqual({
        totalWorkers: 0,
        activeWorkers: 0,
        idleWorkers: 0,
        maxWorkers: 5,
      })
    })
  })

  describe("events", () => {
    it("should emit events with correct types", () => {
      const spawnedHandler = vi.fn()
      manager.on("worker:spawned", spawnedHandler)

      // Manually emit to test event typing
      manager.emit("worker:spawned", {
        workspaceKey: "test.com",
        pid: 12345,
      })

      expect(spawnedHandler).toHaveBeenCalledWith({
        workspaceKey: "test.com",
        pid: 12345,
      })
    })

    it("should support multiple event listeners", () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      manager.on("worker:ready", handler1)
      manager.on("worker:ready", handler2)

      manager.emit("worker:ready", {
        workspaceKey: "test.com",
        pid: 12345,
      })

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })

  describe("shutdownAll", () => {
    it("should not throw when no workers to shutdown", async () => {
      // Should complete without error
      await manager.shutdownAll()
      expect(manager.getStats().totalWorkers).toBe(0)
    })
  })

  describe("shutdownWorker", () => {
    it("should not throw when worker does not exist", async () => {
      // Should complete without error
      await manager.shutdownWorker("nonexistent.com")
      expect(manager.getStats().totalWorkers).toBe(0)
    })
  })

  describe("eviction timer", () => {
    it("should start and stop eviction timer", () => {
      // Start should not throw
      manager.startEvictionTimer()
      expect(() => manager.startEvictionTimer()).not.toThrow() // Idempotent

      // Stop should not throw
      manager.stopEvictionTimer()
      expect(() => manager.stopEvictionTimer()).not.toThrow() // Idempotent
    })
  })
})

describe("getWorkerPool singleton", () => {
  afterEach(async () => {
    await resetWorkerPool()
  })

  it("should return same instance on subsequent calls", () => {
    const pool1 = getWorkerPool()
    const pool2 = getWorkerPool()
    expect(pool1).toBe(pool2)
  })

  it("should warn when config passed to existing instance", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    getWorkerPool({ maxWorkers: 10 })
    getWorkerPool({ maxWorkers: 20 }) // Should warn, config ignored

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("config but instance already exists"))
    warnSpy.mockRestore()
  })

  it("should not warn when no config passed", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    getWorkerPool({ maxWorkers: 10 })
    getWorkerPool() // No config, no warning

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe("createConfig overrides", () => {
  it("should use shared constants as defaults", () => {
    const config = createConfig()
    expect(config.maxWorkers).toBe(DEFAULT_CONFIG.maxWorkers)
    expect(config.inactivityTimeoutMs).toBe(DEFAULT_CONFIG.inactivityTimeoutMs)
  })

  it("should allow explicit overrides", () => {
    const config = createConfig({ maxWorkers: 50, inactivityTimeoutMs: 60000 })
    expect(config.maxWorkers).toBe(50)
    expect(config.inactivityTimeoutMs).toBe(60000)
  })

  it("should preserve other defaults when partially overriding", () => {
    const config = createConfig({ maxWorkers: 50 })
    expect(config.maxWorkers).toBe(50)
    expect(config.inactivityTimeoutMs).toBe(DEFAULT_CONFIG.inactivityTimeoutMs)
    expect(config.maxAgeMs).toBe(DEFAULT_CONFIG.maxAgeMs)
  })
})

describe("createConfig validation", () => {
  describe("maxWorkers", () => {
    it("should reject zero and negative values", () => {
      expect(() => createConfig({ maxWorkers: 0 })).toThrow("Invalid maxWorkers")
      expect(() => createConfig({ maxWorkers: -1 })).toThrow("Invalid maxWorkers")
      expect(() => createConfig({ maxWorkers: -100 })).toThrow("Invalid maxWorkers")
    })

    it("should reject non-integer values", () => {
      expect(() => createConfig({ maxWorkers: 1.5 })).toThrow("Invalid maxWorkers")
      expect(() => createConfig({ maxWorkers: NaN })).toThrow("Invalid maxWorkers")
      expect(() => createConfig({ maxWorkers: Infinity })).toThrow("Invalid maxWorkers")
      expect(() => createConfig({ maxWorkers: -Infinity })).toThrow("Invalid maxWorkers")
    })

    it("should accept valid positive integers", () => {
      expect(() => createConfig({ maxWorkers: 1 })).not.toThrow()
      expect(() => createConfig({ maxWorkers: 100 })).not.toThrow()
    })
  })

  describe("timeout values", () => {
    it("should reject negative timeout values", () => {
      expect(() => createConfig({ inactivityTimeoutMs: -1 })).toThrow("Invalid inactivityTimeoutMs")
      expect(() => createConfig({ maxAgeMs: -1 })).toThrow("Invalid maxAgeMs")
    })

    it("should reject zero for required positive timeouts", () => {
      expect(() => createConfig({ readyTimeoutMs: 0 })).toThrow("Invalid readyTimeoutMs")
      expect(() => createConfig({ shutdownTimeoutMs: 0 })).toThrow("Invalid shutdownTimeoutMs")
      expect(() => createConfig({ cancelTimeoutMs: 0 })).toThrow("Invalid cancelTimeoutMs")
    })

    it("should reject non-integer timeout values", () => {
      expect(() => createConfig({ readyTimeoutMs: 1.5 })).toThrow("Invalid readyTimeoutMs")
      expect(() => createConfig({ shutdownTimeoutMs: NaN })).toThrow("Invalid shutdownTimeoutMs")
      expect(() => createConfig({ inactivityTimeoutMs: Infinity })).toThrow("Invalid inactivityTimeoutMs")
      expect(() => createConfig({ cancelTimeoutMs: -1 })).toThrow("Invalid cancelTimeoutMs")
    })

    it("should allow zero for optional timeouts (disable feature)", () => {
      expect(() => createConfig({ inactivityTimeoutMs: 0 })).not.toThrow()
      expect(() => createConfig({ maxAgeMs: 0 })).not.toThrow()
    })
  })

  describe("evictionStrategy", () => {
    it("should reject invalid strategies", () => {
      expect(() => createConfig({ evictionStrategy: "invalid" as "lru" })).toThrow("Invalid evictionStrategy")
      expect(() => createConfig({ evictionStrategy: "" as "lru" })).toThrow("Invalid evictionStrategy")
      expect(() => createConfig({ evictionStrategy: "LRU" as "lru" })).toThrow("Invalid evictionStrategy") // case-sensitive
    })

    it("should accept all valid strategies", () => {
      expect(() => createConfig({ evictionStrategy: "lru" })).not.toThrow()
      expect(() => createConfig({ evictionStrategy: "oldest" })).not.toThrow()
      expect(() => createConfig({ evictionStrategy: "least_used" })).not.toThrow()
    })
  })

  describe("path strings", () => {
    it("should reject empty strings", () => {
      expect(() => createConfig({ workerEntryPath: "" })).toThrow("workerEntryPath must be a non-empty string")
      expect(() => createConfig({ socketDir: "" })).toThrow("socketDir must be a non-empty string")
    })

    it("should accept non-empty paths", () => {
      expect(() => createConfig({ workerEntryPath: "/path/to/worker.js" })).not.toThrow()
      expect(() => createConfig({ socketDir: "/tmp/sockets" })).not.toThrow()
    })
  })
})
