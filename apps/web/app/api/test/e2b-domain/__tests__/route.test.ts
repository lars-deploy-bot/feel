import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

// Proxy env mock to allow vi.stubEnv() control
const envMock = {
  env: new Proxy(
    {},
    {
      get(_, prop) {
        return process.env[prop as string]
      },
    },
  ),
}

vi.mock("@webalive/env/server", () => envMock)

vi.mock("@/lib/supabase/app", () => ({
  createAppClient: vi.fn(),
}))

const mockWriteFile = vi.fn(async (_path: string, _content: string) => {})
const mockMkdir = vi.fn(async (_path: string, _opts?: Record<string, unknown>) => {})
const mockUnlink = vi.fn(async (_path: string) => {})

vi.mock("node:fs/promises", () => ({
  writeFile: (p: string, c: string) => mockWriteFile(p, c),
  mkdir: (p: string, o?: Record<string, unknown>) => mockMkdir(p, o),
  unlink: (p: string) => mockUnlink(p),
}))

vi.mock("@webalive/shared", () => ({
  getWorkspacePath: (domain: string) => `/srv/webalive/sites/${domain}/user`,
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}))

const mockShutdownWorker = vi.fn(async (_workspaceKey?: string, _reason?: string) => {})
const mockGetWorkerInfo = vi.fn(() => [] as Array<{ workspaceKey: string }>)
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

interface DomainState {
  domain_id: string
  hostname: string
  org_id: string
  is_test_env: boolean
  execution_mode: "systemd" | "e2b"
  sandbox_id: string | null
  sandbox_status: "creating" | "running" | "dead" | null
}

interface MockOptions {
  domain: DomainState | null
  selectError?: { code?: string; message?: string } | null
  updateError?: { code?: string; message?: string } | null
}

function createMockAppClient(options: MockOptions) {
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
                const hasExecutionMode = Object.hasOwn(patch, "execution_mode")
                const hasSandboxId = Object.hasOwn(patch, "sandbox_id")
                const hasSandboxStatus = Object.hasOwn(patch, "sandbox_status")
                domainState = {
                  ...domainState,
                  execution_mode: hasExecutionMode
                    ? (patch.execution_mode as DomainState["execution_mode"])
                    : domainState.execution_mode,
                  sandbox_id: hasSandboxId ? (patch.sandbox_id as string | null) : domainState.sandbox_id,
                  sandbox_status: hasSandboxStatus
                    ? (patch.sandbox_status as DomainState["sandbox_status"])
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

function makeDomain(overrides: Partial<DomainState> = {}): DomainState {
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
    vi.mocked(createAppClient).mockResolvedValue(createMockAppClient({ domain: makeDomain() }) as never)
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
    vi.mocked(createAppClient).mockResolvedValue(
      createMockAppClient({
        domain: null,
        selectError: { code: "PGRST116", message: "No rows found" },
      }) as never,
    )

    const res = await GET(makeGetRequest("missing.alive.local"))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe(ErrorCodes.WORKSPACE_NOT_FOUND)
  })

  it("returns 403 for non-test domains", async () => {
    vi.mocked(createAppClient).mockResolvedValue(
      createMockAppClient({
        domain: makeDomain({ is_test_env: false }),
      }) as never,
    )

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
    vi.mocked(createAppClient).mockResolvedValue(createMockAppClient({ domain: makeDomain() }) as never)
    mockSandboxKill.mockResolvedValue(undefined)
    mockSandboxConnect.mockResolvedValue({ kill: mockSandboxKill })
    mockGetWorkerInfo.mockReturnValue([])
    mockShutdownWorker.mockResolvedValue(undefined)
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
    vi.mocked(createAppClient).mockResolvedValue(
      createMockAppClient({
        domain: makeDomain({ is_test_env: false }),
      }) as never,
    )

    const res = await POST(makePostRequest({ workspace: "e2e-w0.alive.local", executionMode: "e2b" }))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe(ErrorCodes.FORBIDDEN)
  })

  it("updates execution_mode and clears sandbox fields when resetSandboxFields=true", async () => {
    vi.mocked(createAppClient).mockResolvedValue(
      createMockAppClient({
        domain: makeDomain({
          execution_mode: "systemd",
          sandbox_id: "sbx_old",
          sandbox_status: "running",
        }),
      }) as never,
    )

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
  })

  it("kills active sandbox when killSandbox=true", async () => {
    vi.mocked(createAppClient).mockResolvedValue(
      createMockAppClient({
        domain: makeDomain({
          execution_mode: "e2b",
          sandbox_id: "sbx_active",
          sandbox_status: "running",
        }),
      }) as never,
    )

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

    vi.mocked(createAppClient).mockResolvedValue(
      createMockAppClient({
        domain: makeDomain({
          execution_mode: "e2b",
          sandbox_id: "sbx_missing",
          sandbox_status: "dead",
        }),
      }) as never,
    )

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
