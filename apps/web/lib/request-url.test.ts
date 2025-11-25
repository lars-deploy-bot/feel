/**
 * Tests for request URL utilities
 */

import { describe, expect, it } from "vitest"
import type { NextRequest } from "next/server"
import { getRequestUrls } from "./request-url"

// Mock NextRequest helper
function createMockRequest(url: string, headers: Record<string, string>): NextRequest {
  return {
    url,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as unknown as NextRequest
}

describe("getRequestUrls", () => {
  it("should return both baseUrl and fullUrl with correct domain from proxy headers", () => {
    const req = createMockRequest("http://localhost:8997/api/auth/linear?code=abc123", {
      "x-forwarded-host": "dev.terminal.goalive.nl",
      "x-forwarded-proto": "https",
      host: "localhost:8997",
    })

    const { baseUrl, fullUrl } = getRequestUrls(req)
    expect(baseUrl).toBe("https://dev.terminal.goalive.nl")
    expect(fullUrl).toBe("https://dev.terminal.goalive.nl/api/auth/linear?code=abc123")
  })

  it("should fall back to host header if x-forwarded-host is missing", () => {
    const req = createMockRequest("http://localhost:8997/api/auth/linear", {
      host: "example.com",
      "x-forwarded-proto": "https",
    })

    const { baseUrl, fullUrl } = getRequestUrls(req)
    expect(baseUrl).toBe("https://example.com")
    expect(fullUrl).toBe("https://example.com/api/auth/linear")
  })

  it("should fall back to request URL protocol if x-forwarded-proto is missing", () => {
    const req = createMockRequest("http://localhost:8997/api/auth/linear", {
      host: "example.com",
    })

    const { baseUrl } = getRequestUrls(req)
    // Falls back to requestUrl.protocol ("http") when x-forwarded-proto is missing
    expect(baseUrl).toBe("http://example.com")
  })

  it("should preserve query parameters in fullUrl", () => {
    const req = createMockRequest("http://localhost:8997/settings?status=error&message=test", {
      "x-forwarded-host": "terminal.goalive.nl",
      "x-forwarded-proto": "https",
    })

    const { fullUrl } = getRequestUrls(req)
    expect(fullUrl).toBe("https://terminal.goalive.nl/settings?status=error&message=test")
  })

  it("should work without query parameters", () => {
    const req = createMockRequest("http://localhost:8997/api/login", {
      "x-forwarded-host": "terminal.goalive.nl",
      "x-forwarded-proto": "https",
    })

    const { fullUrl } = getRequestUrls(req)
    expect(fullUrl).toBe("https://terminal.goalive.nl/api/login")
  })

  it("should parse headers only once (performance test)", () => {
    const req = createMockRequest("http://localhost:8997/api/test", {
      "x-forwarded-host": "example.com",
      "x-forwarded-proto": "https",
    })

    // Single call returns both values
    const { baseUrl, fullUrl } = getRequestUrls(req)
    expect(baseUrl).toBe("https://example.com")
    expect(fullUrl).toBe("https://example.com/api/test")
  })
})
