import { test, expect } from "./setup"
import { login } from "./helpers"
import { handlers } from "./lib/handlers"

test.beforeEach(async ({ page }) => {
  await login(page)
})

test("has chat interface", async ({ page }) => {
  await page.goto("/chat")

  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
  await expect(page.locator('[data-testid="new-chat-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="send-button"]')).toBeVisible()
})

test("can send a message and receive response", async ({ page }) => {
  // Register mock BEFORE navigating to page
  await page.route("**/api/claude/stream", handlers.text("Hi there! How can I help you today?"))

  await page.goto("/chat")

  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill("Hello")
  await sendButton.click()

  await expect(page.getByText("Hello")).toBeVisible()
  await expect(page.getByText(/Hi there.*help you today/)).toBeVisible({
    timeout: 5000,
  })
})
