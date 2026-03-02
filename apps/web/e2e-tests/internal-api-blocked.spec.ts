/**
 * Internal API External Access Blocking (#310)
 *
 * Verifies that /api/internal/* and /api/internal-tools/* endpoints are
 * unreachable from the public internet. These endpoints are server-to-server
 * only (called via localhost by worker and MCP tools).
 *
 * Protection layers:
 * - Layer 1: Caddy responds 404 before traffic reaches the app
 * - Layer 2: Route handlers use timing-safe secret comparison
 *
 * These tests hit the REAL staging server via its public URL.
 * No mocks, no interception — pure network requests to verify the block.
 */

import { expect, test } from "./fixtures"

const INTERNAL_ENDPOINTS = [
  ["/api/internal/automation/trigger", "automation trigger"],
  ["/api/internal-tools/read-logs", "read-logs"],
  ["/api/internal-tools/switch-serve-mode", "switch-serve-mode"],
] as const

test.describe("Internal API External Access Blocked (#310)", () => {
  for (const [path, label] of INTERNAL_ENDPOINTS) {
    test(`GET ${label} returns 404`, async ({ baseURL }) => {
      const res = await fetch(`${baseURL}${path}`, {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
      })

      expect(res.status).toBe(404)
      // Must NOT be a JSON error response (would mean the route handler processed it)
      const contentType = res.headers.get("content-type") ?? ""
      expect(contentType).not.toContain("application/json")
    })

    test(`POST ${label} returns 404`, async ({ baseURL }) => {
      const res = await fetch(`${baseURL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
        signal: AbortSignal.timeout(10_000),
      })

      expect(res.status).toBe(404)
      const contentType = res.headers.get("content-type") ?? ""
      expect(contentType).not.toContain("application/json")
    })
  }

  test("fake secret header does not bypass block", async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/api/internal/automation/trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": "fake-secret-should-not-matter",
      },
      body: JSON.stringify({ jobId: "nonexistent" }),
      signal: AbortSignal.timeout(10_000),
    })

    // Must be 404, not 401 (401 would mean the request reached the route handler)
    expect(res.status).toBe(404)
  })

  test("fake internal-tools secret does not bypass block", async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/api/internal-tools/read-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-tools-secret": "fake-secret-should-not-matter",
      },
      body: JSON.stringify({ workspace: "test.example.com", workspaceRoot: "/tmp/fake" }),
      signal: AbortSignal.timeout(10_000),
    })

    expect(res.status).toBe(404)
  })

  test("non-internal API endpoints are not blocked", async ({ baseURL }) => {
    const res = await fetch(`${baseURL}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    })

    // If middleware were over-blocking, this would be 404 Not Found.
    // We intentionally do not require 200 here because upstream infra can return 5xx.
    expect(res.status).not.toBe(404)
  })
})
