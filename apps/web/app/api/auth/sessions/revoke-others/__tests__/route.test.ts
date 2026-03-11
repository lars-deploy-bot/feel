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
  revokeOtherSessions: vi.fn(),
}))

const { POST } = await import("../route")
const { requireAuthSession, AuthenticationError } = await import("@/features/auth/lib/auth")
const { revokeOtherSessions } = await import("@/features/auth/sessions/session-service")

const CURRENT_SID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

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

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/auth/sessions/revoke-others", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireAuthSession).mockRejectedValue(new AuthenticationError())

    const res = await POST()
    expect(res.status).toBe(401)
  })

  it("returns 401 when session payload has no sid", async () => {
    vi.mocked(requireAuthSession).mockRejectedValue(new AuthenticationError("Missing session id"))

    const res = await POST()
    expect(res.status).toBe(401)
  })

  it("revokes all other sessions and returns count", async () => {
    vi.mocked(requireAuthSession).mockResolvedValue(MOCK_AUTH_SESSION)
    vi.mocked(revokeOtherSessions).mockResolvedValue(3)

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.revokedCount).toBe(3)
    expect(revokeOtherSessions).toHaveBeenCalledWith("user-123", CURRENT_SID)
  })

  it("returns count of 0 when no other sessions exist", async () => {
    vi.mocked(requireAuthSession).mockResolvedValue(MOCK_AUTH_SESSION)
    vi.mocked(revokeOtherSessions).mockResolvedValue(0)

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.revokedCount).toBe(0)
  })
})
