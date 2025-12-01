/**
 * Protection Verification Tests
 *
 * These tests verify that BOTH layers of protection work:
 * - Layer 1: Browser request monitoring
 * - Layer 2: Server-side blocking
 *
 * NOTE: Some tests require a local test environment with PLAYWRIGHT_TEST=true
 * and BRIDGE_ENV=local set on the server. These are skipped on remote environments
 * (staging and production).
 */

import { SECURITY } from "@webalive/shared"
import { login } from "./helpers"
import { handlers } from "./lib/handlers"
import { isLocalTestServer } from "./lib/test-env"
import { expect, test } from "./fixtures"

test.describe("Protection System Verification", () => {
  test("Layer 1: Catches unmocked calls at browser level", async ({ page, tenant }) => {
    await login(page, tenant)

    // Register our own request monitor to verify Layer 1 works
    const apiCalls: string[] = []
    page.on("request", req => {
      if (req.url().includes("/api/claude")) {
        apiCalls.push(req.url())
      }
    })

    // Register handler - Layer 1 should allow this through
    await page.route("**/api/claude/stream", handlers.text("Protected!"))

    await page.goto("/chat")

    // Wait for workspace to be fully initialized (mounted + workspace set)
    await expect(page.locator('[data-testid="workspace-ready"]')).toBeAttached({
      timeout: 15000,
    })

    const messageInput = page.locator('[data-testid="message-input"]')
    await expect(messageInput).toBeVisible({ timeout: 10000 })

    const sendButton = page.locator('[data-testid="send-button"]')

    await messageInput.fill("Test message")
    await expect(sendButton).toBeEnabled({ timeout: 10000 })
    await sendButton.click()

    // Wait for response (use .first() to avoid strict mode violations)
    await expect(page.getByText("Protected!").first()).toBeVisible({ timeout: 10000 })

    // Verify the API call was made (but mocked)
    expect(apiCalls.length).toBeGreaterThan(0)
    expect(apiCalls[0]).toContain("/api/claude/stream")
  })

  // This test requires PLAYWRIGHT_TEST=true on the server (local test env only)
  // Purpose: Verify that real Claude API calls are blocked by server-side protection
  test("Layer 2: Server blocks calls when PLAYWRIGHT_TEST=true", async ({ page, tenant }) => {
    test.skip(!isLocalTestServer, "Requires local test server with PLAYWRIGHT_TEST=true")

    // Just need auth - don't need the full chat UI
    await login(page, tenant)

    // Make a direct fetch to the API (bypass Playwright routing)
    // This tests that the SERVER blocks real API calls, regardless of UI state
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/claude/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "This should be blocked",
          conversationId: "test",
        }),
      })
      return {
        status: res.status,
        body: await res.json(),
      }
    })

    // Verify Layer 2 blocked it
    expect(response.status).toBe(403)
    expect(response.body.error).toBe("TEST_MODE_BLOCK")
    expect(response.body.message).toContain("test mode")
  })

  // This test uses test credentials from SECURITY.LOCAL_TEST that only work with BRIDGE_ENV=local
  // Purpose: Verify that non-Claude APIs (login) work and aren't blocked by PLAYWRIGHT_TEST=true
  test("Allows non-Claude API calls (login, verify, etc)", async ({ page }) => {
    test.skip(!isLocalTestServer, "Requires local test server with BRIDGE_ENV=local credentials")
    // Login should work - it's NOT a protected endpoint
    await page.goto("/")
    await page.getByTestId("email-input").fill(SECURITY.LOCAL_TEST.EMAIL)
    await page.getByTestId("password-input").fill(SECURITY.LOCAL_TEST.PASSWORD)

    // Wait for login response
    const loginResponsePromise = page.waitForResponse(
      response => response.url().includes("/api/login") && response.request().method() === "POST",
    )
    await page.getByTestId("login-button").click()
    const loginResponse = await loginResponsePromise

    // Verify login succeeded - this is the main assertion
    // If PLAYWRIGHT_TEST was blocking non-Claude APIs, this would fail
    expect(loginResponse.ok()).toBe(true)

    // Verify response contains auth data (proves the API returned properly)
    const data = await loginResponse.json()
    expect(data).toHaveProperty("ok", true)
  })
})
