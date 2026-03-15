import { existsSync, mkdirSync, realpathSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { MOCK_SESSION_USER } from "@/lib/test-helpers/mock-session-user"

const mockGetSessionUser = vi.fn()
const mockVerifyWorkspaceAccess = vi.fn()

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

const mockResolveDomainRuntime = vi.fn()
vi.mock("@/lib/domain/resolve-domain-runtime", () => ({
  resolveDomainRuntime: (...args: unknown[]) => mockResolveDomainRuntime(...args),
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

const mockEnsureDirectoryAsWorkspaceOwner = vi.fn()
const mockWriteAsWorkspaceOwner = vi.fn()
vi.mock("@/features/workspace/lib/workspace-secure", () => ({
  ensureDirectoryAsWorkspaceOwner: (...args: unknown[]) => mockEnsureDirectoryAsWorkspaceOwner(...args),
  writeAsWorkspaceOwner: (...args: unknown[]) => mockWriteAsWorkspaceOwner(...args),
}))

const { POST } = await import("../route")
const { getWorkspace } = await import("@/features/chat/lib/workspaceRetriever")

const TEST_WORKSPACE = path.join(realpathSync(tmpdir()), "write-test-workspace")

interface WriteSuccessResponse {
  ok: true
  path: string
}

interface WriteErrorResponse {
  error: string
  ok: false
}

type WriteResponse = WriteErrorResponse | WriteSuccessResponse

function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/files/write", {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "localhost" },
    body: JSON.stringify(body),
  })
}

function createInvalidJsonRequest(): NextRequest {
  return new NextRequest("http://localhost/api/files/write", {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "localhost" },
    body: "{not-valid-json",
  })
}

describe("POST /api/files/write", () => {
  beforeAll(() => {
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true })
    }
    mkdirSync(TEST_WORKSPACE, { recursive: true })
    mkdirSync(path.join(TEST_WORKSPACE, "existing-dir"), { recursive: true })
  })

  afterAll(() => {
    if (existsSync(TEST_WORKSPACE)) {
      rmSync(TEST_WORKSPACE, { recursive: true })
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()

    mockGetSessionUser.mockResolvedValue(MOCK_SESSION_USER)
    mockVerifyWorkspaceAccess.mockResolvedValue("test-workspace")
    mockResolveDomainRuntime.mockResolvedValue(null)
    mockEnsureDirectoryAsWorkspaceOwner.mockResolvedValue(undefined)
    mockWriteAsWorkspaceOwner.mockImplementation(() => {})

    vi.mocked(getWorkspace).mockResolvedValue({
      success: true,
      workspace: TEST_WORKSPACE,
    })
  })

  it("requires an authenticated session", async () => {
    mockGetSessionUser.mockResolvedValue(null)

    const response = await POST(createMockRequest({ path: "test.txt", content: "" }))
    const data: WriteResponse = await response.json()

    expect(response.status).toBe(401)
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error).toBe("NO_SESSION")
    }
  })

  it("rejects invalid JSON bodies", async () => {
    const response = await POST(createInvalidJsonRequest())
    const data: WriteResponse = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error).toBe("INVALID_JSON")
    }
  })

  it("requires a path and string content", async () => {
    const missingPath = await POST(createMockRequest({ content: "" }))
    const missingPathData: WriteResponse = await missingPath.json()

    expect(missingPath.status).toBe(400)
    expect(missingPathData.ok).toBe(false)
    if (!missingPathData.ok) {
      expect(missingPathData.error).toBe("INVALID_REQUEST")
    }

    const missingContent = await POST(createMockRequest({ path: "test.txt" }))
    const missingContentData: WriteResponse = await missingContent.json()

    expect(missingContent.status).toBe(400)
    expect(missingContentData.ok).toBe(false)
    if (!missingContentData.ok) {
      expect(missingContentData.error).toBe("INVALID_REQUEST")
    }
  })

  it("blocks path traversal attempts", async () => {
    const response = await POST(createMockRequest({ path: "../../../etc/passwd", content: "" }))
    const data: WriteResponse = await response.json()

    expect(response.status).toBe(403)
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error).toBe("PATH_OUTSIDE_WORKSPACE")
    }
  })

  it("rejects directory targets", async () => {
    const response = await POST(createMockRequest({ path: "existing-dir", content: "" }))
    const data: WriteResponse = await response.json()

    expect(response.status).toBe(400)
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error).toBe("PATH_IS_DIRECTORY")
    }
  })

  it("writes nested files using workspace ownership helpers", async () => {
    const filePath = "src/components/Button.tsx"
    const content = "export const Button = () => null\n"

    const response = await POST(createMockRequest({ path: filePath, content }))
    const data: WriteResponse = await response.json()

    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    if (data.ok) {
      expect(data.path).toBe(filePath)
    }

    const expectedDirectory = path.join(TEST_WORKSPACE, "src", "components")
    const expectedPath = path.join(TEST_WORKSPACE, "src", "components", "Button.tsx")

    expect(mockEnsureDirectoryAsWorkspaceOwner).toHaveBeenCalledWith(
      expectedDirectory,
      TEST_WORKSPACE,
      expect.objectContaining({
        uid: expect.any(Number),
        gid: expect.any(Number),
      }),
    )
    expect(mockWriteAsWorkspaceOwner).toHaveBeenCalledWith(
      expectedPath,
      content,
      expect.objectContaining({
        uid: expect.any(Number),
        gid: expect.any(Number),
      }),
    )
  })

  it("passes through workspace lookup failures", async () => {
    vi.mocked(getWorkspace).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: "WORKSPACE_NOT_FOUND" }, { status: 404 }),
    })

    const response = await POST(createMockRequest({ path: "test.txt", content: "" }))
    const data: WriteResponse = await response.json()

    expect(response.status).toBe(404)
    expect(data.ok).toBe(false)
    if (!data.ok) {
      expect(data.error).toBe("WORKSPACE_NOT_FOUND")
    }
  })
})
