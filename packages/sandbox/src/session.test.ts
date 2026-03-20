import { describe, expect, it, vi } from "vitest"
import { SANDBOX_WORKSPACE_ROOT } from "./manager.js"
import { createSandboxSession } from "./session.js"

function mockSandbox(id = "sbx_test") {
  return {
    sandboxId: id,
    files: {
      read: vi.fn().mockResolvedValue("content"),
      write: vi.fn().mockResolvedValue({ path: "/test", size: 5 }),
      list: vi.fn().mockResolvedValue([]),
      makeDir: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    commands: {
      run: vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 }),
    },
    getHost: vi.fn().mockReturnValue("https://3000-sbx_test.e2b.test"),
  }
}

function mockManager() {
  return {
    pause: vi.fn().mockResolvedValue(undefined),
    kill: vi.fn().mockResolvedValue(undefined),
  }
}

const domain = { domain_id: "dom_123", hostname: "example.alive.best" }

describe("SandboxSession", () => {
  it("exposes domain and sandboxId", () => {
    const sandbox = mockSandbox()
    const session = createSandboxSession(domain, sandbox as never, mockManager() as never)

    expect(session.domain).toEqual(domain)
    expect(session.sandboxId).toBe("sbx_test")
  })

  it("exposes the raw sandbox", () => {
    const sandbox = mockSandbox()
    const session = createSandboxSession(domain, sandbox as never, mockManager() as never)

    expect(session.raw).toBe(sandbox)
  })

  it("files.read delegates through scoped filesystem", async () => {
    const sandbox = mockSandbox()
    const session = createSandboxSession(domain, sandbox as never, mockManager() as never)

    await session.files.read("src/app.ts")

    expect(sandbox.files.read).toHaveBeenCalledWith(`${SANDBOX_WORKSPACE_ROOT}/src/app.ts`)
  })

  describe("commands", () => {
    it("defaults cwd to SANDBOX_WORKSPACE_ROOT", async () => {
      const sandbox = mockSandbox()
      const session = createSandboxSession(domain, sandbox as never, mockManager() as never)

      await session.commands.run("ls")

      expect(sandbox.commands.run).toHaveBeenCalledWith("ls", {
        cwd: SANDBOX_WORKSPACE_ROOT,
        timeoutMs: undefined,
      })
    })

    it("allows cwd override", async () => {
      const sandbox = mockSandbox()
      const session = createSandboxSession(domain, sandbox as never, mockManager() as never)

      await session.commands.run("ls", { cwd: "/tmp" })

      expect(sandbox.commands.run).toHaveBeenCalledWith("ls", {
        cwd: "/tmp",
        timeoutMs: undefined,
      })
    })

    it("passes through timeoutMs", async () => {
      const sandbox = mockSandbox()
      const session = createSandboxSession(domain, sandbox as never, mockManager() as never)

      await session.commands.run("bun install", { timeoutMs: 60_000 })

      expect(sandbox.commands.run).toHaveBeenCalledWith("bun install", {
        cwd: SANDBOX_WORKSPACE_ROOT,
        timeoutMs: 60_000,
      })
    })

    it("runs background commands", async () => {
      const sandbox = mockSandbox()
      sandbox.commands.run.mockResolvedValueOnce({ pid: 42 })
      const session = createSandboxSession(domain, sandbox as never, mockManager() as never)

      const result = await session.commands.run("bun run dev", { background: true })

      expect(sandbox.commands.run).toHaveBeenCalledWith("bun run dev", {
        background: true,
        cwd: SANDBOX_WORKSPACE_ROOT,
      })
      expect(result.exitCode).toBe(0)
    })
  })

  it("getHost delegates to sandbox", () => {
    const sandbox = mockSandbox()
    const session = createSandboxSession(domain, sandbox as never, mockManager() as never)

    const host = session.getHost(3000)

    expect(host).toBe("https://3000-sbx_test.e2b.test")
    expect(sandbox.getHost).toHaveBeenCalledWith(3000)
  })

  it("pause delegates to manager", async () => {
    const manager = mockManager()
    const session = createSandboxSession(domain, mockSandbox() as never, manager as never)

    await session.pause()

    expect(manager.pause).toHaveBeenCalledWith("dom_123")
  })

  it("kill delegates to manager", async () => {
    const manager = mockManager()
    const session = createSandboxSession(domain, mockSandbox() as never, manager as never)

    await session.kill()

    expect(manager.kill).toHaveBeenCalledWith("dom_123")
  })
})
