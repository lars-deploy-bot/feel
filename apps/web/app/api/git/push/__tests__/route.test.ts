import fs from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

interface MockCommandResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
}

const runAsWorkspaceUserMock = vi.fn<(params: unknown) => Promise<MockCommandResult>>()
const getSessionUserMock = vi.fn()
const getAccessTokenMock = vi.fn()
let isAuthorized = true

interface WorkspaceApiConfig {
  schema: {
    safeParse: (input: unknown) =>
      | {
          success: true
          data: { workspaceRoot: string; branch?: string; remote?: string }
        }
      | {
          success: false
          error: { issues: unknown[] }
        }
  }
  handler: (params: {
    data: { workspaceRoot: string; branch?: string; remote?: string }
    requestId: string
  }) => Promise<Response>
}

vi.mock("@/lib/workspace-api-handler", () => ({
  handleWorkspaceApi: async (req: Request, config: WorkspaceApiConfig) => {
    if (!isAuthorized) {
      return new Response(JSON.stringify({ ok: false, error: ErrorCodes.UNAUTHORIZED }), { status: 401 })
    }
    const body = await req.json()
    const parsed = config.schema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: ErrorCodes.INVALID_REQUEST }), { status: 400 })
    }
    return config.handler({ data: parsed.data, requestId: "req-test" })
  },
}))

vi.mock("@/features/auth/lib/auth", () => ({
  getSessionUser: () => getSessionUserMock(),
}))

vi.mock("@/lib/oauth/oauth-instances", () => ({
  getOAuthInstance: vi.fn(() => ({
    getAccessToken: (...args: unknown[]) => getAccessTokenMock(...args),
  })),
}))

vi.mock("@/lib/workspace-execution/command-runner", () => ({
  runAsWorkspaceUser: (params: unknown) => runAsWorkspaceUserMock(params),
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

const { POST } = await import("../route")

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/git/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/git/push", () => {
  let siteRoot = ""
  let workspaceRoot = ""

  beforeEach(() => {
    isAuthorized = true
    runAsWorkspaceUserMock.mockReset()
    getSessionUserMock.mockReset()
    getAccessTokenMock.mockReset()

    getSessionUserMock.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    })
    getAccessTokenMock.mockResolvedValue("github-token")

    siteRoot = fs.mkdtempSync(path.join(tmpdir(), "git-push-site-"))
    workspaceRoot = path.join(siteRoot, "user")
    fs.mkdirSync(workspaceRoot, { recursive: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
    if (siteRoot && fs.existsSync(siteRoot)) {
      fs.rmSync(siteRoot, { recursive: true, force: true })
    }
  })

  it("reads sourceRepo from parent metadata when workspaceRoot is <site>/user", async () => {
    fs.writeFileSync(
      path.join(siteRoot, ".site-metadata.json"),
      JSON.stringify({
        sourceRepo: "https://github.com/acme/repo",
      }),
      "utf8",
    )

    runAsWorkspaceUserMock
      .mockResolvedValueOnce({
        success: false,
        stdout: "",
        stderr: "error: No such remote 'origin'",
        exitCode: 2,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: "ok",
        stderr: "",
        exitCode: 0,
      })

    const response = await POST(
      createRequest({
        workspaceRoot,
      }),
    )

    expect(response.status).toBe(200)
    expect(runAsWorkspaceUserMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        command: "git",
        args: ["remote", "add", "origin", "https://github.com/acme/repo.git"],
      }),
    )

    // The push call (3rd) must carry inline git credential env
    expect(runAsWorkspaceUserMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        command: "git",
        args: ["push", "origin"],
        env: expect.objectContaining({
          GIT_TERMINAL_PROMPT: "0",
          GIT_CONFIG_KEY_0: "credential.helper",
        }),
      }),
    )
  })

  it("returns 400 when remote is missing and sourceRepo metadata is unavailable", async () => {
    runAsWorkspaceUserMock.mockResolvedValueOnce({
      success: false,
      stdout: "",
      stderr: "error: No such remote 'origin'",
      exitCode: 2,
    })

    const response = await POST(
      createRequest({
        workspaceRoot,
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: ErrorCodes.VALIDATION_ERROR })
  })

  it("returns 401 when workspace API auth fails", async () => {
    isAuthorized = false

    const response = await POST(
      createRequest({
        workspaceRoot,
      }),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: ErrorCodes.UNAUTHORIZED })
    expect(runAsWorkspaceUserMock).not.toHaveBeenCalled()
  })

  it("returns 403 when GitHub OAuth token is unavailable", async () => {
    getAccessTokenMock.mockRejectedValueOnce(new Error("not connected"))

    const response = await POST(
      createRequest({
        workspaceRoot,
      }),
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: ErrorCodes.GITHUB_NOT_CONNECTED })
    expect(runAsWorkspaceUserMock).not.toHaveBeenCalled()
  })
})
