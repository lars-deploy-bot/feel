import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TestE2BDomain } from "@/app/api/test/test-route-schemas"
import { ErrorCodes } from "@/lib/error-codes"

// Proxy env mock to allow vi.stubEnv() control
const envMock = {
  env: new Proxy(
    {},
    {
      get(_, prop) {
        if (typeof prop !== "string") return undefined
        return process.env[prop]
      },
    },
  ),
}

vi.mock("@webalive/env/server", () => envMock)

vi.mock("@/lib/supabase/app", () => ({
  createAppClient: vi.fn(),
}))

const mockResetE2bScratchUserWorkspace = vi.fn(async (_workspace: string, _sourceUserDir?: string) => "/tmp/e2b/user")

vi.mock("@/lib/sandbox/e2b-workspace", () => ({
  resetE2bScratchUserWorkspace: (workspace: string, sourceUserDir?: string) =>
    mockResetE2bScratchUserWorkspace(workspace, sourceUserDir),
}))

const mockWriteFile = vi.fn(async (_path: string, _content: string) => {})
const mockMkdir = vi.fn(async (_path: string, _opts?: Record<string, unknown>) => {})
const mockUnlink = vi.fn(async (_path: string) => {})
const mockStat = vi.fn(async (_path: string) => ({ isDirectory: () => true }))

vi.mock("node:fs/promises", () => ({
  writeFile: (p: string, c: string) => mockWriteFile(p, c),
  mkdir: (p: string, o?: Record<string, unknown>) => mockMkdir(p, o),
  unlink: (p: string) => mockUnlink(p),
  stat: (p: string) => mockStat(p),
}))

vi.mock("@webalive/shared", () => ({
  getWorkspacePath: (domain: string) => `/srv/webalive/sites/${domain}/user`,
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

const mockShutdownWorker = vi.fn(async (_workspaceKey?: string, _reason?: string) => {})
const emptyWorkerInfo: Array<{ workspaceKey: string }> = []
const mockGetWorkerInfo = vi.fn(() => emptyWorkerInfo)
const mockGetWorkerPool = vi.fn(() => ({
  getWorkerInfo: mockGetWorkerInfo,
  shutdownWorker: mockShutdownWorker,
}))

vi.mock("@webalive/worker-pool", () => ({
  getWorkerPool: () => mockGetWorkerPool(),
}))

const mockSandboxKill = vi.fn()
const mockSandboxConnect = vi.fn(async (_id?: string, _opts?: Record<string, unknown>) => ({
  kill: mockSandboxKill,
}))
vi.mock("e2b", () => ({
  Sandbox: {
    connect: (id: string, opts?: Record<string, unknown>) => mockSandboxConnect(id, opts),
  },
}))

const { GET, POST } = await import("../route")
const { createAppClient } = await import("@/lib/supabase/app")

function isExecutionMode(v: unknown): v is TestE2BDomain["execution_mode"] {
  return v === "systemd" || v === "e2b"
}

function isSandboxStatus(v: unknown): v is TestE2BDomain["sandbox_status"] {
  return v === "creating" || v === "running" || v === "dead" || v === null
}

/** Concentrate the mock-to-SupabaseClient type mismatch in one place.
 * The mock only implements the `.from("domains")` chain used by the route.
 * `as never` bridges the partial mock to the full SupabaseClient return type. */
function mockAppClient(options: {
  domain: TestE2BDomain | null
  selectError?: { code?: string; message?: string } | null
  updateError?: { code?: string; message?: string } | null
}): void {
  vi.mocked(createAppClient).mockResolvedValue(createMockAppClient(options) as never)
}

function createMockAppClient(options: {
  domain: TestE2BDomain | null
  selectError?: { code?: string; message?: string } | null
  updateError?: { code?: string; message?: string } | null
}) {
  let domainState = options.domain
  const selectError = options.selectError ?? null
  const updateError = options.updateError ?? null

  return {
    from: vi.fn((table: string) => {
      if (table !== "domains") throw new Error(`Unexpected table: ${table}`)

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => {
              if (selectError) return { data: null, error: selectError }
              return { data: domainState, error: null }
            }),
          })),
        })),
        update: vi.fn((patch: Record<string, unknown>) => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                if (updateError) return { data: null, error: updateError }
                if (!domainState) return { data: null, error: { code: "PGRST116", message: "No rows found" } }
                domainState = {
                  ...domainState,
                  execution_mode: isExecutionMode(patch.execution_mode)
                    ? patch.execution_mode
                    : domainState.execution_mode,
                  sandbox_id:
                    Object.hasOwn(patch, "sandbox_id") &&
                    (typeof patch.sandbox_id === "string" || patch.sandbox_id === null)
                      ? patch.sandbox_id
                      : domainState.sandbox_id,
                  sandbox_status: isSandboxStatus(patch.sandbox_status)
                    ? patch.sandbox_status
                    : domainState.sandbox_status,
                }
                return { data: domainState, error: null }
              }),
            })),
          })),
        })),
      }
    }),
  }
}

function makeDomain(overrides: Partial<TestE2BDomain> = {}): TestE2BDomain {
  return {
    domain_id: "dom_1",
    hostname: "e2e-w0.alive.local",
    org_id: "org_1",
    is_test_env: true,
    execution_mode: "systemd",
    sandbox_id: null,
    sandbox_status: null,
    ...overrides,
  }
}

function makeGetRequest(workspace?: string, secret?: string): Request {
  const url = new URL("http://localhost/api/test/e2b-domain")
  if (workspace) url.searchParams.set("workspace", workspace)
  return new Request(url.toString(), {
    method: "GET",
    headers: secret ? { "x-test-secret": secret } : undefined,
  })
}

function makePostRequest(body: unknown, secret?: string): Request {
  return new Request("http://localhost/api/test/e2b-domain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-test-secret": secret } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe("GET /api/test/e2b-domain", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("STREAM_ENV", "local")
    vi.stubEnv("E2E_TEST_SECRET", "test-secret")
    vi.stubEnv("E2B_DOMAIN", "e2b.test.local")
    mockAppClient({ domain: makeDomain() })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 404 when unauthorized", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("STREAM_ENV", "staging")

    const res = await GET(makeGetRequest("e2e-w0.alive.local"))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe(ErrorCodes.UNAUTHORIZED)
  })

  it("returns 400 when workspace is missing", async () => {
    const res = await GET(makeGetRequest())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe(ErrorCodes.VALIDATION_ERROR)
  })

  it("returns 404 when workspace is missing in DB", async () => {
    mockAppClient({
      domain: null,
      selectError: { code: "PGRST116", message: "No rows found" },
    })

    const res = await GET(makeGetRequest("missing.alive.local"))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe(ErrorCodes.WORKSPACE_NOT_FOUND)
  })

  it("returns 403 for non-test domains", async () => {
    mockAppClient({
      domain: makeDomain({ is_test_env: false }),
    })

    const res = await GET(makeGetRequest("e2e-w0.alive.local"))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe(ErrorCodes.FORBIDDEN)
  })

  it("returns runtime for test domain", async () => {
    const res = await GET(makeGetRequest("e2e-w0.alive.local"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.domain.hostname).toBe("e2e-w0.alive.local")
    expect(json.domain.execution_mode).toBe("systemd")
  })
})

describe("POST /api/test/e2b-domain", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("STREAM_ENV", "local")
    vi.stubEnv("E2E_TEST_SECRET", "test-secret")
    vi.stubEnv("E2B_DOMAIN", "e2b.test.local")
    mockAppClient({ domain: makeDomain() })
    mockSandboxKill.mockResolvedValue(undefined)
    mockSandboxConnect.mockResolvedValue({ kill: mockSandboxKill })
    mockGetWorkerInfo.mockReturnValue([])
    mockShutdownWorker.mockResolvedValue(undefined)
    mockStat.mockResolvedValue({ isDirectory: () => true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 404 when unauthorized", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("STREAM_ENV", "staging")

    const res = await POST(makePostRequest({ workspace: "e2e-w0.alive.local", executionMode: "e2b" }))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe(ErrorCodes.UNAUTHORIZED)
  })

  it("returns 400 when payload is invalid", async () => {
    const res = await POST(makePostRequest({ workspace: "", executionMode: "not-real" }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe(ErrorCodes.VALIDATION_ERROR)
  })

  it("returns 403 for non-test domains", async () => {
    mockAppClient({
      domain: makeDomain({ is_test_env: false }),
    })

    const res = await POST(makePostRequest({ workspace: "e2e-w0.alive.local", executionMode: "e2b" }))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe(ErrorCodes.FORBIDDEN)
  })

  it("updates execution_mode and clears sandbox fields when resetSandboxFields=true", async () => {
    mockAppClient({
      domain: makeDomain({
        execution_mode: "systemd",
        sandbox_id: "sbx_old",
        sandbox_status: "running",
      }),
    })

    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "e2b",
        resetSandboxFields: true,
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.domain.execution_mode).toBe("e2b")
    expect(json.domain.sandbox_id).toBeNull()
    expect(json.domain.sandbox_status).toBeNull()
    expect(mockResetE2bScratchUserWorkspace).toHaveBeenCalledWith(
      "e2e-w0.alive.local",
      "/srv/webalive/sites/e2e-w0.alive.local/user",
    )
    expect(json.scratchWorkspace).toBe("/tmp/e2b/user")
  })

  it("kills active sandbox when killSandbox=true", async () => {
    mockAppClient({
      domain: makeDomain({
        execution_mode: "e2b",
        sandbox_id: "sbx_active",
        sandbox_status: "running",
      }),
    })

    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "systemd",
        killSandbox: true,
        resetSandboxFields: true,
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockSandboxConnect).toHaveBeenCalledWith("sbx_active", {
      domain: "e2b.test.local",
      timeoutMs: 10_000,
    })
    expect(mockSandboxKill).toHaveBeenCalledTimes(1)
    expect(json.kill.killed).toBe(true)
  })

  it("keeps update successful even when sandbox kill fails", async () => {
    mockSandboxConnect.mockRejectedValueOnce(new Error("sandbox not found"))

    mockAppClient({
      domain: makeDomain({
        execution_mode: "e2b",
        sandbox_id: "sbx_missing",
        sandbox_status: "dead",
      }),
    })

    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "systemd",
        killSandbox: true,
        resetSandboxFields: true,
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.kill.killed).toBe(false)
    expect(json.domain.execution_mode).toBe("systemd")
  })

  it("restarts matching workspace workers when requested", async () => {
    mockGetWorkerInfo.mockReturnValue([
      { workspaceKey: "e2e-w0.alive.local:0" },
      { workspaceKey: "other-workspace:0" },
      { workspaceKey: "e2e-w0.alive.local:1" },
    ])

    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "e2b",
        restartWorkspaceWorkers: true,
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockGetWorkerPool).toHaveBeenCalledTimes(1)
    expect(mockShutdownWorker).toHaveBeenCalledTimes(2)
    expect(mockShutdownWorker).toHaveBeenCalledWith("e2e-w0.alive.local:0", "test_e2b_domain_runtime_reset")
    expect(mockShutdownWorker).toHaveBeenCalledWith("e2e-w0.alive.local:1", "test_e2b_domain_runtime_reset")
    expect(json.workerRestart).toEqual({ requested: true, matched: 2, restarted: 2 })
  })

  it("seeds host files to workspace directory", async () => {
    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "systemd",
        seedHostFiles: [
          { path: "vite.config.ts", content: "export default {}" },
          { path: "src/app.ts", content: "console.log('hi')" },
        ],
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.seededFiles).toEqual(["vite.config.ts", "src/app.ts"])
    expect(mockMkdir).toHaveBeenCalledTimes(2)
    expect(mockWriteFile).toHaveBeenCalledTimes(2)
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/srv/webalive/sites/e2e-w0.alive.local/user/vite.config.ts",
      "export default {}",
    )
  })

  it("does not prepare E2B scratch workspace for systemd updates", async () => {
    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "systemd",
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockResetE2bScratchUserWorkspace).not.toHaveBeenCalled()
    expect(json.scratchWorkspace).toBeNull()
  })

  it("prepares an empty E2B scratch workspace when the host workspace is missing", async () => {
    const missingWorkspaceError = new Error("ENOENT")
    Object.assign(missingWorkspaceError, { code: "ENOENT" })
    mockStat.mockRejectedValueOnce(missingWorkspaceError)

    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "e2b",
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockResetE2bScratchUserWorkspace).toHaveBeenCalledWith("e2e-w0.alive.local", undefined)
    expect(json.scratchWorkspace).toBe("/tmp/e2b/user")
  })

  it("blocks path traversal in seedHostFiles", async () => {
    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "systemd",
        seedHostFiles: [{ path: "../../etc/passwd", content: "hacked" }],
      }),
    )

    expect(res.status).toBe(500)
  })

  it("cleans host files from workspace directory", async () => {
    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "systemd",
        cleanHostFiles: ["vite.config.ts", "test.png"],
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.cleanedFiles).toEqual(["vite.config.ts", "test.png"])
    expect(mockUnlink).toHaveBeenCalledTimes(2)
  })

  it("ignores missing files during cleanup", async () => {
    mockUnlink.mockRejectedValueOnce(new Error("ENOENT"))

    const res = await POST(
      makePostRequest({
        workspace: "e2e-w0.alive.local",
        executionMode: "systemd",
        cleanHostFiles: ["missing.txt"],
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.cleanedFiles).toEqual([])
  })
})
