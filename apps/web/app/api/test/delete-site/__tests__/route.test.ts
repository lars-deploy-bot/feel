import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockEnv = {
  NODE_ENV: "production",
  STREAM_ENV: "staging",
  E2E_TEST_SECRET: "test-secret",
}

const mockExecFile = vi.fn()
const mockAppMaybeSingle = vi.fn()
const mockOrgMaybeSingle = vi.fn()
const mockInspectSiteOccupancy = vi.fn()

vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}))

vi.mock("@webalive/env/server", () => ({
  env: mockEnv,
}))

vi.mock("@/lib/error-codes", () => ({
  ErrorCodes: {
    UNAUTHORIZED: "UNAUTHORIZED",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    SITE_NOT_FOUND: "SITE_NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
  },
}))

vi.mock("@/lib/api/responses", () => ({
  structuredErrorResponse: vi.fn((error: string, options?: { status?: number; details?: Record<string, unknown> }) => {
    return new Response(
      JSON.stringify({
        ok: false,
        error,
        details: options?.details,
      }),
      {
        status: options?.status ?? 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }),
}))

vi.mock("@/lib/supabase/app", () => ({
  createAppClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table !== "domains") {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: mockAppMaybeSingle,
          }),
        }),
      }
    },
  })),
}))

vi.mock("@/lib/supabase/iam", () => ({
  createIamClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table !== "orgs") {
        throw new Error(`Unexpected table: ${table}`)
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: mockOrgMaybeSingle,
          }),
        }),
      }
    },
  })),
}))

vi.mock("@/lib/deployment/site-occupancy", () => ({
  inspectSiteOccupancy: (slug: string) => mockInspectSiteOccupancy(slug),
}))

const MOCK_WILDCARD = "alive.best"
vi.mock("@/lib/config", () => ({
  WILDCARD_DOMAIN: MOCK_WILDCARD,
  extractSlugFromDomain: (domain: string) => {
    const suffix = `.${MOCK_WILDCARD}`
    if (domain.endsWith(suffix)) return domain.replace(suffix, "")
    return null
  },
}))

const { DELETE } = await import("../route")
const { WILDCARD_DOMAIN } = await import("@/lib/config")

function makeRequest(body: unknown, secret?: string): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (secret) {
    headers.set("x-test-secret", secret)
  }

  return new NextRequest("http://localhost/api/test/delete-site", {
    method: "DELETE",
    headers,
    body: JSON.stringify(body),
  })
}

describe("DELETE /api/test/delete-site", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.NODE_ENV = "production"
    mockEnv.STREAM_ENV = "staging"
    mockEnv.E2E_TEST_SECRET = "test-secret"

    mockAppMaybeSingle.mockResolvedValue({
      data: { org_id: "org-test", is_test_env: true },
      error: null,
    })
    mockOrgMaybeSingle.mockResolvedValue({
      data: { is_test_env: true, test_run_id: "run-123" },
      error: null,
    })
    mockExecFile.mockImplementation((_file: unknown, _args: unknown, cb: (err: Error | null) => void) => cb(null))
    mockInspectSiteOccupancy.mockReturnValue({ occupied: false })
  })

  it("returns 404 without valid test secret outside test env", async () => {
    const res = await DELETE(makeRequest({ domain: "demo.alive.best" }))
    expect(res.status).toBe(404)
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  it("returns 400 for invalid request body", async () => {
    const res = await DELETE(makeRequest({ domain: "bad domain!" }, "test-secret"))
    expect(res.status).toBe(400)
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  it("returns 403 for non-test domains", async () => {
    mockAppMaybeSingle.mockResolvedValue({
      data: { org_id: "org-prod", is_test_env: false },
      error: null,
    })
    mockOrgMaybeSingle.mockResolvedValue({
      data: { is_test_env: false, test_run_id: null },
      error: null,
    })

    const res = await DELETE(makeRequest({ domain: "prod.alive.best" }, "test-secret"))
    expect(res.status).toBe(403)
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  it("deletes test domain successfully", async () => {
    const res = await DELETE(makeRequest({ domain: "e2e-site.alive.best" }, "test-secret"))
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload).toEqual({ ok: true, domain: "e2e-site.alive.best" })
    expect(mockExecFile).toHaveBeenCalledWith(
      expect.stringContaining("/scripts/sites/delete-site.sh"),
      ["e2e-site.alive.best", "--force"],
      expect.any(Function),
    )
  })

  it("returns 500 when delete script fails", async () => {
    mockExecFile.mockImplementation((_file: unknown, _args: unknown, cb: (err: Error | null) => void) =>
      cb(new Error("delete failed")),
    )

    const res = await DELETE(makeRequest({ domain: "e2e-site.alive.best" }, "test-secret"))
    expect(res.status).toBe(500)
  })

  it("cleans leaked reusable live deploy domains when db row is already gone", async () => {
    const domain = `dl1.${WILDCARD_DOMAIN}`
    mockAppMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })
    mockInspectSiteOccupancy.mockReturnValue({
      occupied: true,
      reason: "workspace directory exists",
    })

    const res = await DELETE(makeRequest({ domain }, "test-secret"))
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload).toEqual({ ok: true, domain })
    expect(mockInspectSiteOccupancy).toHaveBeenCalledWith("dl1")
    expect(mockExecFile).toHaveBeenCalledWith(
      expect.stringContaining("/scripts/sites/delete-site.sh"),
      [domain, "--force"],
      expect.any(Function),
    )
  })

  it("keeps returning 404 for missing reusable live deploy domains without leaked occupancy", async () => {
    const domain = `dl1.${WILDCARD_DOMAIN}`
    mockAppMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })

    const res = await DELETE(makeRequest({ domain }, "test-secret"))

    expect(res.status).toBe(404)
    expect(mockInspectSiteOccupancy).toHaveBeenCalledWith("dl1")
    expect(mockExecFile).not.toHaveBeenCalled()
  })
})
