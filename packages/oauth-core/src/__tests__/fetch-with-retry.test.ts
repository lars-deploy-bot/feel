/**
 * Tests for fetchWithRetry — the HTTP retry layer for all OAuth provider calls.
 *
 * Critical behaviors:
 * 1. Returns response on 2xx (no retry)
 * 2. Returns response on 4xx (no retry — client errors are intentional)
 * 3. Retries on 5xx (server errors)
 * 4. Retries on network errors (connection refused, DNS, timeout)
 * 5. Throws FetchRetryError after all retries exhausted
 * 6. Does NOT retry on 4xx even after multiple attempts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FetchRetryError, fetchWithRetry } from "../fetch-with-retry"

// Mock global fetch
const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch)
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Helper to create a mock Response */
function mockResponse(status: number, body: unknown = {}, statusText = ""): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: statusText || `Status ${status}`,
    headers: { "Content-Type": "application/json" },
  })
}

describe("fetchWithRetry", () => {
  // ---------------------------------------------------------------
  // Success cases: no retry needed
  // ---------------------------------------------------------------

  it("returns response immediately on 200", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, { access_token: "token" }))

    const res = await fetchWithRetry("https://api.example.com/token", { method: "POST" })

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("returns response immediately on 201", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(201))

    const res = await fetchWithRetry("https://api.example.com/token", { method: "POST" })

    expect(res.status).toBe(201)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------
  // Client errors (4xx): returned as-is, NO retry
  // ---------------------------------------------------------------

  it("returns 400 response without retrying", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(400, { error: "invalid_request" }))

    const res = await fetchWithRetry("https://api.example.com/token", { method: "POST" }, { maxRetries: 3 })

    expect(res.status).toBe(400)
    expect(mockFetch).toHaveBeenCalledTimes(1) // No retry
  })

  it("returns 401 response without retrying", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(401, { error: "invalid_grant" }))

    const res = await fetchWithRetry("https://api.example.com/token", { method: "POST" }, { maxRetries: 3 })

    expect(res.status).toBe(401)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("returns 403 response without retrying", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(403, { error: "forbidden" }))

    const res = await fetchWithRetry("https://api.example.com/token", { method: "POST" }, { maxRetries: 3 })

    expect(res.status).toBe(403)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("returns 429 response without retrying via fetchWithRetry itself", async () => {
    // 429 is < 500 so fetchWithRetry returns it as-is (not a FetchRetryError)
    // The retryAsync shouldRetry only sees FetchRetryError for HTTP status checks
    mockFetch.mockResolvedValueOnce(mockResponse(429, { error: "rate_limited" }))

    const res = await fetchWithRetry("https://api.example.com/token", { method: "POST" }, { maxRetries: 3 })

    expect(res.status).toBe(429)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------
  // Server errors (5xx): RETRIED
  // ---------------------------------------------------------------

  it("retries on 500 and succeeds on second attempt", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(500, { error: "internal_error" }))
      .mockResolvedValueOnce(mockResponse(200, { access_token: "token" }))

    const res = await fetchWithRetry(
      "https://api.example.com/token",
      { method: "POST" },
      { maxRetries: 3, minDelayMs: 1, maxDelayMs: 10 },
    )

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("retries on 502 and succeeds on third attempt", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(502, { error: "bad_gateway" }))
      .mockResolvedValueOnce(mockResponse(503, { error: "unavailable" }))
      .mockResolvedValueOnce(mockResponse(200, { access_token: "token" }))

    const res = await fetchWithRetry(
      "https://api.example.com/token",
      { method: "POST" },
      { maxRetries: 3, minDelayMs: 1, maxDelayMs: 10 },
    )

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it("throws FetchRetryError after all retries exhausted on 500", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(500))

    await expect(
      fetchWithRetry(
        "https://api.example.com/token",
        { method: "POST" },
        { maxRetries: 3, minDelayMs: 1, maxDelayMs: 10 },
      ),
    ).rejects.toThrow(FetchRetryError)

    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  // ---------------------------------------------------------------
  // Network errors: RETRIED
  // ---------------------------------------------------------------

  it("retries on network error and succeeds", async () => {
    const networkError = new TypeError("Failed to fetch")
    // @ts-expect-error - adding code for retry detection
    networkError.code = "ECONNREFUSED"

    mockFetch.mockRejectedValueOnce(networkError).mockResolvedValueOnce(mockResponse(200, { token: "ok" }))

    const res = await fetchWithRetry(
      "https://api.example.com/token",
      { method: "POST" },
      { maxRetries: 3, minDelayMs: 1, maxDelayMs: 10 },
    )

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  // ---------------------------------------------------------------
  // FetchRetryError shape
  // ---------------------------------------------------------------

  it("FetchRetryError carries status and response", () => {
    const response = mockResponse(503, { error: "unavailable" })
    const error = new FetchRetryError("HTTP 503: Service Unavailable", 503, response)

    expect(error.name).toBe("FetchRetryError")
    expect(error.status).toBe(503)
    expect(error.response).toBe(response)
    expect(error.message).toBe("HTTP 503: Service Unavailable")
    expect(error).toBeInstanceOf(Error)
  })

  // ---------------------------------------------------------------
  // Options passthrough
  // ---------------------------------------------------------------

  it("passes fetch options (method, headers, body) through correctly", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200))

    await fetchWithRetry("https://api.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=abc",
    })

    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=abc",
    })
  })
})
