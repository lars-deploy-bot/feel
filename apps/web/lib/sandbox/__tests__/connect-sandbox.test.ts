import { beforeEach, describe, expect, it, vi } from "vitest"

const mockConnect = vi.fn()
vi.mock("e2b", () => ({
  Sandbox: {
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}))

vi.mock("@webalive/sandbox", () => ({
  SANDBOX_WORKSPACE_ROOT: "/home/user/project",
  getSandboxConnectErrorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  isSandboxDefinitelyGone: (error: unknown) => {
    if (typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 404) {
      return true
    }

    return (error instanceof Error ? error.message : String(error)).toLowerCase().includes("not found")
  },
}))

vi.mock("@/lib/domain/resolve-domain-runtime", () => ({}))

const mockEqSandboxStatus = vi.fn().mockResolvedValue({ error: null })
const mockEqSandboxId = vi.fn().mockReturnValue({ eq: mockEqSandboxStatus })
const mockEqDomainId = vi.fn().mockReturnValue({ eq: mockEqSandboxId })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqDomainId })
const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate })
vi.mock("@/lib/supabase/app", () => ({
  createAppClient: vi.fn().mockResolvedValue({ from: (...args: unknown[]) => mockFrom(...args) }),
}))

const { connectSandbox, SandboxNotReadyError } = await import("../connect-sandbox")

function makeDomain(overrides: Record<string, unknown> = {}) {
  return {
    domain_id: "dom_123",
    hostname: "example.com",
    port: 3701,
    is_test_env: false,
    test_run_id: null,
    execution_mode: "e2b" as const,
    sandbox_id: "sbx_abc",
    sandbox_status: "running" as const,
    ...overrides,
  }
}

describe("connectSandbox", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("E2B_DOMAIN", "e2b.test.local")
    mockEqSandboxStatus.mockResolvedValue({ error: null })
  })

  it("connects when sandbox_id exists and status is running", async () => {
    const fakeSandbox = { id: "sbx_abc" }
    mockConnect.mockResolvedValue(fakeSandbox)

    const result = await connectSandbox(makeDomain())

    expect(result).toBe(fakeSandbox)
    expect(mockConnect).toHaveBeenCalledWith("sbx_abc", {
      domain: "e2b.test.local",
      timeoutMs: 10_000,
    })
  })

  it("throws SandboxNotReadyError when sandbox_id is null", async () => {
    await expect(connectSandbox(makeDomain({ sandbox_id: null }))).rejects.toThrow(SandboxNotReadyError)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it("throws SandboxNotReadyError when status is creating", async () => {
    await expect(connectSandbox(makeDomain({ sandbox_status: "creating" }))).rejects.toThrow(SandboxNotReadyError)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it("throws SandboxNotReadyError when status is dead", async () => {
    await expect(connectSandbox(makeDomain({ sandbox_status: "dead" }))).rejects.toThrow(SandboxNotReadyError)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it("throws SandboxNotReadyError when sandbox_status is null", async () => {
    await expect(connectSandbox(makeDomain({ sandbox_status: null }))).rejects.toThrow(SandboxNotReadyError)
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it("marks sandbox dead in DB when connect returns a not-found error", async () => {
    mockConnect.mockRejectedValue(new Error("Paused sandbox sbx_abc not found"))

    await expect(connectSandbox(makeDomain())).rejects.toThrow(SandboxNotReadyError)

    expect(mockFrom).toHaveBeenCalledWith("domains")
    expect(mockUpdate).toHaveBeenCalledWith({ sandbox_status: "dead" })
    expect(mockEqDomainId).toHaveBeenCalledWith("domain_id", "dom_123")
    expect(mockEqSandboxId).toHaveBeenCalledWith("sandbox_id", "sbx_abc")
    expect(mockEqSandboxStatus).toHaveBeenCalledWith("sandbox_status", "running")
  })

  it("marks sandbox dead in DB when connect returns HTTP 404", async () => {
    mockConnect.mockRejectedValue({ statusCode: 404, message: "Request failed" })

    await expect(connectSandbox(makeDomain())).rejects.toThrow(SandboxNotReadyError)
    expect(mockUpdate).toHaveBeenCalledWith({ sandbox_status: "dead" })
  })

  it("does not mark sandbox dead for transient connect errors", async () => {
    mockConnect.mockRejectedValue(new Error("ECONNREFUSED"))

    await expect(connectSandbox(makeDomain())).rejects.toThrow(SandboxNotReadyError)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("still throws SandboxNotReadyError even if dead-mark DB update fails", async () => {
    mockConnect.mockRejectedValue(new Error("Paused sandbox sbx_abc not found"))
    mockEqSandboxStatus.mockResolvedValueOnce({ error: { message: "DB down" } })

    await expect(connectSandbox(makeDomain())).rejects.toThrow(SandboxNotReadyError)
  })
})

describe("SandboxNotReadyError", () => {
  it("has code SANDBOX_NOT_READY", () => {
    const err = new SandboxNotReadyError("test.com", "creating")
    expect(err.code).toBe("SANDBOX_NOT_READY")
  })

  it("includes hostname and status in message", () => {
    const err = new SandboxNotReadyError("test.com", "creating")
    expect(err.message).toContain("test.com")
    expect(err.message).toContain("creating")
  })

  it("handles null status in message", () => {
    const err = new SandboxNotReadyError("test.com", null)
    expect(err.message).toContain("none")
  })
})
