import { RESERVED_USER_ENV_KEYS } from "@webalive/shared"
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"

const { getSessionUserMock, setUserEnvKeyMock, listUserEnvKeyNamesMock, deleteUserEnvKeyMock, captureExceptionMock } =
  vi.hoisted(() => ({
    getSessionUserMock: vi.fn(),
    setUserEnvKeyMock: vi.fn(),
    listUserEnvKeyNamesMock: vi.fn(),
    deleteUserEnvKeyMock: vi.fn(),
    captureExceptionMock: vi.fn(),
  }))

vi.mock("@/features/auth/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
}))

vi.mock("@/lib/oauth/oauth-instances", () => ({
  getUserEnvKeysManager: () => ({
    setUserEnvKey: setUserEnvKeyMock,
    listUserEnvKeyNames: listUserEnvKeyNamesMock,
    deleteUserEnvKey: deleteUserEnvKeyMock,
  }),
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}))

const { POST } = await import("../route")

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/user-env-keys", {
    method: "POST",
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
    expect(json.details.message).toContain(reservedKeyName)
    expect(setUserEnvKeyMock).not.toHaveBeenCalled()
  })

  it("returns 200 and stores key on valid request", async () => {
    getSessionUserMock.mockResolvedValue({ id: "user-1" })

    const response = await POST(createPostRequest({ keyName: "OPENAI_API_KEY", keyValue: "secret" }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.keyName).toBe("OPENAI_API_KEY")
    expect(setUserEnvKeyMock).toHaveBeenCalledWith("user-1", "OPENAI_API_KEY", "secret")
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
