import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

const requireSessionUserMock = vi.fn()
const validateUserOrgAccessMock = vi.fn()
const getUserQuotaMock = vi.fn()
const validateTemplateFromDbMock = vi.fn()
const runStrictDeploymentMock = vi.fn()
const normalizeAndValidateDomainMock = vi.fn()
const domainToSlugMock = vi.fn()
const refreshSessionJwtForOrgMock = vi.fn()
const persistNewSiteMetadataMock = vi.fn()
const scheduleSiteSslValidationMock = vi.fn()

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

vi.mock("@/features/manager/lib/domain-utils", () => ({
  normalizeAndValidateDomain: (...args: unknown[]) => normalizeAndValidateDomainMock(...args),
  domainToSlug: (...args: unknown[]) => domainToSlugMock(...args),
}))

vi.mock("@/lib/deployment/org-resolver", () => ({
  validateUserOrgAccess: (...args: unknown[]) => validateUserOrgAccessMock(...args),
}))

vi.mock("@/lib/deployment/user-quotas", () => ({
  getUserQuota: (...args: unknown[]) => getUserQuotaMock(...args),
}))

vi.mock("@/lib/deployment/template-validation", () => ({
  validateTemplateFromDb: (...args: unknown[]) => validateTemplateFromDbMock(...args),
}))

vi.mock("@/lib/deployment/deploy-pipeline", () => ({
  runStrictDeployment: (...args: unknown[]) => runStrictDeploymentMock(...args),
}))

vi.mock("@/lib/deployment/new-site-lifecycle", () => ({
  buildNewSiteSuccessPayload: ({
    message,
    domain,
    orgId,
    executionMode,
  }: {
    message: string
    domain: string
    orgId?: string
    executionMode: string
  }) => ({
    ok: true,
    message,
    domain,
    orgId,
    executionMode,
    chatUrl: `/chat?workspace=${encodeURIComponent(domain)}`,
  }),
  persistNewSiteMetadata: (...args: unknown[]) => persistNewSiteMetadataMock(...args),
  refreshSessionJwtForOrg: (...args: unknown[]) => refreshSessionJwtForOrgMock(...args),
  scheduleSiteSslValidation: (...args: unknown[]) => scheduleSiteSslValidationMock(...args),
}))

const { POST } = await import("../route")

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("/api/deploy", () => {
  it("does not export a GET handler", async () => {
    const routeModule = await import("../route")
    expect(routeModule).not.toHaveProperty("GET")
  })
})

describe("POST /api/deploy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    normalizeAndValidateDomainMock.mockReset()
    domainToSlugMock.mockReset()
    refreshSessionJwtForOrgMock.mockReset()
    persistNewSiteMetadataMock.mockReset()
    scheduleSiteSslValidationMock.mockReset()
    getUserQuotaMock.mockReset()
    requireSessionUserMock.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
    })
    normalizeAndValidateDomainMock.mockReturnValue({
      domain: "example.com",
      isValid: true,
    })
    domainToSlugMock.mockReturnValue("example-com")
    validateUserOrgAccessMock.mockResolvedValue(true)
    getUserQuotaMock.mockResolvedValue({
      canCreateSite: true,
      maxSites: 10,
      currentSites: 1,
    })
    validateTemplateFromDbMock.mockResolvedValue({
      valid: true,
      template: {
        template_id: "tmpl_blank",
        source_path: "/srv/webalive/templates/blank.alive.best",
      },
    })
    runStrictDeploymentMock.mockResolvedValue({
      domain: "example.com",
      port: 3700,
      serviceName: "site@example-com.service",
      executionMode: "systemd",
    })
    persistNewSiteMetadataMock.mockResolvedValue(undefined)
    scheduleSiteSslValidationMock.mockReturnValue(undefined)
    refreshSessionJwtForOrgMock.mockResolvedValue(undefined)
  })

  it("uses the strict deployment pipeline for authenticated users", async () => {
    const response = await POST(
      createRequest({
        domain: "Example.com",
        orgId: "org-1",
        templateId: "tmpl_blank",
      }),
    )

    expect(response.status).toBe(200)
    expect(runStrictDeploymentMock).toHaveBeenCalledOnce()
    expect(runStrictDeploymentMock.mock.calls[0][0]).toMatchObject({
      domain: "example.com",
      email: "owner@example.com",
      orgId: "org-1",
      templatePath: "/srv/webalive/templates/blank.alive.best",
    })
    expect(domainToSlugMock).toHaveBeenCalledWith("example.com")
    expect(persistNewSiteMetadataMock).toHaveBeenCalledWith({
      slug: "example-com",
      metadata: expect.objectContaining({
        slug: "example-com",
        domain: "example.com",
      }),
      executionMode: "systemd",
    })
    expect(scheduleSiteSslValidationMock).toHaveBeenCalledWith("example.com", "systemd")
    expect(refreshSessionJwtForOrgMock).toHaveBeenCalledWith({
      orgId: "org-1",
      sessionUser: expect.objectContaining({
        id: "user-1",
        email: "owner@example.com",
      }),
      logPrefix: "[Deploy]",
      setSessionCookie: expect.any(Function),
    })

    const payload = (await response.json()) as Record<string, unknown>
    expect(payload.ok).toBe(true)
    expect(payload.domain).toBe("example.com")
    expect(payload.executionMode).toBe("systemd")
    expect(payload.message).toContain("SSL provisioning in progress")
    expect(String(payload.chatUrl)).toContain("workspace=example.com")
  })

  it("returns the non-SSL success message for e2b deployments", async () => {
    runStrictDeploymentMock.mockResolvedValueOnce({
      domain: "example.com",
      port: 3700,
      serviceName: "e2b-site@example.com",
      executionMode: "e2b",
    })

    const response = await POST(
      createRequest({
        domain: "example.com",
        orgId: "org-1",
        templateId: "tmpl_blank",
      }),
    )

    expect(response.status).toBe(200)
    expect(scheduleSiteSslValidationMock).toHaveBeenCalledWith("example.com", "e2b")

    const payload = (await response.json()) as Record<string, unknown>
    expect(payload.executionMode).toBe("e2b")
    expect(payload.message).toBe("Site example.com deployed successfully!")
  })

  it("skips JWT refresh when no orgId is provided", async () => {
    const response = await POST(
      createRequest({
        domain: "example.com",
        templateId: "tmpl_blank",
      }),
    )

    expect(response.status).toBe(200)
    expect(refreshSessionJwtForOrgMock).toHaveBeenCalledWith({
      orgId: undefined,
      sessionUser: expect.objectContaining({
        id: "user-1",
        email: "owner@example.com",
      }),
      logPrefix: "[Deploy]",
      setSessionCookie: expect.any(Function),
    })
  })

  it("returns 401 when authentication is missing", async () => {
    const { AuthenticationError } = await import("@/features/auth/lib/auth")
    requireSessionUserMock.mockRejectedValueOnce(new AuthenticationError())

    const response = await POST(
      createRequest({
        domain: "example.com",
        orgId: "org-1",
      }),
    )

    expect(response.status).toBe(401)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.UNAUTHORIZED)
    expect(runStrictDeploymentMock).not.toHaveBeenCalled()
  })

  it("returns 403 when site quota is exceeded", async () => {
    getUserQuotaMock.mockResolvedValueOnce({
      canCreateSite: false,
      maxSites: 3,
      currentSites: 3,
    })

    const response = await POST(
      createRequest({
        domain: "example.com",
        orgId: "org-1",
        templateId: "tmpl_blank",
      }),
    )

    expect(response.status).toBe(403)
    expect(runStrictDeploymentMock).not.toHaveBeenCalled()
  })

  it("allows superadmins to bypass site quota checks", async () => {
    requireSessionUserMock.mockResolvedValueOnce({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      isSuperadmin: true,
    })
    getUserQuotaMock.mockResolvedValueOnce({
      canCreateSite: false,
      maxSites: 1,
      currentSites: 1,
    })

    const response = await POST(
      createRequest({
        domain: "example.com",
        templateId: "tmpl_blank",
      }),
    )

    expect(response.status).toBe(200)
    expect(getUserQuotaMock).not.toHaveBeenCalled()
    expect(runStrictDeploymentMock).toHaveBeenCalledOnce()
  })

  it("supports custom domains outside the wildcard domain", async () => {
    // Reset quota mock — previous test queues a canCreateSite:false that wasn't consumed
    getUserQuotaMock.mockReset()
    getUserQuotaMock.mockResolvedValue({ canCreateSite: true, maxSites: 10, currentSites: 1 })
    normalizeAndValidateDomainMock.mockReturnValueOnce({
      domain: "customer-owned-domain.com",
      isValid: true,
    })
    runStrictDeploymentMock.mockResolvedValueOnce({
      domain: "customer-owned-domain.com",
      port: 3700,
      serviceName: "site@customer-owned-domain-com.service",
      executionMode: "systemd",
    })
    domainToSlugMock.mockReturnValueOnce("customer-owned-domain-com")

    const response = await POST(
      createRequest({
        domain: "customer-owned-domain.com",
        templateId: "tmpl_blank",
      }),
    )

    expect(response.status).toBe(200)
    expect(runStrictDeploymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "customer-owned-domain.com",
      }),
    )
  })
})
