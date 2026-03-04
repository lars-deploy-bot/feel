import { beforeEach, describe, expect, it, vi } from "vitest"

const mockConnect = vi.fn()
vi.mock("e2b", () => ({
  Sandbox: {
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}))

vi.mock("@webalive/sandbox", () => ({
  SANDBOX_WORKSPACE_ROOT: "/home/user/project",
}))

vi.mock("@/lib/domain/resolve-domain-runtime", () => ({}))

const { connectSandbox, SandboxNotReadyError } = await import("../connect-sandbox")

function makeDomain(overrides: Record<string, unknown> = {}) {
  return {
    domain_id: "dom_123",
    hostname: "example.com",
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
