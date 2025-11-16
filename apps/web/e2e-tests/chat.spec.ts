import { login } from "./helpers"
import { handlers } from "./lib/handlers"
import { expect, test } from "./setup"

test.beforeEach(async ({ page }) => {
  await login(page)
})

test("has chat interface", async ({ page }) => {
  await page.goto("/chat")

  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
  await expect(page.locator('[data-testid="send-button"]')).toBeVisible()
})

// TODO: Fix workspace auto-selection in test mode
// Workspace switcher requires org selection which requires async API calls
// The 3-second wait isn't sufficient - need proper workspace ready state
test.skip("can send a message and receive response", async ({ page }) => {
  // Register mock BEFORE navigating to page
  await page.route("**/api/claude/stream", handlers.text("Hi there! How can I help you today?"))

  await page.goto("/chat")

  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill("Hello")
  await expect(sendButton).toBeEnabled({ timeout: 2000 })
  await sendButton.click()

  await expect(page.getByText("Hello")).toBeVisible()
  await expect(page.getByText(/Hi there.*help you today/)).toBeVisible({
    timeout: 5000,
  })
})
