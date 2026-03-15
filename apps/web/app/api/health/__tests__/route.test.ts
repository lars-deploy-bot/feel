/**
 * Tests for GET /api/health endpoint
 *
 * Two-tier health check:
 * - Public (unauthenticated): only status, timestamp, responseTimeMs
 * - Deep (superadmin or X-Internal-Secret): full services, system, build info
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSessionUser, MOCK_SESSION_USER } from "@/lib/test-helpers/mock-session-user"

// Mock Redis client
vi.mock("@webalive/redis", () => ({
  createRedisClient: vi.fn(() => ({
    ping: vi.fn(),
    status: "ready",
  })),
}))

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}))

// Mock global fetch for database health checks (health route uses direct fetch)
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Mock env functions
vi.mock("@/lib/env/server", () => ({
  getSupabaseCredentials: vi.fn(() => ({
    url: "https://test.supabase.co",
    key: "test-key",
  })),
}))

vi.mock("@webalive/env/server", () => ({
  env: {
    get STREAM_ENV() {
      return process.env.STREAM_ENV
    },
  },
  getRedisUrl: vi.fn(() => "redis://localhost:6379"),
}))

// Mock auth
vi.mock("@/features/auth/lib/auth", () => ({
  getSessionUser: vi.fn().mockResolvedValue(null),
}))

// Import after mocking
const { GET, _resetHealthCheckRedis } = await import("../route")
const { createRedisClient } = await import("@webalive/redis")
const { getSessionUser } = await import("@/features/auth/lib/auth")

// Type helpers for mocks
type MockRedis = ReturnType<typeof createRedisClient>

function mockRedis(overrides: { ping: ReturnType<typeof vi.fn>; status: string }): MockRedis {
  return overrides as unknown as MockRedis
}

/** Create a plain request (no auth) */
function publicRequest(): Request {
  return new Request("http://localhost/api/health")
}

/** Create a request with X-Internal-Secret header */
function internalRequest(secret: string): Request {
  return new Request("http://localhost/api/health", {
    headers: { "X-Internal-Secret": secret },
  })
}

const SENSITIVE_KEYS = ["services", "system", "build"]

function setupHealthyServices() {
  vi.mocked(createRedisClient).mockReturnValue(
    mockRedis({
      ping: vi.fn().mockResolvedValue("PONG"),
      status: "ready",
    }),
  )
  mockFetch.mockResolvedValue(new Response(JSON.stringify([{ user_id: "test" }]), { status: 200 }))
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetHealthCheckRedis()
    mockFetch.mockReset()
    vi.stubEnv("JWT_SECRET", "test-jwt-secret")
    vi.mocked(getSessionUser).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe("Public Response (unauthenticated)", () => {
    it("should return only status, timestamp, and responseTimeMs", async () => {
      setupHealthyServices()

      const response = await GET(publicRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("healthy")
      expect(data).toHaveProperty("timestamp")
      expect(data).toHaveProperty("responseTimeMs")

      for (const key of SENSITIVE_KEYS) {
        expect(data).not.toHaveProperty(key)
      }
    })

    it("should return 503 when unhealthy, still without sensitive fields", async () => {
      vi.mocked(createRedisClient).mockReturnValue(
        mockRedis({
          ping: vi.fn().mockRejectedValue(new Error("Connection refused")),
          status: "end",
        }),
      )
      mockFetch.mockRejectedValue(new Error("Database error"))

      const response = await GET(publicRequest())
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("unhealthy")

      for (const key of SENSITIVE_KEYS) {
        expect(data).not.toHaveProperty(key)
      }
    })

    it("should return shallow response for non-superadmin authenticated user", async () => {
      setupHealthyServices()
      vi.mocked(getSessionUser).mockResolvedValue(MOCK_SESSION_USER)

      const response = await GET(publicRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      for (const key of SENSITIVE_KEYS) {
        expect(data).not.toHaveProperty(key)
      }
    })

    it("should return shallow response for invalid X-Internal-Secret", async () => {
      setupHealthyServices()

      const response = await GET(internalRequest("wrong-secret"))
      const data = await response.json()

      expect(response.status).toBe(200)
      for (const key of SENSITIVE_KEYS) {
        expect(data).not.toHaveProperty(key)
      }
    })

    it("should return shallow response when JWT_SECRET is unset", async () => {
      vi.unstubAllEnvs()
      setupHealthyServices()

      const response = await GET(internalRequest("any-value"))
      const data = await response.json()

      expect(response.status).toBe(200)
      for (const key of SENSITIVE_KEYS) {
        expect(data).not.toHaveProperty(key)
      }
    })
  })

  describe("Deep Response (authenticated)", () => {
    it("should return full response for superadmin", async () => {
      setupHealthyServices()
      vi.mocked(getSessionUser).mockResolvedValue(
        createMockSessionUser({
          id: "admin-1",
          email: "admin@test.example",
          name: "Super Admin",
          isSuperadmin: true,
          isAdmin: true,
          canSelectAnyModel: true,
        }),
      )

      const response = await GET(publicRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("healthy")
      expect(data.services.redis.status).toBe("connected")
      expect(data.services.database.status).toBe("connected")
      expect(data.system.nodeVersion).toMatch(/^v\d+/)
      expect(data.build).toHaveProperty("commit")
      expect(data.build).toHaveProperty("time")
    })

    it("should return full response for valid X-Internal-Secret", async () => {
      setupHealthyServices()

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.services).toBeDefined()
      expect(data.system).toBeDefined()
      expect(data.build).toBeDefined()
    })
  })

  describe("Happy Path - All Services Connected", () => {
    it("should return 200 when all services are healthy", async () => {
      setupHealthyServices()

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("healthy")
    })

    it("should return correct deep response structure", async () => {
      setupHealthyServices()

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(data).toHaveProperty("status")
      expect(data).toHaveProperty("services")
      expect(data).toHaveProperty("system")
      expect(data).toHaveProperty("timestamp")
      expect(data).toHaveProperty("responseTimeMs")

      expect(data.services).toHaveProperty("redis")
      expect(data.services).toHaveProperty("database")

      expect(data.services.redis).toHaveProperty("status")
      expect(data.services.redis).toHaveProperty("responseTimeMs")
      expect(typeof data.services.redis.responseTimeMs).toBe("number")

      expect(data.services.database).toHaveProperty("status")
      expect(data.services.database).toHaveProperty("responseTimeMs")
      expect(typeof data.services.database.responseTimeMs).toBe("number")

      expect(data.system).toHaveProperty("uptime")
      expect(data.system).toHaveProperty("memory")
      expect(data.system).toHaveProperty("nodeVersion")
      expect(data.system.memory).toHaveProperty("used")
      expect(data.system.memory).toHaveProperty("total")
      expect(data.system.memory).toHaveProperty("percentUsed")

      expect(() => new Date(data.timestamp)).not.toThrow()
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp)

      expect(typeof data.responseTimeMs).toBe("number")
      expect(data.responseTimeMs).toBeGreaterThanOrEqual(0)
    })

    it("should show Redis details when connected", async () => {
      setupHealthyServices()

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(data.services.redis.status).toBe("connected")
      expect(data.services.redis.details).toBeDefined()
      expect(data.services.redis.details.state).toBe("ready")
    })
  })

  describe("Unhealthy - Services Disconnected", () => {
    it("should return 503 when Redis client is unavailable outside standalone mode", async () => {
      vi.stubEnv("STREAM_ENV", "production")
      vi.mocked(createRedisClient).mockReturnValue(null as unknown as MockRedis)
      mockFetch.mockResolvedValue(new Response(JSON.stringify([{ user_id: "test" }]), { status: 200 }))

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("unhealthy")
      expect(data.services.redis.status).toBe("disconnected")
      expect(data.services.redis.details.mode).toBe("missing")
    })

    it("should return 503 when Redis is disconnected", async () => {
      vi.mocked(createRedisClient).mockReturnValue(
        mockRedis({
          ping: vi.fn().mockRejectedValue(new Error("Connection refused")),
          status: "end",
        }),
      )
      mockFetch.mockResolvedValue(new Response(JSON.stringify([{ user_id: "test" }]), { status: 200 }))

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("unhealthy")
      expect(data.services.redis.status).toBe("disconnected")
      expect(data.services.redis.error).toBe("Connection refused")
    })

    it("should return 503 when database is disconnected", async () => {
      vi.mocked(createRedisClient).mockReturnValue(
        mockRedis({
          ping: vi.fn().mockResolvedValue("PONG"),
          status: "ready",
        }),
      )
      mockFetch.mockRejectedValue(new Error("Database connection failed"))

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("unhealthy")
      expect(data.services.database.status).toBe("disconnected")
      expect(data.services.database.error).toBe("Database connection failed")
    })

    it("should return 503 when both services are disconnected", async () => {
      vi.mocked(createRedisClient).mockReturnValue(
        mockRedis({
          ping: vi.fn().mockRejectedValue(new Error("Redis error")),
          status: "end",
        }),
      )
      mockFetch.mockRejectedValue(new Error("Database error"))

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("unhealthy")
      expect(data.services.redis.status).toBe("disconnected")
      expect(data.services.database.status).toBe("disconnected")
    })
  })

  describe("Degraded - Service Errors", () => {
    it("should return degraded when Redis returns unexpected response", async () => {
      vi.mocked(createRedisClient).mockReturnValue(
        mockRedis({
          ping: vi.fn().mockResolvedValue("UNEXPECTED"),
          status: "ready",
        }),
      )
      mockFetch.mockResolvedValue(new Response(JSON.stringify([{ user_id: "test" }]), { status: 200 }))

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("degraded")
      expect(data.services.redis.status).toBe("error")
      expect(data.services.redis.error).toContain("Unexpected ping response")
    })

    it("should return degraded when database query has error", async () => {
      vi.mocked(createRedisClient).mockReturnValue(
        mockRedis({
          ping: vi.fn().mockResolvedValue("PONG"),
          status: "ready",
        }),
      )
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ message: "Query failed" }), { status: 400 }))

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("degraded")
      expect(data.services.database.status).toBe("error")
      expect(data.services.database.error).toBe("Query failed")
    })
  })

  describe("Standalone Mode", () => {
    it("should treat missing Redis as connected in standalone mode", async () => {
      vi.stubEnv("STREAM_ENV", "standalone")
      vi.mocked(createRedisClient).mockReturnValue(null as unknown as MockRedis)
      mockFetch.mockResolvedValue(new Response(JSON.stringify([{ user_id: "test" }]), { status: 200 }))

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.services.redis.status).toBe("connected")
      expect(data.services.redis.details.mode).toBe("standalone")
    })
  })

  describe("Cache Headers", () => {
    it("should set no-cache headers", async () => {
      setupHealthyServices()

      const response = await GET(publicRequest())

      expect(response.headers.get("Cache-Control")).toBe("no-store, no-cache, must-revalidate")
    })
  })

  describe("System Information", () => {
    it("should include valid system information in deep response", async () => {
      setupHealthyServices()

      const response = await GET(internalRequest("test-jwt-secret"))
      const data = await response.json()

      expect(data.system.uptime).toBeGreaterThanOrEqual(0)
      expect(data.system.memory.used).toBeGreaterThan(0)
      expect(data.system.memory.total).toBeGreaterThan(0)
      expect(data.system.memory.percentUsed).toBeGreaterThan(0)
      expect(data.system.memory.percentUsed).toBeLessThanOrEqual(100)
      expect(data.system.nodeVersion).toMatch(/^v\d+/)
    })
  })
})
