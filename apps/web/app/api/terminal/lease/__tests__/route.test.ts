/**
 * Tests for POST /api/terminal/lease endpoint
 *
 * Security tests:
 * - 401 without session
 * - 401 without workspace access
 * - Superadmin workspace maps to "root" shell workspace
 *
 * Functional tests:
 * - Returns lease + wsUrl for valid workspace
 * - 502 when shell server is unreachable
 * - 500 when SHELL_PASSWORD not configured
 */

import { NextResponse } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MOCK_SESSION_USER } from "@/lib/test-helpers/mock-session-user"

// Track fetch calls for shell server
const mockFetchImpl = vi.fn()
const mockResolveDomainRuntime = vi.fn()

const mockEnv = {
  SHELL_PASSWORD: "test-shell-password",
  SHELL_HOST: "go.test.local",
  SHELL_UPSTREAM: "http://localhost:3888",
  E2B_SHELL_UPSTREAM: "http://localhost:5075",
}

// Mock auth
vi.mock("@/features/auth/lib/auth", async () => {
  return {
    validateRequest: vi.fn(),
  }
})

// Mock structured error response
vi.mock("@/lib/api/responses", async () => {
  const { NextResponse } = await import("next/server")
  return {
    structuredErrorResponse: vi.fn((code: string, opts: { status: number; details?: Record<string, unknown> }) => {
      return NextResponse.json({ ok: false, error: code, ...opts.details }, { status: opts.status })
    }),
  }
})

// Mock env
vi.mock("@webalive/env/server", () => ({
  env: {
    get SHELL_PASSWORD() {
      return mockEnv.SHELL_PASSWORD
    },
  },
}))

// Mock shared config
vi.mock("@webalive/shared", () => ({
  DOMAINS: {
    get SHELL_HOST() {
      return mockEnv.SHELL_HOST
    },
  },
  SHELL: {
    get UPSTREAM() {
      return mockEnv.SHELL_UPSTREAM
    },
    get E2B_UPSTREAM() {
      return mockEnv.E2B_SHELL_UPSTREAM
    },
  },
  SUPERADMIN: { WORKSPACE_NAME: "alive" },
}))

// Mock domain runtime — tests use systemd path (domain = null)
vi.mock("@/lib/domain/resolve-domain-runtime", () => ({
  resolveDomainRuntime: (...args: unknown[]) => mockResolveDomainRuntime(...args),
}))

// Mock global fetch for shell server calls
vi.stubGlobal(
  "fetch",
  vi.fn((...args: Parameters<typeof fetch>) => {
    const [url] = args
    if (typeof url === "string" && (url.includes("localhost:3888") || url.includes("localhost:5075"))) {
      return mockFetchImpl(...args)
    }
    // Fallback
    return Promise.resolve(new Response("Not found", { status: 404 }))
  }),
)

const { POST } = await import("../route")
const { validateRequest } = await import("@/features/auth/lib/auth")

const MOCK_USER = MOCK_SESSION_USER

function makeRequest(body: Record<string, unknown> = { workspace: "example.com" }): Request {
  return new Request("http://localhost/api/terminal/lease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.clearAllMocks()
  mockEnv.SHELL_PASSWORD = "test-shell-password"
  mockEnv.SHELL_HOST = "go.test.local"
  mockEnv.SHELL_UPSTREAM = "http://localhost:3888"
  mockEnv.E2B_SHELL_UPSTREAM = "http://localhost:5075"
  mockResolveDomainRuntime.mockResolvedValue(null)
})

describe("POST /api/terminal/lease", () => {
  it("returns 401 when session is invalid", async () => {
    vi.mocked(validateRequest).mockResolvedValue({
      error: NextResponse.json({ ok: false, error: "NO_SESSION" }, { status: 401 }),
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns lease and wsUrl for valid workspace", async () => {
    vi.mocked(validateRequest).mockResolvedValue({
      data: { user: MOCK_USER, body: { workspace: "example.com" }, workspace: "example.com" },
    })
    mockFetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ lease: "abc123", workspace: "site:example.com", expiresAt: Date.now() + 90000 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.lease).toBe("abc123")
    expect(data.wsUrl).toBe("wss://go.test.local/ws?lease=abc123")

    // Verify shell server was called with correct workspace
    const [url, options] = mockFetchImpl.mock.calls[0]
    expect(url).toBe("http://localhost:3888/internal/lease")
    expect(JSON.parse(options.body)).toEqual({ workspace: "example.com" })
    expect(options.headers["X-Internal-Secret"]).toBe("test-shell-password")
  })

  it("maps superadmin workspace to root", async () => {
    vi.mocked(validateRequest).mockResolvedValue({
      data: { user: { ...MOCK_USER, isSuperadmin: true }, body: { workspace: "alive" }, workspace: "alive" },
    })
    mockFetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ lease: "root-lease", workspace: "root", expiresAt: Date.now() + 90000 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const res = await POST(makeRequest({ workspace: "alive" }))
    expect(res.status).toBe(200)

    // Verify shell server was called with "root", not "alive"
    const [, options] = mockFetchImpl.mock.calls[0]
    expect(JSON.parse(options.body)).toEqual({ workspace: "root" })
  })

  it("returns 502 when shell server is unreachable", async () => {
    vi.mocked(validateRequest).mockResolvedValue({
      data: { user: MOCK_USER, body: { workspace: "example.com" }, workspace: "example.com" },
    })
    mockFetchImpl.mockRejectedValue(new Error("ECONNREFUSED"))

    const res = await POST(makeRequest())
    expect(res.status).toBe(502)
  })

  it("returns 502 when shell server returns error", async () => {
    vi.mocked(validateRequest).mockResolvedValue({
      data: { user: MOCK_USER, body: { workspace: "example.com" }, workspace: "example.com" },
    })
    mockFetchImpl.mockResolvedValue(new Response(JSON.stringify({ error: "Workspace not found" }), { status: 404 }))

    const res = await POST(makeRequest())
    expect(res.status).toBe(502)
  })

  it("returns 500 when shell upstream is not configured", async () => {
    mockEnv.SHELL_UPSTREAM = ""
    vi.mocked(validateRequest).mockResolvedValue({
      data: { user: MOCK_USER, body: { workspace: "example.com" }, workspace: "example.com" },
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })

  it("returns 503 when e2b sandbox is not ready", async () => {
    mockResolveDomainRuntime.mockResolvedValue({
      domain_id: "domain-123",
      hostname: "example.com",
      execution_mode: "e2b",
      sandbox_id: null,
      sandbox_status: "dead",
    })
    vi.mocked(validateRequest).mockResolvedValue({
      data: { user: MOCK_USER, body: { workspace: "example.com" }, workspace: "example.com" },
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(503)
    expect(mockFetchImpl).not.toHaveBeenCalled()
  })

  it("uses the e2b terminal bridge for e2b workspaces", async () => {
    mockResolveDomainRuntime.mockResolvedValue({
      domain_id: "domain-123",
      hostname: "example.com",
      execution_mode: "e2b",
      sandbox_id: "sandbox-123",
      sandbox_status: "running",
    })
    vi.mocked(validateRequest).mockResolvedValue({
      data: { user: MOCK_USER, body: { workspace: "example.com" }, workspace: "example.com" },
    })
    mockFetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ lease: "e2b-lease", workspace: "example.com", expiresAt: Date.now() + 90000 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.wsUrl).toBe("wss://go.test.local/e2b/ws?lease=e2b-lease")

    const [url, options] = mockFetchImpl.mock.calls[0]
    expect(url).toBe("http://localhost:5075/internal/lease")
    expect(JSON.parse(String(options.body))).toEqual({
      workspace: "example.com",
      sandboxDomain: {
        domain_id: "domain-123",
        hostname: "example.com",
        sandbox_id: "sandbox-123",
        sandbox_status: "running",
      },
    })
  })
})
