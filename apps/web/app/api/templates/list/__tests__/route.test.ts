import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

const requireSessionUserMock = vi.fn()
const listTemplatesMock = vi.fn()

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

vi.mock("@webalive/tools", () => ({
  listTemplates: () => listTemplatesMock(),
}))

const { GET } = await import("../route")

describe("GET /api/templates/list", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionUserMock.mockResolvedValue({ id: "user-1", email: "test@example.com" })
    listTemplatesMock.mockResolvedValue([{ id: "tmpl_1", name: "Blank", category: "starter" }])
  })

  it("returns 401 when authentication is missing", async () => {
    const { AuthenticationError } = await import("@/features/auth/lib/auth")
    requireSessionUserMock.mockRejectedValueOnce(new AuthenticationError())

    const response = await GET()

    expect(response.status).toBe(401)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.UNAUTHORIZED)
    expect(listTemplatesMock).not.toHaveBeenCalled()
  })

  it("returns 200 with templates for authenticated user", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { templates: unknown[] }
    expect(payload.templates).toBeDefined()
    expect(payload.templates).toHaveLength(1)
    expect(response.headers.get("Cache-Control")).toContain("private")
  })

  it("returns 500 on internal error", async () => {
    listTemplatesMock.mockRejectedValueOnce(new Error("filesystem error"))

    const response = await GET()

    expect(response.status).toBe(500)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.INTERNAL_ERROR)
  })
})
