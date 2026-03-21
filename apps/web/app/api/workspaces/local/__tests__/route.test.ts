/**
 * Tests for /api/workspaces/local endpoint
 *
 * This endpoint is only available in standalone mode (ALIVE_ENV=standalone)
 * Tests cover:
 * - Authentication (session required)
 * - Environment check (standalone mode only)
 * - GET: List local workspaces
 * - POST: Create new workspace
 * - Error handling (duplicate workspace, path traversal)
 */

import { existsSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { COOKIE_NAMES, STANDALONE } from "@webalive/shared"
import type { NextRequest } from "next/server"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionPayloadV3 } from "@/features/auth/lib/jwt"

const makeGetRequest = () => new Request("http://localhost/api/workspaces/local") as unknown as NextRequest

// Store original env
const originalBridgeEnv = process.env.ALIVE_ENV

// Test workspace base directory
const TEST_WORKSPACE_BASE = path.join(tmpdir(), "standalone-workspace-test")

/**
 * Build a valid SessionPayloadV3 for the standalone test user.
 * Every required field is populated so no type assertions are needed.
 */
function testSessionPayload(overrides?: Partial<SessionPayloadV3>): SessionPayloadV3 {
  return {
    role: "authenticated",
    sub: STANDALONE.TEST_USER.ID,
    userId: STANDALONE.TEST_USER.ID,
    email: STANDALONE.TEST_USER.EMAIL,
    name: STANDALONE.TEST_USER.NAME,
    sid: "test-session-001",
    scopes: ["workspace:access", "workspace:list", "org:read"],
    orgIds: [],
    orgRoles: {},
    ...overrides,
  }
}

/**
 * Module-level mock for `cookies()` from `next/headers`.
 *
 * Defined before `vi.mock` so it can be referenced inside the factory.
 * Using a standalone `vi.fn()` avoids the need to cast return values to
 * the complex `ReadonlyRequestCookies` class type — the mock function's
 * own type is inferred from usage, not from the original module signature.
 */
const cookiesMock = vi.fn()

/**
 * Create a mock cookie jar that satisfies the subset of ReadonlyRequestCookies
 * used by the route under test (only `.get()` is called).
 */
function createMockCookieJar(sessionValue?: string) {
  return {
    get: vi.fn((name: string) => {
      if (name === COOKIE_NAMES.SESSION && sessionValue) {
        return { name, value: sessionValue }
      }
      return undefined
    }),
    getAll: vi.fn(() => []),
    has: vi.fn(() => false),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    toString: vi.fn(() => ""),
    [Symbol.iterator]: function* () {},
    size: 0,
  }
}

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}))

// Mock env
vi.mock("@webalive/env/server", () => ({
  env: {
    get ALIVE_ENV() {
      return process.env.ALIVE_ENV
    },
  },
}))

// Mock standalone workspace utilities
vi.mock("@/features/workspace/lib/standalone-workspace", () => ({
  getStandaloneWorkspaces: vi.fn(() => ["default", "test-project"]),
  getStandaloneWorkspaceBase: vi.fn(() => TEST_WORKSPACE_BASE),
  standaloneWorkspaceExists: vi.fn((name: string) => name === "default" || name === "test-project"),
  createStandaloneWorkspace: vi.fn((name: string) => {
    if (name.includes("..") || name.includes("/")) {
      throw new Error(`Invalid workspace name: ${name}`)
    }
    return path.join(TEST_WORKSPACE_BASE, name, "user")
  }),
}))

vi.mock("@/features/auth/lib/jwt", () => ({
  verifySessionToken: vi.fn(),
}))

// Import after mocking
const { verifySessionToken } = await import("@/features/auth/lib/jwt")
const { GET, POST } = await import("../route")

/** Set up cookies mock to return a jar with the given session value. */
function mockCookies(sessionValue?: string) {
  cookiesMock.mockResolvedValue(createMockCookieJar(sessionValue))
}

describe("GET /api/workspaces/local", () => {
  beforeAll(() => {
    // Create test workspace directory
    if (existsSync(TEST_WORKSPACE_BASE)) {
      rmSync(TEST_WORKSPACE_BASE, { recursive: true })
    }
    mkdirSync(TEST_WORKSPACE_BASE, { recursive: true })
  })

  afterAll(() => {
    // Cleanup
    if (existsSync(TEST_WORKSPACE_BASE)) {
      rmSync(TEST_WORKSPACE_BASE, { recursive: true })
    }
    // Restore original env
    process.env.ALIVE_ENV = originalBridgeEnv
  })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ALIVE_ENV = "standalone"
    vi.mocked(verifySessionToken).mockImplementation(async token =>
      token === "valid-jwt" ? testSessionPayload() : null,
    )
  })

  afterEach(() => {
    process.env.ALIVE_ENV = originalBridgeEnv
  })

  describe("Environment Checks", () => {
    it("should return 400 if not in standalone mode", async () => {
      process.env.ALIVE_ENV = "local"
      mockCookies("valid-jwt")

      const response = await GET(makeGetRequest())
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.ok).toBe(false)
      expect(data.error).toBe("INVALID_REQUEST")
      expect(data.message).toContain("standalone mode")
    })

    it("should return 400 in production mode", async () => {
      process.env.ALIVE_ENV = "production"
      mockCookies("valid-jwt")

      const response = await GET(makeGetRequest())
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("INVALID_REQUEST")
    })
  })

  describe("Authentication", () => {
    it("should return 401 without session cookie", async () => {
      mockCookies()

      const response = await GET(makeGetRequest())
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.ok).toBe(false)
      expect(data.error).toBe("NO_SESSION")
    })

    it("should return 401 with invalid session value", async () => {
      mockCookies("invalid-session")

      const response = await GET(makeGetRequest())
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("NO_SESSION")
    })
  })

  describe("Happy Path", () => {
    it("should return list of workspaces with valid session", async () => {
      mockCookies("valid-jwt")

      const response = await GET(makeGetRequest())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.workspaces).toEqual(["default", "test-project"])
      expect(data.basePath).toBe(TEST_WORKSPACE_BASE)
      expect(data.requestId).toBeDefined()
    })
  })
})

describe("POST /api/workspaces/local", () => {
  beforeAll(() => {
    if (existsSync(TEST_WORKSPACE_BASE)) {
      rmSync(TEST_WORKSPACE_BASE, { recursive: true })
    }
    mkdirSync(TEST_WORKSPACE_BASE, { recursive: true })
  })

  afterAll(() => {
    if (existsSync(TEST_WORKSPACE_BASE)) {
      rmSync(TEST_WORKSPACE_BASE, { recursive: true })
    }
    process.env.ALIVE_ENV = originalBridgeEnv
  })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ALIVE_ENV = "standalone"
    vi.mocked(verifySessionToken).mockImplementation(async token =>
      token === "valid-jwt" ? testSessionPayload() : null,
    )
  })

  afterEach(() => {
    process.env.ALIVE_ENV = originalBridgeEnv
  })

  function createMockRequest(body: Record<string, unknown>): Request {
    return new Request("http://localhost/api/workspaces/local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  describe("Environment Checks", () => {
    it("should return 400 if not in standalone mode", async () => {
      process.env.ALIVE_ENV = "local"
      mockCookies("valid-jwt")

      const req = createMockRequest({ name: "new-workspace" })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("INVALID_REQUEST")
    })
  })

  describe("Authentication", () => {
    it("should return 401 without session", async () => {
      mockCookies()

      const req = createMockRequest({ name: "new-workspace" })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe("NO_SESSION")
    })
  })

  describe("Validation", () => {
    it("should return 400 for empty workspace name", async () => {
      mockCookies("valid-jwt")

      const req = createMockRequest({ name: "" })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("INVALID_REQUEST")
    })

    it("should return 400 for invalid JSON body", async () => {
      mockCookies("valid-jwt")

      const req = new Request("http://localhost/api/workspaces/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("INVALID_JSON")
    })

    it("should return 400 for workspace name with invalid characters", async () => {
      mockCookies("valid-jwt")

      const req = createMockRequest({ name: "my workspace!" })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe("INVALID_REQUEST")
    })
  })

  describe("Path Traversal Prevention", () => {
    it("should block path traversal attempts with ..", async () => {
      mockCookies("valid-jwt")

      const req = createMockRequest({ name: "../../../etc" })
      const response = await POST(req)
      await response.json()

      // Should fail validation (regex doesn't allow dots or slashes)
      expect(response.status).toBe(400)
    })

    it("should block path traversal with slashes", async () => {
      mockCookies("valid-jwt")

      const req = createMockRequest({ name: "foo/bar" })
      const response = await POST(req)
      await response.json()

      expect(response.status).toBe(400)
    })
  })

  describe("Duplicate Workspace", () => {
    it("should return 409 for existing workspace name", async () => {
      mockCookies("valid-jwt")

      const req = createMockRequest({ name: "default" }) // "default" exists per mock
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe("WORKSPACE_EXISTS")
      expect(data.message).toContain("default")
    })
  })

  describe("Happy Path", () => {
    it("should create new workspace successfully", async () => {
      mockCookies("valid-jwt")

      const req = createMockRequest({ name: "new-project" })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.workspace.name).toBe("new-project")
      expect(data.workspace.path).toBe(path.join(TEST_WORKSPACE_BASE, "new-project", "user"))
    })

    it("should allow workspace names with hyphens and underscores", async () => {
      mockCookies("valid-jwt")

      const req = createMockRequest({ name: "my-project_v2" })
      const response = await POST(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.workspace.name).toBe("my-project_v2")
    })
  })
})
