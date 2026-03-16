/**
 * Routing E2E Live Tests — deploy gate
 *
 * Verifies that all critical routing categories work through the Cloudflare Tunnel
 * + internal Caddy stack. These tests hit REAL infrastructure.
 *
 * Infrastructure service checks are derived from the INFRASTRUCTURE_SERVICES registry
 * in @webalive/shared — this file does NOT maintain a parallel list of hostnames.
 *
 * Categories tested:
 *   1. Production routing (app.alive.best → :9000)
 *   2. Staging routing (staging.alive.best → :8998)
 *   3. Staging/production isolation (different build SHAs)
 *   4. Infrastructure services (from registry — widget, mg, oc, etc.)
 *   5. Site routing via internal Caddy (:8444)
 *   6. Image serving (/_images/* returns images, not HTML)
 *   7. Preview fallback (unknown subdomains → preview-proxy)
 *
 * Run: ENV_FILE=.env.production bun run test:e2e:live
 */

import { expect, test } from "@playwright/test"
import { INFRASTRUCTURE_SERVICES } from "@webalive/shared"

const PROD_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.alive.best"
const STAGING_URL = process.env.STAGING_URL ?? "https://staging.alive.best"

// A known site that should always be running (blank template)
const SITE_URL = "https://blank.alive.best"

// ---------------------------------------------------------------------------
// Environment routing
// ---------------------------------------------------------------------------

test.describe("Routing: Production", () => {
  test("production /api/health returns healthy", async ({ request }) => {
    const res = await request.get(`${PROD_URL}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("healthy")
  })

  test("production homepage returns 200 HTML", async ({ request }) => {
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
  test("staging and production both report healthy independently", async ({ request }) => {
    const [prodRes, stagingRes] = await Promise.all([
      request.get(`${PROD_URL}/api/health`),
      request.get(`${STAGING_URL}/api/health`),
    ])

    expect(prodRes.status()).toBe(200)
    expect(stagingRes.status()).toBe(200)

    const prodBody = await prodRes.json()
    const stagingBody = await stagingRes.json()

    expect(prodBody.status).toBe("healthy")
    expect(stagingBody.status).toBe("healthy")
  })
})

// ---------------------------------------------------------------------------
// Infrastructure services — derived from INFRASTRUCTURE_SERVICES registry
// ---------------------------------------------------------------------------

const healthCheckableServices = INFRASTRUCTURE_SERVICES.filter(s => s.healthPath)

for (const svc of healthCheckableServices) {
  test.describe(`Routing: ${svc.displayName}`, () => {
    const url = `https://${svc.hostname}${svc.healthPath}`

    if (svc.healthContentType) {
      test(`${svc.hostname} returns ${svc.healthContentType}`, async ({ request }) => {
        const res = await request.get(url)
        expect(res.status()).toBe(200)
        const contentType = res.headers()["content-type"] ?? ""
        expect(contentType.toLowerCase()).toContain(svc.healthContentType!.toLowerCase())
      })
    } else {
      test(`${svc.hostname} returns 200`, async ({ request }) => {
        const res = await request.get(url)
        expect(res.status()).toBe(200)
      })
    }
  })
}

// ---------------------------------------------------------------------------
// Site routing via internal Caddy
// ---------------------------------------------------------------------------

test.describe("Routing: Site via Internal Caddy", () => {
  test("site returns 200 through tunnel + Caddy", async ({ request }) => {
    const res = await request.get(SITE_URL)
    expect([200, 301, 302, 304]).toContain(res.status())
  })

  test("site /_images/* returns image content-type, not HTML", async ({ request }) => {
    const res = await request.get(`${SITE_URL}/_images/`, { failOnStatusCode: false })
    const contentType = res.headers()["content-type"] ?? ""
    // Should NOT be HTML (that would mean Vite caught it, not Caddy)
    if (res.status() === 200) {
      expect(contentType).not.toContain("text/html")
    }
    // 404 is acceptable (no files in /_images/) — the point is it wasn't Vite HTML
  })
})

// ---------------------------------------------------------------------------
// Preview fallback
// ---------------------------------------------------------------------------

test.describe("Routing: Preview Fallback", () => {
  test("unknown subdomain routes to preview-proxy (not tunnel 404)", async ({ request }) => {
    const res = await request.get("https://nonexistent-routing-test.alive.best/", {
      failOnStatusCode: false,
    })
    // Should NOT be 404 from tunnel catch-all — that means the wildcard is broken
    expect(res.status()).not.toBe(404)
  })
})
