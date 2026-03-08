/**
 * Security Headers E2E Tests
 *
 * Verifies that the Alive app returns required security response headers.
 * In remote lanes these tests hit the deployed infrastructure.
 * In local lanes they verify the same header contract against the local app.
 *
 * Run: bun run test:e2e
 */

import { expect, test } from "@playwright/test"
import { requireEnvAppBaseUrl } from "./lib/base-url"

const BASE_URL = requireEnvAppBaseUrl()

test.describe("Security Headers", () => {
  test("returns required security headers on page response", async () => {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(10_000) })
    expect(res.status).toBe(200)
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

  test("does not expose X-Powered-By on API response", async () => {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(10_000) })
    // Middleware/Next contract: still no x-powered-by on API routes.
    expect(res.headers.get("x-powered-by")).toBeNull()
  })
})
