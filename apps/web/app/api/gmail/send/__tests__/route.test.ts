import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSend = vi.fn()
const mockGetProfile = vi.fn()
const mockSetCredentials = vi.fn()
const mockGetAccessToken = vi.fn()

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

vi.mock("@/features/auth/lib/auth", () => ({
  getSessionUser: vi.fn(),
}))

vi.mock("@/lib/api/responses", async () => {
  const { NextResponse } = await import("next/server")
  return {
    structuredErrorResponse: vi.fn((code, { status, details }) => {
      return NextResponse.json({ ok: false, error: code, ...details }, { status })
    }),
  }
})

vi.mock("@/lib/oauth/oauth-instances", () => ({
  getOAuthInstance: vi.fn(() => ({
    getAccessToken: mockGetAccessToken,
  })),
}))

vi.mock("@googleapis/gmail", () => {
  class MockOAuth2 {
    setCredentials = mockSetCredentials
  }

  class MockGmail {
    users = {
      messages: { send: mockSend },
      drafts: { create: vi.fn() },
      getProfile: mockGetProfile,
    }
  }

  return {
    auth: { OAuth2: MockOAuth2 },
    gmail_v1: { Gmail: MockGmail },
  }
})

const { POST } = await import("../route")
const { getSessionUser } = await import("@/features/auth/lib/auth")
const { getOAuthInstance } = await import("@/lib/oauth/oauth-instances")

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/gmail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = {
  to: ["recipient@example.com"],
  subject: "Hello",
  body: "World",
}

describe("POST /api/gmail/send", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getSessionUser).mockResolvedValue({ id: "user-1" } as never)
    vi.mocked(getOAuthInstance).mockReturnValue({ getAccessToken: mockGetAccessToken } as never)
    mockGetAccessToken.mockResolvedValue("access-token-1")
    mockGetProfile.mockResolvedValue({ data: { emailAddress: "sender@example.com" } })
    mockSend.mockResolvedValue({
      data: { id: "msg_abc", threadId: "thread_xyz" },
    })
  })

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("UNAUTHORIZED")
  })

  // --- Validation (now via handleBody / Zod) ---

  it("returns 400 when 'to' is missing", async () => {
    const res = await POST(createRequest({ subject: "Hi", body: "hey" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when 'to' is empty array", async () => {
    const res = await POST(createRequest({ to: [], subject: "Hi", body: "hey" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when 'subject' is missing", async () => {
    const res = await POST(createRequest({ to: ["a@b.com"], body: "hey" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when 'body' is missing", async () => {
    const res = await POST(createRequest({ to: ["a@b.com"], subject: "Hi" }))
    expect(res.status).toBe(400)
  })

  // --- OAuth ---

  it("returns 403 when Gmail is not connected", async () => {
    mockGetAccessToken.mockRejectedValueOnce(new Error("no token"))
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INTEGRATION_ERROR")
    expect(data.reason).toContain("Gmail not connected")
  })

  // --- Sender email ---

  it("returns 500 when sender email cannot be determined", async () => {
    mockGetProfile.mockResolvedValueOnce({ data: { emailAddress: null } })
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INTEGRATION_ERROR")
    expect(data.reason).toContain("sender email")
  })

  // --- Successful send ---

  it("sends email and returns messageId + threadId", async () => {
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      ok: true,
      messageId: "msg_abc",
      threadId: "thread_xyz",
    })
  })

  it("sends email with cc, bcc, and threadId", async () => {
    const res = await POST(
      createRequest({
        ...validBody,
        cc: ["cc@example.com"],
        bcc: ["bcc@example.com"],
        threadId: "thread_1",
      }),
    )
    expect(res.status).toBe(200)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "me",
        requestBody: expect.objectContaining({
          threadId: "thread_1",
        }),
      }),
    )
  })

  it("returns threadId as undefined when Gmail omits it", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "msg_1", threadId: null } })
    const res = await POST(createRequest(validBody))
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.messageId).toBe("msg_1")
    expect(data.threadId).toBeUndefined()
  })

  // --- API failure ---

  it("returns 500 when Gmail API does not return message ID", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: null } })
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INTEGRATION_ERROR")
  })

  it("returns 500 on unexpected Gmail API error", async () => {
    mockSend.mockRejectedValueOnce(new Error("Gmail 500"))
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INTEGRATION_ERROR")
    expect(data.reason).toBe("Gmail 500")
  })
})
