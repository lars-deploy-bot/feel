import { caddySitesFilteredPath, PATHS } from "@webalive/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

const MOCK_E2B_SCRATCH = "/mock/e2b-scratch"

const callOrder: string[] = []

const pathExists = vi.fn<(filePath: string) => boolean>(() => false)
const checkDomainInCaddyMock = vi.fn<(domain: string, caddyfilePath: string) => Promise<boolean>>(async () => true)
const configureCaddyMock = vi.fn<(input: unknown) => Promise<void>>(async () => {
  callOrder.push("configureCaddy")
})
const teardownMock = vi.fn<(domain: string, options: unknown) => Promise<void>>(async () => undefined)
const isDomainRegisteredMock = vi.fn<(hostname: string) => Promise<boolean>>(async () => false)
const unregisterDomainMock = vi.fn<(hostname: string) => Promise<boolean>>(async () => true)
const deploySiteMock = vi.fn<(input: unknown) => Promise<{ domain: string; port: number; serviceName: string }>>(
  async () => ({
    domain: "testsite.test.example",
    port: 3700,
    serviceName: "site@testsite-test-example.service",
  }),
)
const registerDomainMock = vi.fn<(input: unknown) => Promise<void>>(async () => undefined)
const rmMock = vi.fn<(targetPath: string, options: { recursive: boolean; force: boolean }) => Promise<void>>(
  async () => undefined,
)
const getNewSiteExecutionModeMock = vi.fn<() => "systemd" | "e2b">(() => "systemd")
const prepareE2bSiteDeploymentMock = vi.fn<
  (input: unknown) => Promise<{ port: number; serviceName: string; scratchWorkspace: string }>
>(async () => ({
  port: 3701,
  serviceName: "e2b-site@testsite.test.example",
  scratchWorkspace: `${MOCK_E2B_SCRATCH}/testsite.test.example/user`,
}))
const createInitialSiteSandboxMock = vi.fn<(domain: unknown, scratchWorkspace: string) => Promise<void>>(
  async () => undefined,
)
const resolveDomainRuntimeMock = vi.fn<
  (hostname: string) => Promise<{
    domain_id: string
    hostname: string
    port: number
    is_test_env: boolean
    test_run_id: string | null
    execution_mode: "e2b"
    sandbox_id: string | null
    sandbox_status: null
  } | null>
>(async hostname => ({
  domain_id: "dom_123",
  hostname,
  port: 3701,
  is_test_env: false,
  test_run_id: null,
  execution_mode: "e2b",
  sandbox_id: null,
  sandbox_status: null,
}))

vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return {
    ...actual,
    existsSync: (filePath: string) => pathExists(filePath),
  }
})

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    rm: (targetPath: string, options: { recursive: boolean; force: boolean }) => rmMock(targetPath, options),
  }
})

vi.mock("../deploy-site", () => ({
  deploySite: (input: unknown) => {
    callOrder.push("deploySite")
    return deploySiteMock(input)
  },
}))

vi.mock("../domain-registry", () => ({
  isDomainRegistered: (hostname: string) => isDomainRegisteredMock(hostname),
  registerDomain: (input: unknown) => {
    callOrder.push("registerDomain")
    return registerDomainMock(input)
  },
  unregisterDomain: (hostname: string) => unregisterDomainMock(hostname),
  DomainRegistrationError: class DomainRegistrationError extends Error {
    errorCode: string
    details: Record<string, unknown>
    constructor(errorCode: string, message: string, details: Record<string, unknown> = {}) {
      super(message)
      this.errorCode = errorCode
      this.details = details
    }
  },
}))

vi.mock("@webalive/site-controller", () => ({
  checkDomainInCaddy: (domain: string, caddyfilePath: string) => checkDomainInCaddyMock(domain, caddyfilePath),
  configureCaddy: (input: unknown) => configureCaddyMock(input),
  regeneratePortMap: async () => 1,
  SiteOrchestrator: {
    teardown: (domain: string, options: unknown) => teardownMock(domain, options),
  },
}))

vi.mock("@/lib/sandbox/e2b-workspace", () => ({
  getE2bScratchSiteRoot: (domain: string) => `${MOCK_E2B_SCRATCH}/${domain}`,
  getNewSiteExecutionMode: () => getNewSiteExecutionModeMock(),
}))

vi.mock("../e2b-site-deployment", () => ({
  prepareE2bSiteDeployment: (input: unknown) => {
    callOrder.push("prepareE2bSiteDeployment")
    return prepareE2bSiteDeploymentMock(input)
  },
  createInitialSiteSandbox: (domain: unknown, scratchWorkspace: string) => {
    callOrder.push("createInitialSiteSandbox")
    return createInitialSiteSandboxMock(domain, scratchWorkspace)
  },
}))

vi.mock("@/lib/domain/resolve-domain-runtime", () => ({
  resolveDomainRuntime: (hostname: string) => resolveDomainRuntimeMock(hostname),
}))

const { runStrictDeployment } = await import("../deploy-pipeline")
const { DomainRegistrationError } = await import("../domain-registry")

describe("runStrictDeployment", () => {
  beforeEach(() => {
    delete process.env.SERVER_CONFIG_PATH
    delete process.env.ALIVE_ENV

    callOrder.length = 0

    pathExists.mockReset()
    pathExists.mockReturnValue(false)

    checkDomainInCaddyMock.mockReset()
    checkDomainInCaddyMock.mockResolvedValue(true)

    configureCaddyMock.mockReset()
    configureCaddyMock.mockImplementation(async () => {
      callOrder.push("configureCaddy")
    })

    teardownMock.mockReset()
    teardownMock.mockResolvedValue(undefined)

    isDomainRegisteredMock.mockReset()
    isDomainRegisteredMock.mockResolvedValue(false)

    unregisterDomainMock.mockReset()
    unregisterDomainMock.mockResolvedValue(true)

    deploySiteMock.mockReset()
    deploySiteMock.mockResolvedValue({
      domain: "testsite.test.example",
      port: 3700,
      serviceName: "site@testsite-test-example.service",
    })

    registerDomainMock.mockReset()
    registerDomainMock.mockResolvedValue(undefined)

    rmMock.mockReset()
    rmMock.mockResolvedValue(undefined)

    getNewSiteExecutionModeMock.mockReset()
    getNewSiteExecutionModeMock.mockReturnValue("systemd")

    prepareE2bSiteDeploymentMock.mockReset()
    prepareE2bSiteDeploymentMock.mockResolvedValue({
      port: 3701,
      serviceName: "e2b-site@testsite.test.example",
      scratchWorkspace: `${MOCK_E2B_SCRATCH}/testsite.test.example/user`,
    })

    createInitialSiteSandboxMock.mockReset()
    createInitialSiteSandboxMock.mockResolvedValue(undefined)

    resolveDomainRuntimeMock.mockReset()
    resolveDomainRuntimeMock.mockImplementation(async hostname => ({
      domain_id: "dom_123",
      hostname,
      port: 3701,
      is_test_env: false,
      test_run_id: null,
      execution_mode: "e2b",
      sandbox_id: null,
      sandbox_status: null,
    }))

    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.SERVER_CONFIG_PATH
    delete process.env.ALIVE_ENV
    vi.restoreAllMocks()
  })

  it("executes a single strict flow: deploy -> register -> caddy", async () => {
    process.env.ALIVE_ENV = "production"
    pathExists.mockReturnValue(false)

    const result = await runStrictDeployment({
      domain: "TestSite.Test.Example",
      email: "owner@example.com",
      orgId: "org-1",
      templatePath: "/srv/webalive/templates/blank.alive.best",
    })

    expect(result).toMatchObject({
      domain: "testsite.test.example",
      port: 3700,
      serviceName: "site@testsite-test-example.service",
      executionMode: "systemd",
    })

    expect(callOrder).toEqual(["deploySite", "registerDomain", "configureCaddy"])
    expect(configureCaddyMock).toHaveBeenCalledOnce()
    expect(configureCaddyMock.mock.calls[0][0]).toMatchObject({
      domain: "testsite.test.example",
      port: 3700,
    })
  })

  it("rejects invalid domains before deployment starts", async () => {
    await expect(
      runStrictDeployment({
        domain: "invalid_domain",
        email: "owner@example.com",
        templatePath: "/srv/webalive/templates/blank.alive.best",
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.INVALID_DOMAIN,
    })

    expect(deploySiteMock).not.toHaveBeenCalled()
    expect(registerDomainMock).not.toHaveBeenCalled()
  })

  it("fails when deploy returns an out-of-range port", async () => {
    deploySiteMock.mockResolvedValueOnce({
      domain: "testsite.test.example",
      port: 9999,
      serviceName: "site@testsite-test-example.service",
    })

    await expect(
      runStrictDeployment({
        domain: "testsite.test.example",
        email: "owner@example.com",
        templatePath: "/srv/webalive/templates/blank.alive.best",
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.DEPLOYMENT_FAILED,
    })

    expect(registerDomainMock).not.toHaveBeenCalled()
    expect(configureCaddyMock).not.toHaveBeenCalled()
    expect(teardownMock).toHaveBeenCalledWith("testsite.test.example", {
      removeFiles: true,
      removeUser: true,
    })
  })

  it("verifies routing against the env-specific filtered file", async () => {
    process.env.ALIVE_ENV = "staging"
    const filteredPath = caddySitesFilteredPath(PATHS.CADDYFILE_SITES, "staging")
    pathExists.mockImplementation(filePath => filePath === filteredPath)

    await runStrictDeployment({
      domain: "testsite.test.example",
      email: "owner@example.com",
      templatePath: "/srv/webalive/templates/blank.alive.best",
    })

    expect(checkDomainInCaddyMock).toHaveBeenCalledWith("testsite.test.example", filteredPath)
  })

  it("skips routing verification when filtered file does not exist", async () => {
    process.env.ALIVE_ENV = "production"
    pathExists.mockReturnValue(false)

    await runStrictDeployment({
      domain: "testsite.test.example",
      email: "owner@example.com",
      templatePath: "/srv/webalive/templates/blank.alive.best",
    })

    expect(checkDomainInCaddyMock).not.toHaveBeenCalled()
  })

  it("verifies the active filtered Caddyfile when it exists", async () => {
    process.env.ALIVE_ENV = "production"
    const filteredPath = caddySitesFilteredPath(PATHS.CADDYFILE_SITES, "production")
    pathExists.mockImplementation(filePath => filePath === filteredPath)

    await runStrictDeployment({
      domain: "testsite.test.example",
      email: "owner@example.com",
      templatePath: "/srv/webalive/templates/blank.alive.best",
    })

    expect(checkDomainInCaddyMock).toHaveBeenCalledWith("testsite.test.example", filteredPath)
  })

  it("rolls back infrastructure when registerDomain fails for a new deployment", async () => {
    isDomainRegisteredMock.mockResolvedValueOnce(false).mockResolvedValueOnce(false)
    registerDomainMock.mockRejectedValueOnce(
      new DomainRegistrationError(ErrorCodes.DEPLOYMENT_FAILED, "db write failed", {
        domain: "testsite.test.example",
      }),
    )

    await expect(
      runStrictDeployment({
        domain: "testsite.test.example",
        email: "owner@example.com",
        templatePath: "/srv/webalive/templates/blank.alive.best",
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.DEPLOYMENT_FAILED,
    })

    expect(unregisterDomainMock).not.toHaveBeenCalled()
    expect(teardownMock).toHaveBeenCalledWith("testsite.test.example", {
      removeFiles: true,
      removeUser: true,
    })
  })

  it("unregisters domain and tears down infra when caddy step fails on new deployment", async () => {
    process.env.ALIVE_ENV = "production"
    isDomainRegisteredMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    configureCaddyMock.mockRejectedValueOnce(new Error("caddy reload failed"))

    await expect(
      runStrictDeployment({
        domain: "testsite.test.example",
        email: "owner@example.com",
        templatePath: "/srv/webalive/templates/blank.alive.best",
      }),
    ).rejects.toThrow("caddy reload failed")

    expect(unregisterDomainMock).toHaveBeenCalledWith("testsite.test.example")
    expect(teardownMock).toHaveBeenCalledWith("testsite.test.example", {
      removeFiles: true,
      removeUser: true,
    })
    expect(checkDomainInCaddyMock).not.toHaveBeenCalled()
  })

  it("rolls back when routing verification fails after caddy reload", async () => {
    process.env.ALIVE_ENV = "production"
    const filteredPath = caddySitesFilteredPath(PATHS.CADDYFILE_SITES, "production")
    pathExists.mockImplementation(filePath => filePath === filteredPath)
    isDomainRegisteredMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    checkDomainInCaddyMock.mockResolvedValueOnce(false)

    await expect(
      runStrictDeployment({
        domain: "testsite.test.example",
        email: "owner@example.com",
        templatePath: "/srv/webalive/templates/blank.alive.best",
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.DEPLOYMENT_FAILED,
    })

    expect(unregisterDomainMock).toHaveBeenCalledWith("testsite.test.example")
    expect(teardownMock).toHaveBeenCalledWith("testsite.test.example", {
      removeFiles: true,
      removeUser: true,
    })
  })

  it("does not teardown pre-existing infrastructure on post-deploy failure", async () => {
    process.env.ALIVE_ENV = "production"
    pathExists.mockImplementation(filePath => filePath.includes(`${PATHS.SITES_ROOT}/existing.test.example`))
    isDomainRegisteredMock.mockResolvedValueOnce(true)
    configureCaddyMock.mockRejectedValueOnce(new Error("reload failed"))

    await expect(
      runStrictDeployment({
        domain: "existing.test.example",
        email: "owner@example.com",
        templatePath: "/srv/webalive/templates/blank.alive.best",
      }),
    ).rejects.toThrow("reload failed")

    expect(unregisterDomainMock).not.toHaveBeenCalled()
    expect(teardownMock).not.toHaveBeenCalled()
  })

  it("creates new deployments directly in e2b when the feature flag is enabled", async () => {
    getNewSiteExecutionModeMock.mockReturnValueOnce("e2b")

    const result = await runStrictDeployment({
      domain: "testsite.test.example",
      email: "owner@example.com",
      orgId: "org-1",
      templatePath: "/srv/webalive/templates/blank.alive.best",
    })

    expect(result).toEqual({
      domain: "testsite.test.example",
      port: 3701,
      serviceName: "e2b-site@testsite.test.example",
      executionMode: "e2b",
    })
    expect(callOrder).toEqual(["prepareE2bSiteDeployment", "registerDomain", "createInitialSiteSandbox"])
    expect(deploySiteMock).not.toHaveBeenCalled()
    expect(configureCaddyMock).not.toHaveBeenCalled()
    expect(registerDomainMock).toHaveBeenCalledWith({
      hostname: "testsite.test.example",
      email: "owner@example.com",
      password: undefined,
      port: 3701,
      executionMode: "e2b",
      orgId: "org-1",
    })
    expect(resolveDomainRuntimeMock).toHaveBeenCalledWith("testsite.test.example")
    expect(createInitialSiteSandboxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain_id: "dom_123",
        hostname: "testsite.test.example",
      }),
      `${MOCK_E2B_SCRATCH}/testsite.test.example/user`,
    )
  })

  it("rolls back scratch state instead of tearing down /srv for e2b failures", async () => {
    getNewSiteExecutionModeMock.mockReturnValueOnce("e2b")
    isDomainRegisteredMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    createInitialSiteSandboxMock.mockRejectedValueOnce(new Error("sandbox bootstrap failed"))

    await expect(
      runStrictDeployment({
        domain: "testsite.test.example",
        email: "owner@example.com",
        templatePath: "/srv/webalive/templates/blank.alive.best",
      }),
    ).rejects.toThrow("sandbox bootstrap failed")

    expect(unregisterDomainMock).toHaveBeenCalledWith("testsite.test.example")
    expect(rmMock).toHaveBeenCalledWith(`${MOCK_E2B_SCRATCH}/testsite.test.example`, {
      recursive: true,
      force: true,
    })
    expect(teardownMock).not.toHaveBeenCalled()
  })
})
