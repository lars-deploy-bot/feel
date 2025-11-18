import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * BRIDGE API CLIENT SECRET HEADER TESTS
 *
 * These tests verify that the bridge-api-client correctly includes
 * the INTERNAL_TOOLS_SECRET header for internal-tools API calls.
 *
 * Critical security checks:
 * 1. Secret header added for /api/internal-tools/* endpoints
 * 2. Secret header NOT added for other endpoints (security leak)
 * 3. Secret read from environment variable
 * 4. Missing secret handled gracefully
 */

// Store original env
const originalSecret = process.env.INTERNAL_TOOLS_SECRET
const originalSessionCookie = process.env.BRIDGE_SESSION_COOKIE
const _originalValidate = global.validateWorkspacePath

// Mock workspace validator to bypass path validation for these tests
vi.mock("../src/lib/workspace-validator.js", () => ({
  validateWorkspacePath: vi.fn(), // No-op, allows all paths
}))

import { callBridgeApi } from "../src/lib/bridge-api-client.js"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe("callBridgeApi - Internal Tools Secret Header", () => {
  beforeEach(() => {
    process.env.INTERNAL_TOOLS_SECRET = "test-secret-xyz"
    process.env.BRIDGE_SESSION_COOKIE = "test-session-abc"
    mockFetch.mockClear()

    // Default mock response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, message: "Success" }),
    })
  })

  afterEach(() => {
    process.env.INTERNAL_TOOLS_SECRET = originalSecret
    process.env.BRIDGE_SESSION_COOKIE = originalSessionCookie
    vi.clearAllMocks()
  })

  /**
   * THE MISSING SECRET HEADER BUG TEST
   * Internal tools endpoints MUST include X-Internal-Tools-Secret header
   */
  it("should include secret header for internal-tools endpoints (THE MISSING HEADER BUG)", async () => {
    await callBridgeApi({
      endpoint: "/api/internal-tools/read-logs",
      body: { workspace: "test.com", workspaceRoot: "/srv/webalive/sites/test.com/user" },
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [_, options] = mockFetch.mock.calls[0]

    expect(options.headers).toHaveProperty("X-Internal-Tools-Secret")
    expect(options.headers["X-Internal-Tools-Secret"]).toBe("test-secret-xyz")

    // If this test FAILS, internal tools API calls will be rejected (401)
  })

  /**
   * THE SECRET LEAK BUG TEST
   * Non-internal-tools endpoints should NOT include secret header
   * This prevents leaking the secret to external/non-privileged APIs
   */
  it("should NOT include secret for non-internal-tools endpoints (THE SECRET LEAK BUG)", async () => {
    const regularEndpoints = [
      "/api/restart-workspace",
      "/api/verify",
      "/api/files",
      "/api/deploy",
      "/api/some-other-endpoint",
    ]

    for (const endpoint of regularEndpoints) {
      mockFetch.mockClear()
      await callBridgeApi({
        endpoint,
        body: { workspaceRoot: "/srv/webalive/sites/test.com/user" },
      })

      const [_, options] = mockFetch.mock.calls[0]

      expect(options.headers).not.toHaveProperty("X-Internal-Tools-Secret")

      // If this test FAILS, we leak the secret to non-privileged endpoints
    }
  })

  /**
   * THE SESSION COOKIE ALWAYS INCLUDED BUG TEST
   * Session cookie should be included for ALL endpoints (not just internal-tools)
   */
  it("should include session cookie for all endpoints (THE MISSING SESSION BUG)", async () => {
    const allEndpoints = ["/api/internal-tools/read-logs", "/api/restart-workspace", "/api/verify", "/api/files"]

    for (const endpoint of allEndpoints) {
      mockFetch.mockClear()
      await callBridgeApi({
        endpoint,
        body: { workspaceRoot: "/srv/webalive/sites/test.com/user" },
      })

      const [_, options] = mockFetch.mock.calls[0]

      expect(options.headers).toHaveProperty("Cookie")
      expect(options.headers.Cookie).toBe("session=test-session-abc")

      // If this test FAILS, some endpoints won't have authentication
    }
  })

  /**
   * THE MISSING ENV SECRET BUG TEST
   * If INTERNAL_TOOLS_SECRET is not set, should still make call (without header)
   * API will reject it, but client shouldn't crash
   */
  it("should handle missing env secret gracefully (THE MISSING ENV SECRET BUG)", async () => {
    delete process.env.INTERNAL_TOOLS_SECRET

    await callBridgeApi({
      endpoint: "/api/internal-tools/read-logs",
      body: { workspace: "test.com", workspaceRoot: "/srv/webalive/sites/test.com/user" },
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [_, options] = mockFetch.mock.calls[0]

    expect(options.headers).not.toHaveProperty("X-Internal-Tools-Secret")

    // If this test FAILS (throws error), missing env secret crashes MCP tools
  })

  /**
   * THE EMPTY SECRET BUG TEST
   * Empty string secret should NOT be sent as header
   */
  it("should not send empty secret header (THE EMPTY SECRET BUG)", async () => {
    process.env.INTERNAL_TOOLS_SECRET = ""

    await callBridgeApi({
      endpoint: "/api/internal-tools/read-logs",
      body: { workspace: "test.com", workspaceRoot: "/srv/webalive/sites/test.com/user" },
    })

    const [_, options] = mockFetch.mock.calls[0]

    expect(options.headers).not.toHaveProperty("X-Internal-Tools-Secret")

    // If this test FAILS, we send empty header (might bypass validation)
  })

  /**
   * THE ENDPOINT DETECTION BUG TEST
   * Various internal-tools paths should all trigger secret header
   */
  it("should detect all internal-tools paths (THE DETECTION BUG)", async () => {
    const internalToolsPaths = [
      "/api/internal-tools/read-logs",
      "/api/internal-tools/some-other-tool",
      "/api/internal-tools/nested/path",
      "/api/internal-tools/",
    ]

    for (const endpoint of internalToolsPaths) {
      mockFetch.mockClear()
      await callBridgeApi({
        endpoint,
        body: { test: "data" },
      })

      const [_, options] = mockFetch.mock.calls[0]

      expect(options.headers).toHaveProperty("X-Internal-Tools-Secret")
      expect(options.headers["X-Internal-Tools-Secret"]).toBe("test-secret-xyz")

      // If this test FAILS for any path, that internal tool won't work
    }
  })

  /**
   * THE FALSE POSITIVE DETECTION BUG TEST
   * Paths containing "internal-tools" but not at the right position
   * should NOT trigger secret header
   */
  it("should not false-positive on internal-tools substring (THE FALSE POSITIVE BUG)", async () => {
    const nonInternalToolsPaths = [
      "/api/some-internal-tools-copy",
      "/api/data/internal-tools",
      "/internal-tools/api/endpoint",
      "/api/internal-toolsX",
    ]

    for (const endpoint of nonInternalToolsPaths) {
      mockFetch.mockClear()
      await callBridgeApi({
        endpoint,
        body: { test: "data" },
      })

      const [_, options] = mockFetch.mock.calls[0]

      expect(options.headers).not.toHaveProperty("X-Internal-Tools-Secret")

      // If this test FAILS, we leak secret to wrong endpoints
    }
  })

  /**
   * THE HEADER COMBINATION BUG TEST
   * Both session cookie AND secret header should be present for internal-tools
   */
  it("should include both session and secret for internal-tools (THE COMBINATION BUG)", async () => {
    await callBridgeApi({
      endpoint: "/api/internal-tools/read-logs",
      body: { workspace: "test.com", workspaceRoot: "/srv/webalive/sites/test.com/user" },
    })

    const [_, options] = mockFetch.mock.calls[0]

    expect(options.headers).toHaveProperty("Cookie")
    expect(options.headers).toHaveProperty("X-Internal-Tools-Secret")
    expect(options.headers.Cookie).toBe("session=test-session-abc")
    expect(options.headers["X-Internal-Tools-Secret"]).toBe("test-secret-xyz")

    // If this test FAILS, we're missing one of the required headers
  })
})

// Note: Workspace path validation is tested separately in workspace-validator.test.ts
// We mock it here to focus on testing the secret header logic
