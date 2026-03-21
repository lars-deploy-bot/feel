import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MOCK_SESSION_USER } from "@/lib/test-helpers/mock-session-user"

vi.mock("@/features/auth/lib/auth", () => ({
  requireAuthSession: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {
    constructor(msg = "Authentication required") {
      super(msg)
      this.name = "AuthenticationError"
    }
  },
}))

vi.mock("@/features/auth/sessions/session-service", () => ({
  revokeSession: vi.fn(),
}))

const { POST } = await import("../route")
const { requireAuthSession, AuthenticationError } = await import("@/features/auth/lib/auth")
const { revokeSession } = await import("@/features/auth/sessions/session-service")

const CURRENT_SID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const OTHER_SID = "11111111-2222-4333-8444-555555555555"

const MOCK_AUTH_SESSION = {
  user: MOCK_SESSION_USER,
  payload: {
    role: "authenticated" as const,
    sub: "user-123",
    userId: "user-123",
    email: "test@example.com",
    name: "Test User",
    sid: CURRENT_SID,
    scopes: ["workspace:access" as const, "workspace:list" as const, "org:read" as const],
    orgIds: [],
    orgRoles: {},
  },
}

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/sessions/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/auth/sessions/revoke", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireAuthSession).mockRejectedValue(new AuthenticationError())

    const res = await POST(createRequest({ sid: OTHER_SID }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid sid format", async () => {
    vi.mocked(requireAuthSession).mockResolvedValue(MOCK_AUTH_SESSION)

    const res = await POST(createRequest({ sid: "not-a-uuid" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when trying to revoke current session", async () => {
    vi.mocked(requireAuthSession).mockResolvedValue(MOCK_AUTH_SESSION)

    const res = await POST(createRequest({ sid: CURRENT_SID }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("CANNOT_REVOKE_CURRENT_SESSION")
  })

  it("revokes a session successfully", async () => {
    vi.mocked(requireAuthSession).mockResolvedValue(MOCK_AUTH_SESSION)
    vi.mocked(revokeSession).mockResolvedValue(true)

    const res = await POST(createRequest({ sid: OTHER_SID }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.revoked).toBe(true)
    expect(revokeSession).toHaveBeenCalledWith("user-123", OTHER_SID)
  })

  it("returns 404 when session not found", async () => {
    vi.mocked(requireAuthSession).mockResolvedValue(MOCK_AUTH_SESSION)
    vi.mocked(revokeSession).mockResolvedValue(false)

    const res = await POST(createRequest({ sid: OTHER_SID }))
    expect(res.status).toBe(404)
  })
})
