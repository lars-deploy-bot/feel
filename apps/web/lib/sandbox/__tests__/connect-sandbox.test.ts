import { beforeEach, describe, expect, it, vi } from "vitest"

class MockSandboxNotReadyError extends Error {
  readonly code = "SANDBOX_NOT_READY"

  constructor(hostname: string, status: string | null) {
    super(`Sandbox for ${hostname} is not ready (${status ?? "none"})`)
    this.name = "SandboxNotReadyError"
  }
}

const mockConnectRunningSandbox = vi.fn()

vi.mock("@webalive/sandbox", () => ({
  connectRunningSandbox: (...args: unknown[]) => mockConnectRunningSandbox(...args),
  DEFAULT_SANDBOX_CONNECT_TIMEOUT_MS: 10_000,
  RuntimeNotReadyError: MockSandboxNotReadyError,
  SANDBOX_WORKSPACE_ROOT: "/home/user/project",
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
    mockConnectRunningSandbox.mockResolvedValue(fakeSandbox)

    const result = await connectSandbox(makeDomain())

    expect(result).toBe(fakeSandbox)
    expect(mockConnectRunningSandbox).toHaveBeenCalledWith(makeDomain(), {
      connectTimeoutMs: 10_000,
      e2bDomain: expect.any(String),
      markDeadIfCurrent: expect.any(Function),
    })
  })

  it("normalizes is_test_env nulls before delegating", async () => {
    mockConnectRunningSandbox.mockResolvedValue({ id: "sbx_abc" })

    await connectSandbox(makeDomain({ is_test_env: null }))

    expect(mockConnectRunningSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        is_test_env: undefined,
      }),
      expect.any(Object),
    )
  })

  it("throws SandboxNotReadyError when sandbox_id is null", async () => {
    mockConnectRunningSandbox.mockRejectedValue(new SandboxNotReadyError("example.com", null))

    await expect(connectSandbox(makeDomain({ sandbox_id: null }))).rejects.toThrow(SandboxNotReadyError)
    expect(mockConnectRunningSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ sandbox_id: null }),
      expect.any(Object),
    )
  })

  it("throws SandboxNotReadyError when status is creating", async () => {
    mockConnectRunningSandbox.mockRejectedValue(new SandboxNotReadyError("example.com", "creating"))

    await expect(connectSandbox(makeDomain({ sandbox_status: "creating" }))).rejects.toThrow(SandboxNotReadyError)
    expect(mockConnectRunningSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ sandbox_status: "creating" }),
      expect.any(Object),
    )
  })

  it("throws SandboxNotReadyError when status is dead", async () => {
    mockConnectRunningSandbox.mockRejectedValue(new SandboxNotReadyError("example.com", "dead"))

    await expect(connectSandbox(makeDomain({ sandbox_status: "dead" }))).rejects.toThrow(SandboxNotReadyError)
    expect(mockConnectRunningSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ sandbox_status: "dead" }),
      expect.any(Object),
    )
  })

  it("throws SandboxNotReadyError when sandbox_status is null", async () => {
    mockConnectRunningSandbox.mockRejectedValue(new SandboxNotReadyError("example.com", null))

    await expect(connectSandbox(makeDomain({ sandbox_status: null }))).rejects.toThrow(SandboxNotReadyError)
    expect(mockConnectRunningSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ sandbox_status: null }),
      expect.any(Object),
    )
  })

  it("marks sandbox dead in DB when connect returns a not-found error", async () => {
    mockConnectRunningSandbox.mockImplementation(async (_domain, options) => {
      await options.markDeadIfCurrent(makeDomain())
      throw new SandboxNotReadyError("example.com", "running")
    })

    await expect(connectSandbox(makeDomain({ sandbox_id: null }))).rejects.toThrow(SandboxNotReadyError)

    expect(mockFrom).toHaveBeenCalledWith("domains")
    expect(mockUpdate).toHaveBeenCalledWith({ sandbox_status: "dead" })
    expect(mockEqDomainId).toHaveBeenCalledWith("domain_id", "dom_123")
    expect(mockEqSandboxId).toHaveBeenCalledWith("sandbox_id", "sbx_abc")
    expect(mockEqSandboxStatus).toHaveBeenCalledWith("sandbox_status", "running")
  })

  it("marks sandbox dead in DB when connect returns HTTP 404", async () => {
    mockConnectRunningSandbox.mockImplementation(async (_domain, options) => {
      await options.markDeadIfCurrent(makeDomain())
      throw new SandboxNotReadyError("example.com", "running")
    })

    await expect(connectSandbox(makeDomain())).rejects.toThrow(SandboxNotReadyError)
    expect(mockUpdate).toHaveBeenCalledWith({ sandbox_status: "dead" })
  })

  it("does not mark sandbox dead for transient connect errors", async () => {
    mockConnectRunningSandbox.mockRejectedValue(new Error("ECONNREFUSED"))

    await expect(connectSandbox(makeDomain())).rejects.toThrow("ECONNREFUSED")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("still throws SandboxNotReadyError even if dead-mark DB update fails", async () => {
    mockEqSandboxStatus.mockResolvedValueOnce({ error: { message: "DB down" } })
    mockConnectRunningSandbox.mockImplementation(async (_domain, options) => {
      await options.markDeadIfCurrent(makeDomain())
      throw new SandboxNotReadyError("example.com", "running")
    })

    await expect(connectSandbox(makeDomain())).rejects.toThrow("Failed to mark sandbox dead: DB down")
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
