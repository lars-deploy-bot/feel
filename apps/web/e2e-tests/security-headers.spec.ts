/**
 * Security Headers E2E Tests
 *
 * Verifies that the Alive app returns required security response headers.
 * Tests hit the real staging/production infrastructure (Caddy + Next.js).
 *
 * Run: ENV_FILE=.env.staging bun run test:e2e
 */

import { expect, test } from "@playwright/test"
import { requireEnvAppBaseUrl } from "./lib/base-url"

const BASE_URL = requireEnvAppBaseUrl()

test.describe("Security Headers", () => {
  test("returns required security headers on page response", async () => {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(10_000) })
    expect(res.status).toBe(200)

    // Caddy-level headers (from common_headers snippet)
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("x-frame-options")).toBe("DENY")
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin")
    expect(res.headers.get("strict-transport-security")).toContain("max-age=")
    expect(res.headers.get("permissions-policy")).toContain("camera=()")
  })

  test("does not expose X-Powered-By header", async () => {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(10_000) })
    expect(res.headers.get("x-powered-by")).toBeNull()
  })

  test("returns Content-Security-Policy-Report-Only on page response", async () => {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(10_000) })
    const csp = res.headers.get("content-security-policy-report-only")
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  test("returns security headers on API response", async () => {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(10_000) })

    // Caddy-level headers apply to all routes
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin")
    expect(res.headers.get("x-powered-by")).toBeNull()
  })
})
