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

const { SandboxManager } = await import("./manager.js")

function createManager() {
  return new SandboxManager({
    persistence: {
      updateSandbox,
    },
    domain: "e2b.test.local",
    timeoutMs: 10_000,
  })
}

describe("SandboxManager", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("E2B_API_KEY", "test-api-key")
    updateSandbox.mockResolvedValue(undefined)
  })

  it("creates a replacement sandbox only when reconnect confirms the old one is gone", async () => {
    const manager = createManager()
    const replacementSandbox = { sandboxId: "sbx_new" }

    mockConnect.mockRejectedValueOnce(new Error("Sandbox sbx_old not found"))
    mockCreate.mockResolvedValueOnce(replacementSandbox)

    const result = await manager.getOrCreate({
      domain_id: "dom_123",
      hostname: "example.alive.best",
      sandbox_id: "sbx_old",
      sandbox_status: "running",
      is_test_env: true,
      test_run_id: "run-123",
    })

    expect(result).toBe(replacementSandbox)
    expect(updateSandbox).toHaveBeenNthCalledWith(1, "dom_123", "sbx_old", "dead")
    expect(updateSandbox).toHaveBeenNthCalledWith(2, "dom_123", "", "creating")
    expect(updateSandbox).toHaveBeenNthCalledWith(3, "dom_123", "sbx_new", "running")
  })

  it("does not create a new sandbox when reconnect fails transiently", async () => {
    const manager = createManager()
    const transientError = new Error("ECONNREFUSED")

    mockConnect.mockRejectedValueOnce(transientError)

    await expect(
      manager.getOrCreate({
        domain_id: "dom_123",
        hostname: "example.alive.best",
        sandbox_id: "sbx_old",
        sandbox_status: "running",
      }),
    ).rejects.toBe(transientError)

    expect(mockCreate).not.toHaveBeenCalled()
    expect(updateSandbox).not.toHaveBeenCalled()
  })

  it("stores test metadata on new sandboxes for later teardown recovery", async () => {
    const manager = createManager()
    const createdSandbox = { sandboxId: "sbx_new" }

    mockCreate.mockResolvedValueOnce(createdSandbox)

    await manager.getOrCreate({
      domain_id: "dom_123",
      hostname: "example.alive.best",
      sandbox_id: null,
      sandbox_status: null,
      is_test_env: true,
      test_run_id: "run-123",
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        metadata: {
          domain_id: "dom_123",
          hostname: "example.alive.best",
          is_test_env: "true",
          test_run_id: "run-123",
        },
      }),
    )
  })
})
