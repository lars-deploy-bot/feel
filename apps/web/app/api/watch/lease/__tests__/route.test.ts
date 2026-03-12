import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockValidateRequest = vi.fn()
vi.mock("@/features/auth/lib/auth", () => ({
  validateRequest: (...args: unknown[]) => mockValidateRequest(...args),
}))

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock("@webalive/env/server", () => ({
  env: {
    get SHELL_PASSWORD() {
      return mockEnv.SHELL_PASSWORD
    },
  },
}))

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
  },
  SUPERADMIN: { WORKSPACE_NAME: "alive" },
}))

vi.mock("@/lib/api/responses", () => ({
  structuredErrorResponse: vi.fn((code: string, opts?: { status?: number }) =>
    NextResponse.json({ error: { code } }, { status: opts?.status ?? 500 }),
  ),
}))

vi.mock("@/lib/error-codes", () => ({
  ErrorCodes: {
    INTERNAL_ERROR: "INTERNAL_ERROR",
    SHELL_SERVER_UNAVAILABLE: "SHELL_SERVER_UNAVAILABLE",
    WATCH_UNSUPPORTED: "WATCH_UNSUPPORTED",
  },
}))

const mockResolveDomainRuntime = vi.fn()
vi.mock("@/lib/domain/resolve-domain-runtime", () => ({
  resolveDomainRuntime: (...args: unknown[]) => mockResolveDomainRuntime(...args),
}))

const mockEnv: Record<string, string | undefined> = {}

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Import after mocks
const { POST } = await import("../route")

function makeRequest(body: Record<string, unknown> = { workspace: "example.com" }): Request {
  return new Request("http://localhost/api/watch/lease", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function getShellLeaseCall(): [string, RequestInit] {
  const call = mockFetch.mock.calls.find(call => call[0] === "http://localhost:3888/internal/watch-lease") as
    | [string, RequestInit]
    | undefined

  if (!call) {
    throw new Error("Expected shell lease fetch call was not made")
  }
  return call
}

describe("POST /api/watch/lease", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.SHELL_PASSWORD = "test-secret"
    mockEnv.SHELL_HOST = "go.example.com"
    mockEnv.SHELL_UPSTREAM = "http://localhost:3888"
    mockResolveDomainRuntime.mockResolvedValue(null)
  })

  it("returns auth error when validateRequest fails", async () => {
    const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    mockValidateRequest.mockResolvedValue({ error: authError })

    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 500 when SHELL_PASSWORD is not configured", async () => {
    mockEnv.SHELL_PASSWORD = undefined
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error.code).toBe("INTERNAL_ERROR")
  })

  it("returns 500 when SHELL_HOST is not configured", async () => {
    mockEnv.SHELL_HOST = undefined
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error.code).toBe("INTERNAL_ERROR")
  })

  it("returns 500 when shell upstream is not configured", async () => {
    mockEnv.SHELL_UPSTREAM = undefined
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error.code).toBe("INTERNAL_ERROR")
  })

  it("returns 502 when shell server returns non-ok status", async () => {
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error.code).toBe("SHELL_SERVER_UNAVAILABLE")
  })

  it("returns 502 when shell server returns invalid response shape", async () => {
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: "shape" }),
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error.code).toBe("SHELL_SERVER_UNAVAILABLE")
  })

  it("returns 502 when shell server is unreachable", async () => {
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })
    mockFetch.mockRejectedValue(new Error("Connection refused"))

    const res = await POST(makeRequest())
    expect(res.status).toBe(502)
  })

  it("returns 501 for e2b workspaces and does not call shell server", async () => {
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })
    mockResolveDomainRuntime.mockResolvedValue({
      domain_id: "domain-1",
      hostname: "example.com",
      execution_mode: "e2b",
      sandbox_id: "sandbox-1",
      sandbox_status: "ready",
    })

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(res.status).toBe(501)
    expect(data.error.code).toBe("WATCH_UNSUPPORTED")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("returns lease data on success", async () => {
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        lease: "abc123",
        workspace: "site:example.com",
        expiresAt: 1700000000000,
      }),
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.lease).toBe("abc123")
    expect(data.wsUrl).toBe("wss://go.example.com/ws/watch?lease=abc123")
    expect(data.workspace).toBe("site:example.com")
    expect(data.expiresAt).toBe(1700000000000)
  })

  it("maps superadmin workspace to 'root'", async () => {
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "alive", body: { workspace: "alive" } },
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        lease: "tok",
        workspace: "root",
        expiresAt: 1700000000000,
      }),
    })

    const res = await POST(makeRequest({ workspace: "alive" }))
    expect(res.status).toBe(200)

    const [, requestInit] = getShellLeaseCall()
    const fetchBody = JSON.parse(String(requestInit.body))
    expect(fetchBody.workspace).toBe("root")
  })

  it("forwards worktree slug to shell server", async () => {
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com", worktree: "my-feature" } },
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        lease: "tok",
        workspace: "site:example.com",
        expiresAt: 1700000000000,
      }),
    })

    const res = await POST(makeRequest({ workspace: "example.com", worktree: "my-feature" }))
    expect(res.status).toBe(200)

    const [, requestInit] = getShellLeaseCall()
    const fetchBody = JSON.parse(String(requestInit.body))
    expect(fetchBody.worktree).toBe("my-feature")
  })

  it("omits worktree when not provided", async () => {
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        lease: "tok",
        workspace: "site:example.com",
        expiresAt: 1700000000000,
      }),
    })

    await POST(makeRequest({ workspace: "example.com" }))

    const [, requestInit] = getShellLeaseCall()
    const fetchBody = JSON.parse(String(requestInit.body))
    expect(fetchBody.worktree).toBeUndefined()
  })

  it("sends X-Internal-Secret header to shell server", async () => {
    mockValidateRequest.mockResolvedValue({
      data: { workspace: "example.com", body: { workspace: "example.com" } },
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        lease: "tok",
        workspace: "site:example.com",
        expiresAt: 1700000000000,
      }),
    })

    await POST(makeRequest())

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3888/internal/watch-lease",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Internal-Secret": "test-secret",
        }),
      }),
    )
  })
})
