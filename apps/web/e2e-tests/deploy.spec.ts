/**
 * E2E Tests for Website Deployment with Authentication
 *
 * Tests the full deployment flow with required authentication
 */

import { execSync } from "node:child_process"
import { existsSync, rmSync } from "node:fs"
import jwt from "jsonwebtoken"
import { expect, test } from "./fixtures"

const TEST_SLUG = "test-e2e"
const TEST_DOMAIN = `${TEST_SLUG}.alive.best`
const SITE_PATH = `/srv/webalive/sites/${TEST_DOMAIN}`

test.describe("Website Deployment with Authentication", () => {

  // Clean up before each test
  test.beforeEach(async () => {
    console.log(`[E2E Setup] Cleaning up test site: ${TEST_DOMAIN}`)

    // Remove site directory if it exists
    if (existsSync(SITE_PATH)) {
      console.log(`[E2E Setup] Removing existing directory: ${SITE_PATH}`)
      try {
        rmSync(SITE_PATH, { recursive: true, force: true })
      } catch (error) {
        console.error("[E2E Setup] Failed to remove directory:", error)
      }
    }

    // Stop systemd service if running
    try {
      const serviceSlug = TEST_DOMAIN.replace(/\./g, "-")
      execSync(`systemctl stop site@${serviceSlug}.service 2>/dev/null || true`, { stdio: "ignore" })
      console.log(`[E2E Setup] Stopped service: site@${serviceSlug}.service`)
    } catch (_error) {
      // Service doesn't exist, that's fine
    }

    console.log("[E2E Setup] Cleanup complete")
  })

  // Clean up after test completes
  test.afterEach(async () => {
    console.log(`[E2E Cleanup] Removing test site: ${TEST_DOMAIN}`)

    // Remove site directory
    if (existsSync(SITE_PATH)) {
      try {
        rmSync(SITE_PATH, { recursive: true, force: true })
        console.log(`[E2E Cleanup] Removed directory: ${SITE_PATH}`)
      } catch (error) {
        console.error("[E2E Cleanup] Failed to remove directory:", error)
      }
    }

    // Stop and disable systemd service
    try {
      const serviceSlug = TEST_DOMAIN.replace(/\./g, "-")
      execSync(`systemctl stop site@${serviceSlug}.service 2>/dev/null || true`, { stdio: "ignore" })
      execSync(`systemctl disable site@${serviceSlug}.service 2>/dev/null || true`, { stdio: "ignore" })
      console.log("[E2E Cleanup] Stopped and disabled service")
    } catch (_error) {
      // Best effort cleanup
    }

    console.log("[E2E Cleanup] Complete")
  })

  test.skip("deploy page shows authentication requirement", async ({ page }) => {
    // TODO: Update when frontend implements auth-required flow
    // Expected flow:
    // 1. Navigate to /deploy
    // 2. Should redirect to /login if not authenticated
    // 3. After login, should show org selector
    // 4. After selecting org, should show deploy form

    console.log("[Test] Step 1: Navigate to /deploy without authentication")
    await page.goto("/deploy")

    // Should redirect to login or show auth requirement
    // await expect(page).toHaveURL(/\/login/)
    // OR
    // await expect(page.getByText("Please log in")).toBeVisible()
  })

  test("deployment API rejects unauthenticated requests", async ({ request }) => {
    console.log("[Test] Testing API without authentication")

    const response = await request.post("/api/deploy-subdomain", {
      data: {
        slug: TEST_SLUG,
        orgId: "org_fake123", // Fake org ID - doesn't matter for unauthenticated test
        siteIdeas: "",
        selectedTemplate: "landing",
      },
    })

    expect(response.status()).toBe(401)
    const result = await response.json()
    expect(result.ok).toBe(false)
    console.log("[Test] ✓ Unauthenticated request properly rejected")
  })

  test.skip("deployment API rejects requests without orgId", async ({ request }) => {
    // TODO: Fix - Playwright request context doesn't share cookies properly
    // Need to either use page.request or find another way to send auth cookie
    console.log("[Test] Testing API without orgId")

    // Create mock user JWT for authentication (no DB needed)
    const mockUser = {
      userId: "test-user-id-123",
      email: "test@bridge-e2e.internal",
      orgId: "org_test123",
      orgName: "Test Org",
    }

    // Create JWT token directly
    const JWT_SECRET = process.env.JWT_SECRET || "INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION"
    const payload = {
      sub: mockUser.userId,
      userId: mockUser.userId,
      email: mockUser.email,
      name: mockUser.orgName,
      workspaces: [],
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" })

    const response = await request.post("/api/deploy-subdomain", {
      data: {
        slug: TEST_SLUG,
        // Missing orgId
        siteIdeas: "",
        selectedTemplate: "landing",
      },
      headers: {
        cookie: `auth_session=${token}`,
      },
    })

    expect(response.status()).toBe(400)
    const result = await response.json()
    expect(result.ok).toBe(false)
    expect(result.message).toContain("Organization ID")
    console.log("[Test] ✓ Request without orgId properly rejected")
  })

  test.skip("can deploy with valid authentication and orgId - full flow", async ({ page, context }) => {
    // Skip this test unless explicitly running full deployment tests
    // Requires proper authentication setup and takes ~60s
    test.setTimeout(70000)

    console.log("[Test] Full authenticated deployment flow")

    // TODO: Implement full E2E flow when frontend is updated:
    // 1. Login via UI
    // 2. Select organization
    // 3. Fill deployment form
    // 4. Submit and wait for completion
    // 5. Verify site is deployed

    // For now, test via API directly
    await context.addCookies([
      {
        name: "auth_session",
        value: "test-user",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ])

    const response = await page.request.post("/api/deploy-subdomain", {
      data: {
        slug: TEST_SLUG,
        orgId: testUser.orgId,
        siteIdeas: "E2E test deployment",
        selectedTemplate: "landing",
      },
    })

    if (!response.ok()) {
      const error = await response.json()
      console.error("[Test] Deployment failed:", error)
      throw new Error(`Deployment failed: ${error.message}`)
    }

    const result = await response.json()
    expect(result.ok).toBe(true)
    expect(result.domain).toBe(TEST_DOMAIN)
    expect(result.orgId).toBe(testUser.orgId)

    console.log("[Test] ✓ Deployment succeeded")

    // Verify site directory exists
    expect(existsSync(SITE_PATH)).toBe(true)
    console.log("[Test] ✓ Site directory created")

    // Verify systemd service is running
    try {
      const serviceSlug = TEST_DOMAIN.replace(/\./g, "-")
      const status = execSync(`systemctl is-active site@${serviceSlug}.service`, { encoding: "utf-8" }).trim()
      expect(status).toBe("active")
      console.log("[Test] ✓ Systemd service is active")
    } catch (_error) {
      throw new Error("Systemd service is not active")
    }
  })
})
