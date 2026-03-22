import { RESERVED_USER_ENV_KEYS } from "@webalive/shared"
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

const {
  getSessionUserMock,
  setUserEnvKeyMock,
  listUserEnvKeysMock,
  deleteAllUserEnvKeyScopesMock,
  captureExceptionMock,
} = vi.hoisted(() => ({
  getSessionUserMock: vi.fn(),
  setUserEnvKeyMock: vi.fn(),
  listUserEnvKeysMock: vi.fn(),
  deleteAllUserEnvKeyScopesMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}))

vi.mock("@/features/auth/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}))

vi.mock("@/lib/oauth/oauth-instances", () => ({
  getUserEnvKeysManager: () => ({
    setUserEnvKey: setUserEnvKeyMock,
    listUserEnvKeys: listUserEnvKeysMock,
    deleteAllUserEnvKeyScopes: deleteAllUserEnvKeyScopesMock,
  }),
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}))

const { DELETE, GET, POST } = await import("../route")

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/user-env-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function createDeleteRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/user-env-keys", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/user-env-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setUserEnvKeyMock.mockResolvedValue(undefined)
  })

  it("returns 401 when unauthenticated", async () => {
    getSessionUserMock.mockResolvedValue(null)

    const response = await POST(createPostRequest({ keyName: "OPENAI_API_KEY", keyValue: "x" }))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe(ErrorCodes.UNAUTHORIZED)
  })

  it("returns 400 for invalid input", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })

    const response = await POST(createPostRequest({ keyName: "invalid_key", keyValue: "x" }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe(ErrorCodes.INVALID_REQUEST)
    expect(json.details.field).toBe("keyName")
  })

  it("returns 400 for reserved key names", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })
    const reservedKeyName = RESERVED_USER_ENV_KEYS[0]
    if (!reservedKeyName) {
      throw new Error("Expected at least one reserved user env key")
    }

    const response = await POST(createPostRequest({ keyName: reservedKeyName, keyValue: "x" }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe(ErrorCodes.INVALID_REQUEST)
    expect(json.details.field).toBe("keyName")
    expect(json.details.message).toContain("reserved")
    expect(setUserEnvKeyMock).not.toHaveBeenCalled()
  })

  it("returns 200 and stores key on valid request", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })

    const response = await POST(createPostRequest({ keyName: "OPENAI_API_KEY", keyValue: "secret" }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.keyName).toBe("OPENAI_API_KEY")
    expect(setUserEnvKeyMock).toHaveBeenCalledWith("user-1", "OPENAI_API_KEY", "secret", undefined)
  })

  it("returns 500 when storage layer throws", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })
    const error = new Error("lockbox unavailable")
    setUserEnvKeyMock.mockRejectedValue(error)

    const response = await POST(createPostRequest({ keyName: "OPENAI_API_KEY", keyValue: "secret" }))
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe(ErrorCodes.INTERNAL_ERROR)
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
  })
})

describe("GET /api/user-env-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listUserEnvKeysMock.mockResolvedValue([])
  })

  it("returns 401 when unauthenticated", async () => {
    getSessionUserMock.mockResolvedValue(null)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe(ErrorCodes.UNAUTHORIZED)
  })

  it("returns 200 with key names when authenticated", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })
    listUserEnvKeysMock.mockResolvedValue([
      { name: "OPENAI_API_KEY", workspace: "", environment: "" },
      { name: "GITHUB_TOKEN", workspace: "", environment: "" },
    ])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.keys).toEqual([
      { name: "OPENAI_API_KEY", hasValue: true, workspace: "", environments: [] },
      { name: "GITHUB_TOKEN", hasValue: true, workspace: "", environments: [] },
    ])
    expect(listUserEnvKeysMock).toHaveBeenCalledWith("user-1")
  })

  it("returns 500 when key listing fails", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })
    const error = new Error("list failed")
    listUserEnvKeysMock.mockRejectedValue(error)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe(ErrorCodes.INTERNAL_ERROR)
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
  })
})

describe("DELETE /api/user-env-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteAllUserEnvKeyScopesMock.mockResolvedValue(undefined)
  })

  it("returns 401 when unauthenticated", async () => {
    getSessionUserMock.mockResolvedValue(null)

    const response = await DELETE(createDeleteRequest({ keyName: "OPENAI_API_KEY" }))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe(ErrorCodes.UNAUTHORIZED)
  })

  it("returns 400 for invalid delete request body", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })

    const response = await DELETE(createDeleteRequest({ keyName: "" }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe(ErrorCodes.INVALID_REQUEST)
    expect(json.details.field).toBe("keyName")
  })

  it("returns 200 and deletes key on valid request", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })

    const response = await DELETE(createDeleteRequest({ keyName: "OPENAI_API_KEY" }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.keyName).toBe("OPENAI_API_KEY")
    expect(deleteAllUserEnvKeyScopesMock).toHaveBeenCalledWith("user-1", "OPENAI_API_KEY", undefined)
  })

  it("returns 500 when delete fails", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })
    const error = new Error("delete failed")
    deleteAllUserEnvKeyScopesMock.mockRejectedValue(error)

    const response = await DELETE(createDeleteRequest({ keyName: "OPENAI_API_KEY" }))
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe(ErrorCodes.INTERNAL_ERROR)
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
  })
})
