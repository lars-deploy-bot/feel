import { NextRequest, NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/features/auth/lib/auth", () => ({
  getSessionUser: vi.fn(),
  verifyWorkspaceAccess: vi.fn(),
}))

vi.mock("@/features/workspace/lib/workspace-utils", () => ({
  resolveWorkspace: vi.fn(),
}))

vi.mock("@/lib/storage", () => ({
  imageStorage: {
    list: vi.fn(),
  },
}))

const { GET } = await import("../route")
const { getSessionUser, verifyWorkspaceAccess } = await import("@/features/auth/lib/auth")
const { resolveWorkspace } = await import("@/features/workspace/lib/workspace-utils")
const { imageStorage } = await import("@/lib/storage")

const MOCK_USER = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  canSelectAnyModel: false,
  isAdmin: false,
  isSuperadmin: false,
  enabledModels: [],
}

function createRequest(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/images/list${query}`, {
    method: "GET",
    headers: { host: "localhost" },
  })
}

describe("GET /api/images/list", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getSessionUser).mockResolvedValue(MOCK_USER)
    vi.mocked(verifyWorkspaceAccess).mockResolvedValue("demo.alive.best")
    vi.mocked(resolveWorkspace).mockResolvedValue({
      success: true,
      workspace: "/srv/webalive/sites/demo.alive.best/user",
    })
    vi.mocked(imageStorage.list).mockResolvedValue({ data: [], error: null })
  })

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)

    const res = await GET(createRequest("?workspace=demo.alive.best"))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.error).toBe("UNAUTHORIZED")
  })

  it("returns 401 when workspace authorization fails", async () => {
    vi.mocked(verifyWorkspaceAccess).mockResolvedValue(null)

    const res = await GET(createRequest("?workspace=demo.alive.best"))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.ok).toBe(false)
    expect(data.error).toBe("WORKSPACE_NOT_AUTHENTICATED")
  })

  it("returns 500 when storage list fails", async () => {
    vi.mocked(imageStorage.list).mockResolvedValue({
      data: null,
      error: { message: "boom", code: "fs:list" },
    })

    const res = await GET(createRequest("?workspace=demo.alive.best"))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.ok).toBe(false)
    expect(data.error).toBe("IMAGE_LIST_FAILED")
  })

  it("groups variants by content hash and ignores malformed keys", async () => {
    vi.mocked(imageStorage.list).mockResolvedValue({
      data: [
        "t/demo.alive.best/o/hash-1/v/orig.webp",
        "t/demo.alive.best/o/hash-1/v/thumb.webp",
        "t/demo.alive.best/o/hash-2/v/w640.webp",
        "bad-key-format",
      ],
      error: null,
    })

    const res = await GET(createRequest("?workspace=demo.alive.best&worktree=feat-x"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.count).toBe(2)
    expect(verifyWorkspaceAccess).toHaveBeenCalledWith(
      MOCK_USER,
      { workspace: "demo.alive.best", worktree: "feat-x" },
      expect.any(String),
    )

    const hash1 = data.images.find((img: { key: string }) => img.key === "demo.alive.best/hash-1")
    expect(hash1).toBeDefined()
    expect(hash1.variants.orig).toBe("t/demo.alive.best/o/hash-1/v/orig.webp")
    expect(hash1.variants.thumb).toBe("t/demo.alive.best/o/hash-1/v/thumb.webp")
  })

  it("passes through workspace resolution errors", async () => {
    vi.mocked(resolveWorkspace).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: "WORKSPACE_NOT_FOUND" }, { status: 404 }),
    })

    const res = await GET(createRequest("?workspace=demo.alive.best"))
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.ok).toBe(false)
    expect(data.error).toBe("WORKSPACE_NOT_FOUND")
  })
})
