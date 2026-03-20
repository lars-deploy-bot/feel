// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the api module before importing useAuth
vi.mock("@/lib/api", () => {
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }
  return { api: mockApi, ApiError: class extends Error {} }
})

import { useAuth } from "@/features/auth/useAuth"
// Import after mock setup
import { api } from "@/lib/api"

const mockGet = vi.mocked(api.get)
const mockPost = vi.mocked(api.post)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useAuth", () => {
  it("starts in loading state", () => {
    mockGet.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useAuth())

    expect(result.current.loading).toBe(true)
    expect(result.current.authenticated).toBe(false)
  })

  it("sets authenticated=true when /auth/me succeeds", async () => {
    mockGet.mockResolvedValueOnce({ email: "admin@test.com" })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.authenticated).toBe(true)
    expect(mockGet).toHaveBeenCalledWith("/auth/me")
  })

  it("sets authenticated=false when /auth/me fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("Unauthorized"))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.authenticated).toBe(false)
  })

  it("login calls api.post and sets authenticated=true", async () => {
    // Initial mount: not authenticated
    mockGet.mockRejectedValueOnce(new Error("Unauthorized"))
    mockPost.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.authenticated).toBe(false)

    await act(async () => {
      await result.current.login("test-passcode")
    })

    expect(mockPost).toHaveBeenCalledWith("/auth/login", { passcode: "test-passcode" })
    expect(result.current.authenticated).toBe(true)
  })

  it("logout calls api.post and sets authenticated=false", async () => {
    // Initial mount: authenticated
    mockGet.mockResolvedValueOnce({ email: "admin@test.com" })
    mockPost.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.authenticated).toBe(true))

    await act(async () => {
      await result.current.logout()
    })

    expect(mockPost).toHaveBeenCalledWith("/auth/logout")
    expect(result.current.authenticated).toBe(false)
  })

  it("login propagates errors from the api", async () => {
    mockGet.mockRejectedValueOnce(new Error("Unauthorized"))
    mockPost.mockRejectedValueOnce(new Error("Invalid passcode"))

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      act(async () => {
        await result.current.login("wrong")
      }),
    ).rejects.toThrow("Invalid passcode")

    // Should NOT be authenticated after failed login
    expect(result.current.authenticated).toBe(false)
  })
})
