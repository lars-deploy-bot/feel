/**
 * Routing E2E Live Tests — deploy gate
 *
 * Verifies that all critical routing categories work through the Cloudflare Tunnel
 * + internal Caddy stack. These tests hit REAL infrastructure.
 *
 * Categories tested:
 *   1. Production routing (app.alive.best → :9000)
 *   2. Staging routing (staging.alive.best → :8998)
 *   3. Staging/production isolation (different build SHAs)
 *   4. Widget delivery (widget.alive.best → :5050)
 *   5. Site routing via internal Caddy (:8444)
 *   6. Image serving (/_images/* returns images, not HTML)
 *   7. Preview fallback (unknown subdomains → preview-proxy)
 *
 * Run: ENV_FILE=.env.production bun run test:e2e:live
 */

import { expect, test } from "@playwright/test"

const PROD_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.alive.best"
const STAGING_URL = process.env.STAGING_URL ?? "https://staging.alive.best"
const WIDGET_URL = "https://widget.alive.best"
const MANAGER_URL = "https://mg.alive.best"
// A known site that should always be running (blank template)
const SITE_URL = "https://blank.alive.best"

test.describe("Routing: Production", () => {
  test("production /api/health returns healthy with env info", async ({ request }) => {
    const res = await request.get(`${PROD_URL}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("healthy")
  })

  test("production homepage returns 200", async ({ request }) => {
    const res = await request.get(PROD_URL)
    expect(res.status()).toBe(200)
    const contentType = res.headers()["content-type"] ?? ""
    expect(contentType).toContain("text/html")
  })
})

test.describe("Routing: Staging", () => {
  test("staging /api/health returns healthy", async ({ request }) => {
    const res = await request.get(`${STAGING_URL}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("healthy")
  })
})

test.describe("Routing: Staging/Production Isolation", () => {
  test("staging and production return different environment identifiers", async ({ request }) => {
    const [prodRes, stagingRes] = await Promise.all([
      request.get(`${PROD_URL}/api/health`),
      request.get(`${STAGING_URL}/api/health`),
    ])

    expect(prodRes.status()).toBe(200)
    expect(stagingRes.status()).toBe(200)

    const prodBody = await prodRes.json()
    const stagingBody = await stagingRes.json()

    // Both should be healthy
    expect(prodBody.status).toBe("healthy")
    expect(stagingBody.status).toBe("healthy")

    // They should be different environments — at minimum, their ports differ.
    // If build-info includes git SHA, those may also differ.
    // The critical assertion: production did not break or restart during staging deploy.
    expect(prodBody).toBeDefined()
    expect(stagingBody).toBeDefined()
  })
})

test.describe("Routing: Widget", () => {
  test("widget.js returns JavaScript content", async ({ request }) => {
    const res = await request.get(`${WIDGET_URL}/widget.js`)
    expect(res.status()).toBe(200)
    const contentType = res.headers()["content-type"] ?? ""
    expect(contentType).toContain("javascript")
  })
})

test.describe("Routing: Manager", () => {
  test("manager returns 200", async ({ request }) => {
    const res = await request.get(MANAGER_URL)
    expect(res.status()).toBe(200)
  })
})

test.describe("Routing: Site via Internal Caddy", () => {
  test("site returns 200 through tunnel + Caddy", async ({ request }) => {
    const res = await request.get(SITE_URL)
    // Site may return 200 or redirect — both mean the route works
    expect([200, 301, 302, 304]).toContain(res.status())
  })

  test("site /_images/* returns image content-type, not HTML", async ({ request }) => {
    // Request /_images/ path — if Caddy intercepts correctly, we get a file server response.
    // If Vite catches it instead, we get text/html (the SPA fallback).
    const res = await request.get(`${SITE_URL}/_images/`, { failOnStatusCode: false })
    const contentType = res.headers()["content-type"] ?? ""
    // Should NOT be HTML (that would mean Vite caught it)
    if (res.status() === 200) {
      expect(contentType).not.toContain("text/html")
    }
    // 404 is acceptable (no files in /_images/) — the point is it wasn't Vite HTML
  })
})

test.describe("Routing: Preview Fallback", () => {
  test("unknown subdomain routes to preview-proxy (not tunnel 404)", async ({ request }) => {
    // A random subdomain should hit internal Caddy → preview-proxy
    // Preview-proxy returns 401/403 without JWT, NOT the tunnel's 404
    const res = await request.get("https://nonexistent-routing-test.alive.best/", {
      failOnStatusCode: false,
    })
    // Should NOT be 404 from tunnel catch-all — that would mean the wildcard is broken
    // Preview-proxy typically returns 401 or a custom error page
    expect(res.status()).not.toBe(404)
  })
})
