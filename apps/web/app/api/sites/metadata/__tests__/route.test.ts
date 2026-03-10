import { NextRequest, NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionUser } from "@/features/auth/lib/auth"
import type { SiteMetadata } from "@/lib/siteMetadataStore"

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

const mockUser: SessionUser = {
  id: "u1",
  email: "owner@example.com",
  name: "Owner",
  firstName: null,
  lastName: null,
  canSelectAnyModel: false,
  isAdmin: false,
  isSuperadmin: false,
  enabledModels: [],
}

let requireSessionUserResult: SessionUser | null = mockUser
let isWorkspaceAuthenticatedResult = true

vi.mock("@/features/auth/lib/auth", async () => {
  const { AuthenticationError } =
    await vi.importActual<typeof import("@/features/auth/lib/auth")>("@/features/auth/lib/auth")
  return {
    AuthenticationError,
    requireSessionUser: vi.fn(() => {
      if (!requireSessionUserResult) throw new AuthenticationError()
      return Promise.resolve(requireSessionUserResult)
    }),
    isWorkspaceAuthenticated: vi.fn(() => Promise.resolve(isWorkspaceAuthenticatedResult)),
  }
})

const mockMetadata: SiteMetadata = {
  slug: "my-site",
  domain: "my-site.alive.best",
  workspace: "/srv/webalive/sites/my-site.alive.best",
  email: "owner@example.com",
  siteIdeas: "A cool website",
  templateId: "tmpl_blank",
  createdAt: Date.now(),
}

let siteMetadataResult: SiteMetadata | null = mockMetadata

vi.mock("@/lib/siteMetadataStore", () => ({
  siteMetadataStore: {
    getSite: vi.fn(() => Promise.resolve(siteMetadataResult)),
  },
}))

vi.mock("@/lib/error-codes", () => ({
  ErrorCodes: {
    INVALID_REQUEST: "INVALID_REQUEST",
    INVALID_SLUG: "INVALID_SLUG",
    SITE_NOT_FOUND: "SITE_NOT_FOUND",
    UNAUTHORIZED: "UNAUTHORIZED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}))

vi.mock("@/lib/api/responses", () => ({
  structuredErrorResponse: vi.fn((code: string, opts?: { status?: number; details?: Record<string, unknown> }) => {
    return NextResponse.json(
      { ok: false, error: code, details: opts?.details },
      {
        status: opts?.status ?? 500,
      },
    )
  }),
}))

vi.mock("@/features/deployment/lib/slug-utils", () => ({
  isValidSlug: vi.fn((slug: string) => /^[a-z0-9-]+$/.test(slug)),
}))

const { GET } = await import("../route")

function request(slug?: string): NextRequest {
  const url = slug
    ? `http://localhost/api/sites/metadata?slug=${encodeURIComponent(slug)}`
    : "http://localhost/api/sites/metadata"
  return new NextRequest(url, { method: "GET" })
}

describe("GET /api/sites/metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireSessionUserResult = mockUser
    isWorkspaceAuthenticatedResult = true
    siteMetadataResult = mockMetadata
  })

  it("returns 401 when not authenticated", async () => {
    requireSessionUserResult = null

    const res = await GET(request("my-site"))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe("UNAUTHORIZED")
  })

  it("returns 400 when slug is missing", async () => {
    const res = await GET(request())
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("INVALID_REQUEST")
    expect(data.details.input).toBe("query")
  })

  it("returns 400 when slug is invalid", async () => {
    const res = await GET(request("INVALID SLUG!!"))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("INVALID_SLUG")
  })

  it("returns 404 when site does not exist", async () => {
    siteMetadataResult = null

    const res = await GET(request("nonexistent"))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe("SITE_NOT_FOUND")
  })

  it("returns 404 when user does not own the site to prevent slug enumeration", async () => {
    isWorkspaceAuthenticatedResult = false

    const res = await GET(request("my-site"))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe("SITE_NOT_FOUND")
  })

  it("returns metadata for authorized site owner", async () => {
    const res = await GET(request("my-site"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.metadata.slug).toBe("my-site")
    expect(data.metadata.domain).toBe("my-site.alive.best")
    expect(data.metadata.siteIdeas).toBe("A cool website")
  })
})
