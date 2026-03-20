import { beforeEach, describe, expect, it, vi } from "vitest"

const mockConnect = vi.fn()
const mockCreate = vi.fn()
const updateSandbox = vi.fn()

vi.mock("e2b", () => ({
  Sandbox: {
    connect: (...args: unknown[]) => mockConnect(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}))

const { createSandboxSessionRegistry } = await import("./registry.js")

function createRegistry() {
  return createSandboxSessionRegistry({
    persistence: { updateSandbox },
    domain: "e2b.test.local",
    timeoutMs: 10_000,
  })
}

const domain = {
  domain_id: "dom_123",
  hostname: "example.alive.best",
  sandbox_id: null,
  sandbox_status: null as string | null,
}

describe("SandboxSessionRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("E2B_API_KEY", "test-api-key")
    updateSandbox.mockResolvedValue(undefined)
  })

  it("acquire creates a sandbox and returns a session", async () => {
    const sandbox = {
      sandboxId: "sbx_new",
      files: { list: vi.fn().mockResolvedValue([]) },
      commands: { run: vi.fn() },
      getHost: vi.fn(),
    }
    mockCreate.mockResolvedValueOnce(sandbox)

    const registry = createRegistry()
    const session = await registry.acquire(domain)

    expect(session.sandboxId).toBe("sbx_new")
    expect(session.domain.domain_id).toBe("dom_123")
    expect(session.domain.hostname).toBe("example.alive.best")
  })

  it("acquire returns cached session for same domain", async () => {
    const sandbox = {
      sandboxId: "sbx_cached",
      files: { list: vi.fn().mockResolvedValue([]) },
      commands: { run: vi.fn() },
      getHost: vi.fn(),
    }
    mockCreate.mockResolvedValueOnce(sandbox)

    const registry = createRegistry()
    const session1 = await registry.acquire(domain)
    const session2 = await registry.acquire(domain)

    expect(session1).toBe(session2)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it("evict removes cached session, next acquire reconnects", async () => {
    const sandbox1 = {
      sandboxId: "sbx_first",
      files: { list: vi.fn().mockResolvedValue([]) },
      commands: { run: vi.fn() },
      getHost: vi.fn(),
    }
    const sandbox2 = {
      sandboxId: "sbx_second",
      files: { list: vi.fn().mockResolvedValue([]) },
      commands: { run: vi.fn() },
      getHost: vi.fn(),
    }
    mockCreate.mockResolvedValueOnce(sandbox1).mockResolvedValueOnce(sandbox2)

    const registry = createRegistry()
    const session1 = await registry.acquire(domain)
    expect(session1.sandboxId).toBe("sbx_first")

    registry.evict("dom_123")

    const session2 = await registry.acquire(domain)
    expect(session2.sandboxId).toBe("sbx_second")
    expect(session2).not.toBe(session1)
  })

  it("concurrent acquire calls return the same session (no duplicates)", async () => {
    let resolveCreate: (value: unknown) => void
    const sandbox = {
      sandboxId: "sbx_dedup",
      files: { list: vi.fn().mockResolvedValue([]) },
      commands: { run: vi.fn() },
      getHost: vi.fn(),
    }
    mockCreate.mockReturnValueOnce(
      new Promise(resolve => {
        resolveCreate = resolve
      }),
    )

    const registry = createRegistry()
    const promise1 = registry.acquire(domain)
    const promise2 = registry.acquire(domain)

    resolveCreate!(sandbox)
    const [session1, session2] = await Promise.all([promise1, promise2])

    expect(session1).toBe(session2)
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it("acquire propagates Sandbox.create errors", async () => {
    mockCreate.mockRejectedValueOnce(new Error("E2B quota exceeded"))

    const registry = createRegistry()
    await expect(registry.acquire(domain)).rejects.toThrow("E2B quota exceeded")
  })

  it("acquire propagates persistence errors", async () => {
    updateSandbox.mockRejectedValueOnce(new Error("DB write failed"))

    const registry = createRegistry()
    await expect(registry.acquire(domain)).rejects.toThrow("DB write failed")
  })

  it("session.files provides path-validated access", async () => {
    const sandbox = {
      sandboxId: "sbx_scoped",
      files: {
        read: vi.fn().mockResolvedValue("file contents"),
        list: vi.fn().mockResolvedValue([]),
      },
      commands: { run: vi.fn() },
      getHost: vi.fn(),
    }
    mockCreate.mockResolvedValueOnce(sandbox)

    const registry = createRegistry()
    const session = await registry.acquire(domain)

    const content = await session.files.read("src/app.ts")

    expect(content).toBe("file contents")
    expect(sandbox.files.read).toHaveBeenCalledWith("/home/user/project/src/app.ts")
  })
})
