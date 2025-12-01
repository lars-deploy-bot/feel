import { login } from "./helpers"
import { handlers } from "./lib/handlers"
import { expect, test } from "./fixtures"

test.beforeEach(async ({ page, tenant }) => {
  await login(page, tenant)
})

test("has chat interface", async ({ page }) => {
  await page.goto("/chat")

  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
  await expect(page.locator('[data-testid="send-button"]')).toBeVisible()
})

test("can send a message and receive response", async ({ page }) => {
  // Register mock BEFORE navigating to page
  await page.route("**/api/claude/stream", handlers.text("Hi there! How can I help you today?"))

  await page.goto("/chat")

  // Wait for workspace to be fully initialized (mounted + workspace set)
  await expect(page.locator('[data-testid="workspace-ready"]')).toBeVisible({
    timeout: 5000,
  })

  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill("Hello")
  await expect(sendButton).toBeEnabled({ timeout: 2000 })
  await sendButton.click()

  // Use .first() to avoid strict mode violations (message appears in sidebar + chat)
  await expect(page.getByText("Hello").first()).toBeVisible()
  await expect(page.getByText(/Hi there.*help you today/).first()).toBeVisible({
    timeout: 5000,
  })
})
