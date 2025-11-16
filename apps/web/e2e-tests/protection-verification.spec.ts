/**
 * Protection Verification Tests
 *
 * These tests verify that BOTH layers of protection work:
 * - Layer 1: Browser request monitoring
 * - Layer 2: Server-side blocking
 */
import { test as baseTest, expect } from "@playwright/test"
import { login } from "./helpers"
import { handlers } from "./lib/handlers"

// Use base Playwright test WITHOUT our protection fixture for these tests
const test = baseTest

test.describe("Protection System Verification", () => {
  // TODO: Fix workspace auto-selection in test mode
  test.skip("Layer 1: Catches unmocked calls at browser level", async ({ page }) => {
    await login(page)

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
    const messageInput = page.locator('[data-testid="message-input"]')
    const sendButton = page.locator('[data-testid="send-button"]')

    await messageInput.fill("Test message")
    await expect(sendButton).toBeEnabled({ timeout: 2000 })
    await sendButton.click()

    // Wait for response
    await expect(page.getByText("Protected!")).toBeVisible({ timeout: 5000 })

    // Verify the API call was made (but mocked)
    expect(apiCalls.length).toBeGreaterThan(0)
    expect(apiCalls[0]).toContain("/api/claude/stream")
  })

  test("Layer 2: Server blocks calls when PLAYWRIGHT_TEST=true", async ({ page }) => {
    await login(page)
    await page.goto("/chat")

    // Make a direct fetch to the API (bypass Playwright routing)
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

  test("Allows non-Claude API calls (login, verify, etc)", async ({ page }) => {
    // Login should work - it's NOT a protected endpoint
    await page.goto("/")
    await page.getByPlaceholder("you@example.com").fill("test@bridge.local")
    await page.getByPlaceholder("Enter your password").fill("test")
    await page.getByRole("button", { name: "Continue" }).click()

    // Should successfully login (not blocked)
    await expect(page).toHaveURL("/chat", { timeout: 5000 })
  })
})
