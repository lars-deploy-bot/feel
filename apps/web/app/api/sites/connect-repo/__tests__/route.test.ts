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
let isAuthorized = true

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

interface WorkspaceApiConfig {
  schema: {
    safeParse: (
      input: unknown,
    ) =>
      | { success: true; data: { workspaceRoot: string; repoUrl: string } }
      | { success: false; error: { issues: unknown[] } }
  }
  handler: (params: { data: { workspaceRoot: string; repoUrl: string }; requestId: string }) => Promise<Response>
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

vi.mock("@/lib/workspace-execution/command-runner", () => ({
  runAsWorkspaceUser: (params: unknown) => runAsWorkspaceUserMock(params),
}))

const { PATCH } = await import("../route")

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/sites/connect-repo", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function readMetadata(metadataPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(metadataPath, "utf8")) as Record<string, unknown>
}

describe("PATCH /api/sites/connect-repo", () => {
  let siteRoot = ""
  let workspaceRoot = ""
  let metadataPath = ""

  beforeEach(() => {
    isAuthorized = true
    runAsWorkspaceUserMock.mockReset()

    siteRoot = fs.mkdtempSync(path.join(tmpdir(), "connect-repo-site-"))
    workspaceRoot = path.join(siteRoot, "user")
    fs.mkdirSync(workspaceRoot, { recursive: true })
    metadataPath = path.join(siteRoot, ".site-metadata.json")

    fs.writeFileSync(
      metadataPath,
      JSON.stringify({
        slug: "test-site",
        domain: "test-site.alive.best",
        workspace: "test-site.alive.best",
        email: "test@example.com",
        siteIdeas: "",
        createdAt: Date.now(),
      }),
      "utf8",
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    if (siteRoot && fs.existsSync(siteRoot)) {
      fs.rmSync(siteRoot, { recursive: true, force: true })
    }
  })

  it("returns 401 without authorization", async () => {
    isAuthorized = false

    const response = await PATCH(
      createRequest({
        workspaceRoot,
        repoUrl: "https://github.com/acme/repo",
      }),
    )

    expect(response.status).toBe(401)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.UNAUTHORIZED)
    expect(runAsWorkspaceUserMock).not.toHaveBeenCalled()
  })

  it("updates origin remote and persists sourceRepo on success", async () => {
    const seededMetadata = readMetadata(metadataPath)
    seededMetadata.sourceBranch = "old-branch"
    fs.writeFileSync(metadataPath, JSON.stringify(seededMetadata), "utf8")

    runAsWorkspaceUserMock
      .mockResolvedValueOnce({
        success: true,
        stdout: "https://github.com/acme/old-repo.git\n",
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
      })

    const response = await PATCH(
      createRequest({
        workspaceRoot,
        repoUrl: "https://github.com/acme/new-repo",
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { ok: boolean; remoteUrl: string }
    expect(payload.ok).toBe(true)
    expect(payload.remoteUrl).toBe("https://github.com/acme/new-repo.git")

    expect(runAsWorkspaceUserMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        command: "git",
        args: ["remote", "set-url", "origin", "https://github.com/acme/new-repo.git"],
      }),
    )

    const metadata = readMetadata(metadataPath)
    expect(metadata.sourceRepo).toBe("https://github.com/acme/new-repo")
    expect(metadata.sourceBranch).toBeUndefined()
  })

  it("adds origin remote when it does not exist", async () => {
    runAsWorkspaceUserMock
      .mockResolvedValueOnce({
        success: false,
        stdout: "",
        stderr: "error: No such remote 'origin'\n",
        exitCode: 2,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: "",
        stderr: "",
        exitCode: 0,
      })

    const response = await PATCH(
      createRequest({
        workspaceRoot,
        repoUrl: "https://github.com/acme/new-repo",
      }),
    )

    expect(response.status).toBe(200)
    expect(runAsWorkspaceUserMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        command: "git",
        args: ["remote", "add", "origin", "https://github.com/acme/new-repo.git"],
      }),
    )
  })

  it("returns 400 for invalid repository format", async () => {
    const response = await PATCH(
      createRequest({
        workspaceRoot,
        repoUrl: "not-a-repo",
      }),
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.VALIDATION_ERROR)
    expect(runAsWorkspaceUserMock).not.toHaveBeenCalled()
  })

  it("returns 500 when git remote update fails and does not mutate metadata", async () => {
    runAsWorkspaceUserMock
      .mockResolvedValueOnce({
        success: true,
        stdout: "https://github.com/acme/old-repo.git\n",
        stderr: "",
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        success: false,
        stdout: "",
        stderr: "fatal: could not set remote",
        exitCode: 1,
      })

    const before = readMetadata(metadataPath)
    expect(before.sourceRepo).toBeUndefined()

    const response = await PATCH(
      createRequest({
        workspaceRoot,
        repoUrl: "https://github.com/acme/new-repo",
      }),
    )

    expect(response.status).toBe(500)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toBe(ErrorCodes.INTERNAL_ERROR)

    const after = readMetadata(metadataPath)
    expect(after.sourceRepo).toBeUndefined()
  })
})
