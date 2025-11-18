/**
 * Integration Tests for Manager Users API
 *
 * Tests the /api/manager/users endpoint that returns user list for the manager
 */

import { beforeAll, describe, expect, it, vi } from "vitest"
import { createIamClient } from "@/lib/supabase/iam"

// Mock auth check
vi.mock("@/features/auth/lib/auth", () => ({
  isManagerAuthenticated: vi.fn(),
}))

// Mock Supabase client
vi.mock("@/lib/supabase/iam", () => ({
  createIamClient: vi.fn(),
}))

// Import after mocking
const { GET } = await import("../route")
const { isManagerAuthenticated } = await import("@/features/auth/lib/auth")

function createMockRequest(url: string, options: RequestInit = {}): Request {
  const req = new Request(url, options) as any
  req.nextUrl = new URL(url)
  return req
}

describe("GET /api/manager/users", () => {
  beforeAll(() => {
    // Reset mocks
    vi.clearAllMocks()
  })

  describe("Authentication", () => {
    it("should require manager authentication", async () => {
      // Mock: NOT authenticated
      ;(isManagerAuthenticated as any).mockResolvedValue(false)

      const req = createMockRequest("http://localhost/api/manager/users")
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.ok).toBe(false)
      expect(data.error).toBe("UNAUTHORIZED")
    })

    it("should allow authenticated manager", async () => {
      // Mock: Authenticated
      ;(isManagerAuthenticated as any).mockResolvedValue(true)

      // Mock: Supabase returns empty users
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })

      ;(createIamClient as any).mockResolvedValue({
        from: vi.fn(() => ({
          select: mockSelect,
        })),
      } as any)

      mockSelect.mockReturnValue({
        eq: mockEq,
      })
      mockEq.mockReturnValue({
        order: mockOrder,
      })

      const req = createMockRequest("http://localhost/api/manager/users")
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)
      expect(data.users).toBeDefined()
    })
  })

  describe("User Filtering", () => {
    it("should filter out test users (is_test_env = true)", async () => {
      // Mock: Authenticated
      ;(isManagerAuthenticated as any).mockResolvedValue(true)

      // Mock: Supabase query
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { user_id: "user-1", email: "real@example.com", is_test_env: false },
          { user_id: "user-2", email: "another@example.com", is_test_env: false },
        ],
        error: null,
      })

      ;(createIamClient as any).mockResolvedValue({
        from: vi.fn(() => ({
          select: mockSelect,
        })),
      } as any)

      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ order: mockOrder })

      const req = createMockRequest("http://localhost/api/manager/users")
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ok).toBe(true)

      // Verify the query filtered for is_test_env = false
      expect(mockEq).toHaveBeenCalledWith("is_test_env", false)
      expect(data.users).toHaveLength(2)
    })

    it("should return only real users", async () => {
      // Mock: Authenticated
      ;(isManagerAuthenticated as any).mockResolvedValue(true)

      // Mock: Supabase returns mixed users (should be filtered at DB level)
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          {
            user_id: "real-1",
            email: "real.user@gmail.com",
            display_name: "Real User",
            created_at: "2024-01-01",
            status: "active",
          },
        ],
        error: null,
      })

      ;(createIamClient as any).mockResolvedValue({
        from: vi.fn(() => ({
          select: mockSelect,
        })),
      } as any)

      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ order: mockOrder })

      const req = createMockRequest("http://localhost/api/manager/users")
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.users).toEqual([
        {
          user_id: "real-1",
          email: "real.user@gmail.com",
          display_name: "Real User",
          created_at: "2024-01-01",
          status: "active",
        },
      ])
    })
  })

  describe("Error Handling", () => {
    it("should handle database errors", async () => {
      // Mock: Authenticated
      ;(isManagerAuthenticated as any).mockResolvedValue(true)

      // Mock: Supabase error
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      })

      ;(createIamClient as any).mockResolvedValue({
        from: vi.fn(() => ({
          select: mockSelect,
        })),
      } as any)

      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ order: mockOrder })

      const req = createMockRequest("http://localhost/api/manager/users")
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.ok).toBe(false)
      expect(data.error).toBe("DATABASE_ERROR")
    })
  })

  describe("CORS", () => {
    it("should add CORS headers to response", async () => {
      // Mock: Authenticated
      ;(isManagerAuthenticated as any).mockResolvedValue(true)

      // Mock: Supabase
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null })

      ;(createIamClient as any).mockResolvedValue({
        from: vi.fn(() => ({
          select: mockSelect,
        })),
      } as any)

      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ order: mockOrder })

      const req = createMockRequest("http://localhost/api/manager/users", {
        headers: { origin: "http://staging.terminal.goalive.nl" },
      })

      const response = await GET(req)

      expect(response.headers.get("Access-Control-Allow-Origin")).toBeTruthy()
    })
  })
})
