import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/features/auth/lib/auth", () => ({
  requireSessionUser: vi.fn(),
  getSessionPayloadFromCookie: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {
    constructor(msg = "Authentication required") {
      super(msg)
      this.name = "AuthenticationError"
    }
  },
}))

vi.mock("@/features/auth/sessions/session-service", () => ({
  listActiveSessions: vi.fn(),
}))

const { GET } = await import("../route")
const { requireSessionUser, getSessionPayloadFromCookie, AuthenticationError } = await import(
  "@/features/auth/lib/auth"
)
const { listActiveSessions } = await import("@/features/auth/sessions/session-service")

const MOCK_USER = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  canSelectAnyModel: false,
  isAdmin: false,
  isSuperadmin: false,
  enabledModels: [],
}

const MOCK_PAYLOAD = {
  role: "authenticated" as const,
  sub: "user-123",
  userId: "user-123",
  email: "test@example.com",
  name: "Test User",
  sid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  scopes: ["workspace:access" as const, "workspace:list" as const, "org:read" as const],
  orgIds: [],
  orgRoles: {},
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/auth/sessions", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireSessionUser).mockRejectedValue(new (AuthenticationError as ErrorConstructor)())

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns 401 when payload has no sid", async () => {
    vi.mocked(requireSessionUser).mockResolvedValue(MOCK_USER)
    vi.mocked(getSessionPayloadFromCookie).mockResolvedValue({
      ...MOCK_PAYLOAD,
      sid: undefined as unknown as string,
    })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns sessions list for authenticated user", async () => {
    vi.mocked(requireSessionUser).mockResolvedValue(MOCK_USER)
    vi.mocked(getSessionPayloadFromCookie).mockResolvedValue(MOCK_PAYLOAD)
    vi.mocked(listActiveSessions).mockResolvedValue([
      {
        sid: MOCK_PAYLOAD.sid,
        deviceLabel: "Chrome on macOS",
        ipAddress: "1.2.3.4",
        createdAt: "2026-01-01T00:00:00Z",
        lastActiveAt: "2026-01-01T12:00:00Z",
        isCurrent: true,
      },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.sessions).toHaveLength(1)
    expect(body.sessions[0].isCurrent).toBe(true)
    expect(body.currentSid).toBe(MOCK_PAYLOAD.sid)
  })

  it("returns empty list when user has no sessions", async () => {
    vi.mocked(requireSessionUser).mockResolvedValue(MOCK_USER)
    vi.mocked(getSessionPayloadFromCookie).mockResolvedValue(MOCK_PAYLOAD)
    vi.mocked(listActiveSessions).mockResolvedValue([])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.sessions).toHaveLength(0)
  })
})
