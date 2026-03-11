/**
 * Tests for GET/PATCH /api/user endpoint
 *
 * Test cases:
 * - GET: returns user when authenticated
 * - GET: returns 401 when not authenticated
 * - PATCH: 401 without session
 * - PATCH: successful name update
 * - PATCH: successful email update
 * - PATCH: 400 for empty body (no fields)
 * - PATCH: 409 for duplicate email (unique constraint)
 * - PATCH: 500 for database errors
 */

import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"
import { MOCK_SESSION_USER } from "@/lib/test-helpers/mock-session-user"

// Mock auth
vi.mock("@/features/auth/lib/auth", async () => {
  const actual = await vi.importActual("@/features/auth/lib/auth")
  return {
    ...actual,
    getSessionUser: vi.fn(),
  }
})

// Mock Supabase client
vi.mock("@/lib/supabase/iam", () => ({
  createIamClient: vi.fn(),
}))

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  getCurrentScope: vi.fn(() => ({ setTag: vi.fn() })),
}))

// Mock api/server to avoid @webalive/database resolution
vi.mock("@/lib/api/server", () => {
  const { NextResponse } = require("next/server")
  return {
    handleBody: vi.fn(async (_endpoint: string, req: Request) => {
      const body = await req.json()
      // Validate email format like the real handleBody does via Zod
      if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 })
      }
      return body
    }),
    isHandleBodyError: (x: unknown) => x instanceof NextResponse,
  }
})

// Import after mocking
const { GET, PATCH } = await import("../route")
const { getSessionUser } = await import("@/features/auth/lib/auth")
const { createIamClient } = await import("@/lib/supabase/iam")

const MOCK_USER = MOCK_SESSION_USER

function createPatchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/user", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function setupMockSupabase(updateResult: { error: unknown }) {
  const mockEq = vi.fn().mockResolvedValue(updateResult)
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate })
  vi.mocked(createIamClient).mockResolvedValue({ from: mockFrom } as never)
  return { mockFrom, mockUpdate, mockEq }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function createGetRequest() {
  return new NextRequest("http://localhost/api/user", { method: "GET" })
}

describe("GET /api/user", () => {
  it("should return user when authenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(MOCK_USER)

    const response = await GET(createGetRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user).toEqual(MOCK_USER)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)

    const response = await GET(createGetRequest())
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe(ErrorCodes.UNAUTHORIZED)
  })
})

describe("PATCH /api/user", () => {
  it("should return 401 when not authenticated", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null)

    const req = createPatchRequest({ name: "New Name" })
    const response = await PATCH(req)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe(ErrorCodes.UNAUTHORIZED)
  })

  it("should update name successfully", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(MOCK_USER)
    const { mockUpdate, mockEq } = setupMockSupabase({ error: null })

    const req = createPatchRequest({ name: "Updated Name" })
    const response = await PATCH(req)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ display_name: "Updated Name" })
    expect(mockEq).toHaveBeenCalledWith("user_id", MOCK_USER.id)
  })

  it("should update email successfully", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(MOCK_USER)
    setupMockSupabase({ error: null })

    const req = createPatchRequest({ email: "new@example.com" })
    const response = await PATCH(req)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
  })

  it("should return 400 for empty update (no fields)", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(MOCK_USER)

    const req = createPatchRequest({})
    const response = await PATCH(req)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe(ErrorCodes.INVALID_REQUEST)
  })

  it("should return 400 for invalid email format", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(MOCK_USER)

    const req = createPatchRequest({ email: "not-an-email" })
    const response = await PATCH(req)

    expect(response.status).toBe(400)
  })

  it("should return 409 for duplicate email (unique constraint)", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(MOCK_USER)
    setupMockSupabase({ error: { code: "23505", message: "duplicate key" } })

    const req = createPatchRequest({ email: "taken@example.com" })
    const response = await PATCH(req)

    expect(response.status).toBe(409)
    const data = await response.json()
    expect(data.error).toBe(ErrorCodes.INVALID_REQUEST)
  })

  it("should return 500 for other database errors", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(MOCK_USER)
    setupMockSupabase({ error: { code: "42P01", message: "relation does not exist" } })

    const req = createPatchRequest({ name: "Test" })
    const response = await PATCH(req)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe(ErrorCodes.QUERY_FAILED)
  })
})
