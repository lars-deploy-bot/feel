import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

const getSessionUserMock = vi.fn()
const validateUserOrgAccessMock = vi.fn()
const getUserQuotaMock = vi.fn()
const parseGithubRepoWithUrlsMock = vi.fn((_url: string) => ({
  owner: "example",
  repo: "repo",
  canonicalUrl: "https://github.com/example/repo",
  remoteUrl: "https://github.com/example/repo.git",
}))
const importGithubRepoMock = vi.fn()
const cleanupImportDirMock = vi.fn()
const getAccessTokenMock = vi.fn()
const runStrictDeploymentMock = vi.fn()
const siteMetadataExistsMock = vi.fn((_slug: string) => false)
const siteMetadataSetSiteMock =
  vi.fn<(slug: string, metadata: unknown, options?: { workspaceRoot?: string }) => Promise<void>>()
const handleBodyMock = vi.fn()

vi.mock("@/features/auth/lib/auth", () => ({
  getSessionUser: () => getSessionUserMock(),
}))

vi.mock("@/features/auth/lib/jwt", () => ({
  createSessionToken: vi.fn(() => "new-session-token"),
  refreshSessionTokenWithOrg: vi.fn(() => Promise.resolve("new-session-token")),
  verifySessionToken: vi.fn(() => ({
    orgIds: ["org-123"],
    scopes: [],
    orgRoles: {},
  })),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ value: "session-cookie" })),
  })),
}))

vi.mock("@/lib/api/server", () => ({
  handleBody: (...args: unknown[]) => handleBodyMock(...args),
  isHandleBodyError: vi.fn(() => false),
  alrighty: vi.fn((_endpoint: string, payload: Record<string, unknown>) => {
    const response = new Response(JSON.stringify(payload), { status: 200 })
    ;(response as Response & { cookies: { set: typeof vi.fn } }).cookies = { set: vi.fn() }
    return response
  }),
}))

vi.mock("@/lib/api/responses", () => ({
  structuredErrorResponse: vi.fn(
    (code: string, opts: { status: number; details?: Record<string, unknown> }) =>
      new Response(JSON.stringify({ ok: false, error: code, ...opts.details }), { status: opts.status }),
  ),
}))

const MOCK_WORKSPACE_BASE = "/srv/webalive/sites"

vi.mock("@/lib/config", () => ({
  buildSubdomain: vi.fn((slug: string) => `${slug}.alive.best`),
  WORKSPACE_BASE: MOCK_WORKSPACE_BASE,
}))

vi.mock("@/lib/deployment/org-resolver", () => ({
  validateUserOrgAccess: (...args: unknown[]) => validateUserOrgAccessMock(...args),
}))

vi.mock("@/lib/deployment/user-quotas", () => ({
  getUserQuota: (...args: unknown[]) => getUserQuotaMock(...args),
}))

vi.mock("@/lib/deployment/github-import", () => ({
  importGithubRepo: (...args: unknown[]) => importGithubRepoMock(...args),
  cleanupImportDir: (...args: unknown[]) => cleanupImportDirMock(...args),
}))

vi.mock("@/lib/git/github-repo-url", () => ({
  parseGithubRepoWithUrls: (repoRef: string) => parseGithubRepoWithUrlsMock(repoRef),
}))

vi.mock("@/lib/deployment/deploy-pipeline", () => ({
  runStrictDeployment: (...args: unknown[]) => runStrictDeploymentMock(...args),
}))

vi.mock("@/lib/deployment/site-occupancy", () => ({
  inspectSiteOccupancy: vi.fn(() => ({ occupied: false })),
}))

vi.mock("@/lib/auth/cookies", () => ({
  setSessionCookie: vi.fn(),
}))

vi.mock("@/lib/deployment/ssl-validation", () => ({
  validateSSLCertificate: vi.fn(() => Promise.resolve()),
}))

vi.mock("@/lib/oauth/oauth-instances", () => ({
  getOAuthInstance: vi.fn(() => ({
    getAccessToken: (...args: unknown[]) => getAccessTokenMock(...args),
  })),
}))

vi.mock("@/lib/error-logger", () => ({
  errorLogger: { capture: vi.fn() },
}))

vi.mock("@/lib/siteMetadataStore", () => ({
  siteMetadataStore: {
    exists: (slug: string) => siteMetadataExistsMock(slug),
    setSite: (slug: string, metadata: unknown, options?: { workspaceRoot?: string }) =>
      siteMetadataSetSiteMock(slug, metadata, options),
  },
}))

const MOCK_E2B_SCRATCH = "/mock/e2b-scratch"

vi.mock("@/lib/sandbox/e2b-workspace", () => ({
  getE2bScratchSiteRoot: vi.fn((domain: string) => `${MOCK_E2B_SCRATCH}/${domain}`),
}))

vi.mock("@/lib/site-workspace-registry", () => ({
  siteWorkspaceExists: vi.fn(() => false),
  getSiteWorkspaceRoot: vi.fn((domain: string, mode: string) =>
    mode === "e2b" ? `${MOCK_E2B_SCRATCH}/${domain}` : `${MOCK_WORKSPACE_BASE}/${domain}`,
  ),
  getSiteWorkspaceCandidates: vi.fn(() => []),
}))

vi.mock("@webalive/shared", async importOriginal => {
  const actual = await importOriginal<typeof import("@webalive/shared")>()
  return {
    ...actual,
    getOAuthKeyForProvider: vi.fn(() => "github"),
  }
})

const { POST } = await import("../route")

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/import-repo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("/api/import-repo", () => {
  it("does not export a GET handler", async () => {
    const routeModule = await import("../route")
    expect(routeModule).not.toHaveProperty("GET")
  })
})

describe("POST /api/import-repo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUserMock.mockReset()
    validateUserOrgAccessMock.mockReset()
    getUserQuotaMock.mockReset()
    getAccessTokenMock.mockReset()
    handleBodyMock.mockReset()
    siteMetadataExistsMock.mockReset()
    parseGithubRepoWithUrlsMock.mockReset()
    importGithubRepoMock.mockReset()
    cleanupImportDirMock.mockReset()
    runStrictDeploymentMock.mockReset()
    siteMetadataSetSiteMock.mockReset()

    getSessionUserMock.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
    })
    validateUserOrgAccessMock.mockResolvedValue(true)
    getUserQuotaMock.mockResolvedValue({
      canCreateSite: true,
      maxSites: 10,
      currentSites: 1,
    })
    getAccessTokenMock.mockResolvedValue("github-token")
    handleBodyMock.mockResolvedValue({
      slug: "testsite",
      repoUrl: "https://github.com/example/repo",
      orgId: "org-1",
      siteIdeas: "imported site",
    })
    siteMetadataExistsMock.mockReturnValue(false)
    parseGithubRepoWithUrlsMock.mockReturnValue({
      owner: "example",
      repo: "repo",
      canonicalUrl: "https://github.com/example/repo",
      remoteUrl: "https://github.com/example/repo.git",
    })
    importGithubRepoMock.mockResolvedValue({
      templatePath: "/tmp/import/template",
      cleanupDir: "/tmp/import",
    })
    runStrictDeploymentMock.mockResolvedValue({
      domain: "testsite.alive.best",
      port: 3700,
      serviceName: "site@testsite-alive-best.service",
      executionMode: "systemd",
    })
    siteMetadataSetSiteMock.mockResolvedValue(undefined)
  })

  it("requires authentication", async () => {
    getSessionUserMock.mockResolvedValueOnce(null)

    const response = await POST(createRequest({ slug: "testsite", repoUrl: "https://github.com/example/repo" }))

    expect(response.status).toBe(401)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.UNAUTHORIZED)
    expect(runStrictDeploymentMock).not.toHaveBeenCalled()
  })

  it("uses the strict deployment pipeline for GitHub imports", async () => {
    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
        orgId: "org-1",
      }),
    )

    expect(response.status).toBe(200)
    expect(runStrictDeploymentMock).toHaveBeenCalledOnce()
    expect(runStrictDeploymentMock.mock.calls[0][0]).toMatchObject({
      domain: "testsite.alive.best",
      email: "owner@example.com",
      orgId: "org-1",
      templatePath: "/tmp/import/template",
    })
    expect(cleanupImportDirMock).toHaveBeenCalledWith("/tmp/import")
  })

  it("stores imported metadata in the e2b scratch root when sandbox mode is enabled", async () => {
    runStrictDeploymentMock.mockResolvedValueOnce({
      domain: "testsite.alive.best",
      port: 3701,
      serviceName: "e2b-site@testsite.alive.best",
      executionMode: "e2b",
    })

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
        orgId: "org-1",
      }),
    )

    expect(response.status).toBe(200)
    expect(siteMetadataSetSiteMock).toHaveBeenCalledWith(
      "testsite",
      expect.objectContaining({
        domain: "testsite.alive.best",
      }),
      { workspaceRoot: `${MOCK_E2B_SCRATCH}/testsite.alive.best` },
    )

    const payload = (await response.json()) as { executionMode: string }
    expect(payload.executionMode).toBe("e2b")
  })

  it("returns 403 when site quota is exceeded", async () => {
    getUserQuotaMock.mockResolvedValueOnce({
      canCreateSite: false,
      maxSites: 3,
      currentSites: 3,
    })

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
        orgId: "org-1",
      }),
    )

    expect(response.status).toBe(403)
    expect(runStrictDeploymentMock).not.toHaveBeenCalled()
    expect(cleanupImportDirMock).not.toHaveBeenCalled()
  })

  it("returns 409 when slug already exists", async () => {
    siteMetadataExistsMock.mockReturnValueOnce(true)

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
      }),
    )

    expect(response.status).toBe(409)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.SLUG_TAKEN)
    expect(runStrictDeploymentMock).not.toHaveBeenCalled()
  })

  it("returns 409 when slug already exists even if quota is exceeded", async () => {
    siteMetadataExistsMock.mockReturnValueOnce(true)
    getUserQuotaMock.mockResolvedValueOnce({
      canCreateSite: false,
      maxSites: 1,
      currentSites: 1,
    })

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
      }),
    )

    expect(response.status).toBe(409)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.SLUG_TAKEN)
    expect(getUserQuotaMock).not.toHaveBeenCalled()
    expect(runStrictDeploymentMock).not.toHaveBeenCalled()
  })

  it("returns 400 when repository format is invalid", async () => {
    parseGithubRepoWithUrlsMock.mockImplementationOnce(() => {
      throw new Error("Invalid GitHub repo format")
    })

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "invalid-input",
      }),
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(runStrictDeploymentMock).not.toHaveBeenCalled()
  })

  it("returns 400 when download fails", async () => {
    importGithubRepoMock.mockRejectedValueOnce(new Error("Repository example/repo not found"))

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
      }),
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.GITHUB_CLONE_FAILED)
  })

  it("proceeds without GitHub token for public repos", async () => {
    getAccessTokenMock.mockResolvedValueOnce(null)

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
        orgId: "org-1",
      }),
    )

    expect(response.status).toBe(200)
    expect(importGithubRepoMock).toHaveBeenCalledWith("https://github.com/example/repo", undefined, undefined)
  })

  it("proceeds without GitHub token when OAuth throws", async () => {
    getAccessTokenMock.mockRejectedValueOnce(new Error("OAuth not configured"))

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
        orgId: "org-1",
      }),
    )

    expect(response.status).toBe(200)
    expect(importGithubRepoMock).toHaveBeenCalledWith("https://github.com/example/repo", undefined, undefined)
  })

  it("passes GitHub token when available", async () => {
    getAccessTokenMock.mockResolvedValueOnce("github-token-123")

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
        orgId: "org-1",
      }),
    )

    expect(response.status).toBe(200)
    expect(importGithubRepoMock).toHaveBeenCalledWith("https://github.com/example/repo", "github-token-123", undefined)
  })

  it("stores canonical sourceRepo and sourceBranch metadata", async () => {
    parseGithubRepoWithUrlsMock.mockReturnValueOnce({
      owner: "Acme",
      repo: "Toolkit",
      canonicalUrl: "https://github.com/Acme/Toolkit",
      remoteUrl: "https://github.com/Acme/Toolkit.git",
    })
    handleBodyMock.mockResolvedValueOnce({
      slug: "testsite",
      repoUrl: "Acme/Toolkit.git",
      branch: "release/v2",
      orgId: "org-1",
      siteIdeas: "imported site",
    })

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "Acme/Toolkit.git",
        branch: "release/v2",
        orgId: "org-1",
      }),
    )

    expect(response.status).toBe(200)
    expect(siteMetadataSetSiteMock).toHaveBeenCalledWith(
      "testsite",
      expect.objectContaining({
        source: "github-import",
        sourceRepo: "https://github.com/Acme/Toolkit",
        sourceBranch: "release/v2",
      }),
      { workspaceRoot: `${MOCK_WORKSPACE_BASE}/testsite.alive.best` },
    )
  })

  it("allows superadmins to bypass site quota checks", async () => {
    getSessionUserMock.mockResolvedValueOnce({
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
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
        orgId: "org-1",
      }),
    )

    expect(response.status).toBe(200)
    expect(getUserQuotaMock).not.toHaveBeenCalled()
    expect(runStrictDeploymentMock).toHaveBeenCalledOnce()
  })

  it("succeeds even when metadata persistence fails (non-fatal)", async () => {
    siteMetadataSetSiteMock.mockRejectedValueOnce(new Error("disk full"))

    const response = await POST(
      createRequest({
        slug: "testsite",
        repoUrl: "https://github.com/example/repo",
        orgId: "org-1",
      }),
    )

    // Metadata persistence is non-fatal — the site is deployed, only metadata write failed
    expect(response.status).toBe(200)
    expect(runStrictDeploymentMock).toHaveBeenCalledOnce()
    expect(cleanupImportDirMock).toHaveBeenCalledWith("/tmp/import")
  })
})
