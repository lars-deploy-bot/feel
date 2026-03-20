import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { RuntimePathValidationError } from "@webalive/sandbox"
import { NextRequest, NextResponse } from "next/server"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionUser } from "@/features/auth/lib/auth"

const mockGetSessionUser = vi.fn()
const mockVerifyWorkspaceAccess = vi.fn()
const mockResolveDomainRuntime = vi.fn()
const mockSessionFilesList = vi.fn()

vi.mock("@/features/auth/lib/auth", async importOriginal => {
  const actual = await importOriginal<typeof import("@/features/auth/lib/auth")>()
  const mockedModule: Record<string, unknown> = { ...actual }

  for (const [key, value] of Object.entries(actual)) {
    if (typeof value === "function") {
      mockedModule[key] = vi.fn()
    }
  }

  mockedModule.getSessionUser = (...args: unknown[]) => mockGetSessionUser(...args)
  mockedModule.verifyWorkspaceAccess = (...args: unknown[]) => mockVerifyWorkspaceAccess(...args)

  return mockedModule
})

vi.mock("@/lib/domain/resolve-domain-runtime", () => ({
  resolveDomainRuntime: (...args: unknown[]) => mockResolveDomainRuntime(...args),
}))

vi.mock("@/lib/sandbox/session-registry", () => ({
  getSessionRegistry: () => ({
    acquire: () =>
      Promise.resolve({
        files: {
          list: (...args: unknown[]) => mockSessionFilesList(...args),
        },
      }),
  }),
}))

vi.mock("@/lib/api/responses", async () => {
  const { NextResponse } = await import("next/server")
  return {
    structuredErrorResponse: vi.fn((code: string, opts: { status: number; details?: Record<string, unknown> }) => {
      return NextResponse.json({ ok: false, error: code, ...opts.details }, { status: opts.status })
    }),
  }
})

vi.mock("@/features/chat/lib/workspaceRetriever", () => ({
  getWorkspace: vi.fn(),
}))

const { POST } = await import("../route")
const { getWorkspace } = await import("@/features/chat/lib/workspaceRetriever")

const TEST_WORKSPACE = path.join(tmpdir(), "files-list-test-workspace")

interface FilesListSuccessResponse {
  ok: true
  path: string
  workspace: string
  files: Array<{
    name: string
    type: "file" | "directory"
    size: number
    modified: string
    path: string
  }>
}

interface FilesListErrorResponse {
  ok: false
  error: string
}

type FilesListResponse = FilesListSuccessResponse | FilesListErrorResponse

const MOCK_USER: SessionUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  firstName: "Test",
  lastName: "User",
  canSelectAnyModel: false,
  isAdmin: false,
  isSuperadmin: false,
  enabledModels: [],
}

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "localhost" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/files", () => {
  beforeAll(() => {
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true })
    }

    mkdirSync(TEST_WORKSPACE, { recursive: true })
    mkdirSync(path.join(TEST_WORKSPACE, "src"), { recursive: true })
    writeFileSync(path.join(TEST_WORKSPACE, "index.ts"), "export {}")
    writeFileSync(path.join(TEST_WORKSPACE, "src", "app.ts"), "export const app = true")
  })

  afterAll(() => {
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true })
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSessionUser.mockResolvedValue(MOCK_USER)
    mockVerifyWorkspaceAccess.mockResolvedValue(TEST_WORKSPACE)
    mockResolveDomainRuntime.mockResolvedValue(null)
    mockSessionFilesList.mockResolvedValue([])

    vi.mocked(getWorkspace).mockResolvedValue({
      success: true,
      workspace: TEST_WORKSPACE,
    })
  })

  it("requires an authenticated session", async () => {
    mockGetSessionUser.mockResolvedValue(null)

    const response = await POST(createMockRequest({ path: "" }))
    const data: FilesListResponse = await response.json()

    expect(response.status).toBe(401)
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error).toBe("NO_SESSION")
    }
  })

  it("blocks path traversal on the systemd path", async () => {
    const response = await POST(createMockRequest({ path: "../../../etc", workspace: "example.test.example" }))
    const data: FilesListResponse = await response.json()

    expect(response.status).toBe(403)
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error).toBe("PATH_OUTSIDE_WORKSPACE")
    }
  })

  it("lists files in the workspace", async () => {
    const response = await POST(createMockRequest({ path: "", workspace: "example.test.example" }))
    const data: FilesListResponse = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    if (data.ok) {
      const names = data.files.map(file => file.name).sort()
      expect(names).toEqual(["index.ts", "src"])
    }
  })

  it("maps E2B path validation failures to PATH_OUTSIDE_WORKSPACE", async () => {
    mockResolveDomainRuntime.mockResolvedValue({
      domain_id: "domain-1",
      hostname: "example.test.example",
      port: 3000,
      is_test_env: null,
      execution_mode: "e2b",
      sandbox_id: "sandbox-1",
      sandbox_status: "running",
    })
    mockSessionFilesList.mockRejectedValue(new RuntimePathValidationError("../etc"))

    const response = await POST(createMockRequest({ path: "../etc", workspace: "example.test.example" }))
    const data: FilesListResponse = await response.json()

    expect(response.status).toBe(403)
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error).toBe("PATH_OUTSIDE_WORKSPACE")
    }
  })

  it("passes through workspace lookup failures", async () => {
    vi.mocked(getWorkspace).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: "WORKSPACE_NOT_FOUND" }, { status: 404 }),
    })

    const response = await POST(createMockRequest({ path: "", workspace: "example.test.example" }))
    const data: FilesListResponse = await response.json()

    expect(response.status).toBe(404)
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error).toBe("WORKSPACE_NOT_FOUND")
    }
  })
})
