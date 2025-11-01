import { test, expect, mockClaudeStream } from './setup'
import { login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('has chat interface', async ({ page }) => {
  await page.goto('/chat')

  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
  await expect(page.locator('[data-testid="new-chat-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="send-button"]')).toBeVisible()
})

test('can send a message and receive response', async ({ page }) => {
  await page.goto('/chat')

  await mockClaudeStream(page, {
    message: 'Hi there! How can I help you today?'
  })

  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill('Hello')
  await sendButton.click()

  await expect(page.getByText('Hello')).toBeVisible()
  await expect(page.getByText(/Hi there.*help you today/)).toBeVisible({
    timeout: 5000
  })
})
