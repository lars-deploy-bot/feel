import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetAccessToken = vi.fn()
const mockFetch = vi.fn()

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

// Mock global fetch for Microsoft Graph calls
vi.stubGlobal("fetch", mockFetch)

const { POST } = await import("../route")
const { getSessionUser } = await import("@/features/auth/lib/auth")
const { getOAuthInstance } = await import("@/lib/oauth/oauth-instances")

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/outlook/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validBody = {
  to: ["recipient@example.com"],
  subject: "Draft subject",
  body: "Draft body",
}

describe("POST /api/outlook/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getSessionUser).mockResolvedValue({ id: "user-1" } as never)
    vi.mocked(getOAuthInstance).mockReturnValue({ getAccessToken: mockGetAccessToken } as never)
    mockGetAccessToken.mockResolvedValue("access-token-1")

    // Default: /me returns profile, /me/messages returns draft
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith("/me") && !url.includes("messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ mail: "sender@example.com" }),
        })
      }
      if (url.includes("/me/messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "draft_abc" }),
        })
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("Not found") })
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

  // --- Validation ---

  it("returns 400 when 'to' is missing", async () => {
    const res = await POST(createRequest({ subject: "Hi", body: "hey" }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INVALID_REQUEST")
    expect(data.reason).toContain("Missing required fields")
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

  it("returns 403 when Outlook is not connected", async () => {
    mockGetAccessToken.mockRejectedValueOnce(new Error("no token"))
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INTEGRATION_ERROR")
    expect(data.reason).toContain("Outlook not connected")
  })

  // --- Sender email ---

  it("returns 500 when sender email cannot be determined", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith("/me") && !url.includes("messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ mail: null, userPrincipalName: null }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "draft_abc" }) })
    })
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INTEGRATION_ERROR")
    expect(data.reason).toContain("sender email")
  })

  // --- Successful draft ---

  it("saves draft and returns draftId", async () => {
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      ok: true,
      draftId: "draft_abc",
    })
  })

  it("calls Graph API with correct payload including cc and threadId", async () => {
    const res = await POST(
      createRequest({
        ...validBody,
        cc: ["cc@example.com"],
        threadId: "thread_1",
      }),
    )
    expect(res.status).toBe(200)

    const draftCall = mockFetch.mock.calls.find(call => {
      const url = call[0]
      return typeof url === "string" && url.includes("/me/messages")
    })
    expect(draftCall).toBeDefined()
    const payload = JSON.parse((draftCall![1] as { body: string }).body)
    expect(payload.toRecipients).toEqual([{ emailAddress: { address: "recipient@example.com" } }])
    expect(payload.ccRecipients).toEqual([{ emailAddress: { address: "cc@example.com" } }])
    expect(payload.conversationId).toBe("thread_1")
  })

  // --- API failure ---

  it("returns 500 when Graph API does not return draft ID", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith("/me") && !url.includes("messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ mail: "sender@example.com" }),
        })
      }
      if (url.includes("/me/messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: null }),
        })
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("Not found") })
    })
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INTEGRATION_ERROR")
  })

  it("returns 500 when Graph API request fails", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith("/me") && !url.includes("messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ mail: "sender@example.com" }),
        })
      }
      if (url.includes("/me/messages")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Internal Server Error"),
        })
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("Not found") })
    })
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INTEGRATION_ERROR")
  })

  it("returns 500 on unexpected fetch error", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith("/me") && !url.includes("messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ mail: "sender@example.com" }),
        })
      }
      if (url.includes("/me/messages")) {
        return Promise.reject(new Error("Network error"))
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("Not found") })
    })
    const res = await POST(createRequest(validBody))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.error).toBe("INTEGRATION_ERROR")
    expect(data.reason).toBe("Network error")
  })
})
