import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

const requireSessionUserMock = vi.fn()

const mockTemplates = [
  {
    template_id: "tmpl_blank",
    name: "Blank",
    description: "A blank template",
    ai_description: null,
    preview_url: "https://blank.alive.best",
    image_url: null,
    is_active: true,
    deploy_count: 10,
  },
]

interface MockTemplate {
  template_id: string
  name: string
  description: string | null
  ai_description: string | null
  preview_url: string | null
  image_url: string | null
  is_active: boolean
  deploy_count: number
}

let queryResult: { data: MockTemplate[] | null; error: { message: string; code: string } | null }

vi.mock("@/features/auth/lib/auth", () => {
  class AuthenticationError extends Error {
    constructor(message = "Authentication required") {
      super(message)
      this.name = "AuthenticationError"
    }
  }

  return {
    AuthenticationError,
    requireSessionUser: () => requireSessionUserMock(),
  }
})

vi.mock("@/lib/api/responses", () => ({
  structuredErrorResponse: (code: string, opts: { status: number; details?: Record<string, unknown> }) =>
    new Response(JSON.stringify({ ok: false, error: code, ...opts.details }), { status: opts.status }),
}))

vi.mock("@/lib/api/server", () => ({
  alrighty: (_endpoint: string, payload: Record<string, unknown>, init?: ResponseInit) =>
    new Response(JSON.stringify({ ok: true, ...payload }), { status: 200, ...init }),
}))

vi.mock("@/lib/supabase/app", () => ({
  createAppClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => queryResult,
        }),
      }),
    }),
  })),
}))

const { GET } = await import("../route")

describe("GET /api/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionUserMock.mockResolvedValue({ id: "user-1", email: "test@example.com" })
    queryResult = { data: mockTemplates, error: null }
  })

  it("returns 401 when authentication is missing", async () => {
    const { AuthenticationError } = await import("@/features/auth/lib/auth")
    requireSessionUserMock.mockRejectedValueOnce(new AuthenticationError())

    const response = await GET()

    expect(response.status).toBe(401)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.UNAUTHORIZED)
  })

  it("returns 200 with templates for authenticated user", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { ok: boolean; templates: unknown[] }
    expect(payload.ok).toBe(true)
    expect(payload.templates).toBeDefined()
    expect(payload.templates).toHaveLength(1)
    expect(response.headers.get("Cache-Control")).toContain("private")
  })

  it("returns 500 on supabase query error", async () => {
    queryResult = { data: null, error: { message: "connection failed", code: "PGRST000" } }

    const response = await GET()

    expect(response.status).toBe(500)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.INTERNAL_ERROR)
  })

  it("does not leak template IDs in error responses", async () => {
    queryResult = {
      data: [
        {
          template_id: "tmpl_blank",
          name: "Blank",
          description: null,
          ai_description: null,
          preview_url: null,
          image_url: null,
          is_active: true,
          deploy_count: 5,
        },
        {
          template_id: "tmpl_secret",
          name: "Secret",
          description: null,
          ai_description: null,
          preview_url: null,
          image_url: null,
          is_active: true,
          deploy_count: 3,
        },
      ],
      error: null,
    }

    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).not.toContain("tmpl_blank")
    expect(body).not.toContain("tmpl_secret")

    const json = JSON.parse(body) as { ok: boolean; error: string }
    expect(json.ok).toBe(false)
    expect(json.error).toBe(ErrorCodes.INTERNAL_ERROR)
  })
})
