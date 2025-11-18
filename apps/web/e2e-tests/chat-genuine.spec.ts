/**
 * E2E Test - Chat API Request Validation
 *
 * Tests the actual bug: INVALID_REQUEST error when sending chat messages
 * Uses real API calls to verify the full request/response flow works.
 *
 * Run with: bun run test:e2e:genuine
 */
import { test, expect } from "@playwright/test"

// Real staging credentials
const STAGING_EMAIL = process.env.TEST_EMAIL || "eedenlars@gmail.com"
const STAGING_PASSWORD = process.env.TEST_PASSWORD || "supersecret"

async function loginStaging(page: any) {
  await page.goto("/")
  await page.getByPlaceholder("you@example.com").fill(STAGING_EMAIL)
  await page.getByPlaceholder("Enter your password").fill(STAGING_PASSWORD)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.waitForURL("/chat", { timeout: 10000 })
  await page.waitForTimeout(2000) // Wait for workspace init
}

test.describe("Chat API - Request Validation", () => {
  test("can send message without INVALID_REQUEST error", async ({ page }) => {
    await loginStaging(page)
    await page.goto("/chat")

    // Wait for chat interface to be ready
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible()

    // Type a simple message (same pattern as user's bug report)
    const messageInput = page.locator('[data-testid="message-input"]')
    await messageInput.fill("test message")

    // Capture network request/response
    let requestBody: any = null
    let responseStatus: number | null = null
    let responseBody: any = null

    page.on("request", req => {
      if (req.url().includes("/api/claude/stream")) {
        const postData = req.postData()
        if (postData) {
          requestBody = JSON.parse(postData)
          console.log("📤 Request body:", requestBody)
        }
      }
    })

    page.on("response", async res => {
      if (res.url().includes("/api/claude/stream")) {
        responseStatus = res.status()
        console.log("📥 Response status:", responseStatus)

        // For non-200 responses, try to read error body
        if (responseStatus !== 200) {
          try {
            responseBody = await res.json()
            console.log("❌ Error response:", responseBody)
          } catch {
            console.log("Could not parse error response")
          }
        }
      }
    })

    // Send the message
    const sendButton = page.locator('[data-testid="send-button"]')
    await sendButton.click()

    // Wait a moment for request to be sent
    await page.waitForTimeout(1000)

    // Verify request was made with correct structure
    expect(requestBody).toBeTruthy()
    expect(requestBody.message).toBe("test message")
    expect(requestBody.conversationId).toMatch(/^[0-9a-f-]{36}$/) // UUID format
    expect(requestBody.model).toBe("claude-haiku-4-5")
    console.log("✅ Request structure valid:", JSON.stringify(requestBody, null, 2))

    // Verify user message appears in UI (use first() to avoid strict mode violation)
    await expect(page.getByText("test message").first()).toBeVisible({ timeout: 5000 })
    console.log("✅ User message displayed")

    // Verify Claude starts thinking (no error occurred)
    await expect(page.getByText("thinking").first()).toBeVisible({ timeout: 5000 })
    console.log("✅ Claude response started (no INVALID_REQUEST error)")

    // If there was an error, responseBody would be set
    if (responseBody?.error === "INVALID_REQUEST") {
      console.error("❌ INVALID_REQUEST error occurred:", responseBody)
      throw new Error(`INVALID_REQUEST: ${responseBody.message}`)
    }

    console.log("✅ Test passed - chat works without INVALID_REQUEST error")
  })
})
