/**
 * Chat E2E Tests - Improved Version
 *
 * Demonstrates the improvements from Phase 1:
 * - Page Object Model (ChatPage)
 * - Shared test data constants
 * - Custom assertions
 * - Reduced timeouts
 *
 * Compare with chat.spec.ts to see the difference!
 */
import { login } from "./helpers"
import { expectWorkspaceReady } from "./helpers/assertions"
import { handlers } from "./lib/handlers"
import { ChatPage } from "./pages/ChatPage"
import { expect, test } from "./setup"
import { TEST_MESSAGES } from "./fixtures/test-data"

test.beforeEach(async ({ page }) => {
  await login(page)
})

test("has chat interface", async ({ page }) => {
  const chat = new ChatPage(page)
  await chat.goto()
  await expectWorkspaceReady(page)

  await expect(chat.messageInput).toBeVisible()
  await expect(chat.sendButton).toBeVisible()
})

test("can send a message and receive response", async ({ page }) => {
  // Register mock BEFORE navigating to page
  await page.route("**/api/claude/stream", handlers.text("Hi there! How can I help you today?"))

  const chat = new ChatPage(page)
  await chat.goto()
  await chat.waitForReady()

  // Much cleaner than the original!
  await chat.sendMessage(TEST_MESSAGES.simple)
  await chat.expectMessage(TEST_MESSAGES.simple)
  await chat.expectMessage(/Hi there.*help you today/)
})

test("send button disabled when no workspace", async ({ page }) => {
  // Navigate directly without workspace setup
  await page.goto("/chat")

  const chat = new ChatPage(page)

  // Should be disabled until workspace is ready
  await chat.expectSendButtonDisabled()
})

test("can send multiple messages", async ({ page }) => {
  // Use the streaming text handler for proper SSE format
  await page.route("**/api/claude/stream", handlers.text("Response received"))

  const chat = new ChatPage(page)
  await chat.goto()
  await chat.waitForReady()

  // Send first message
  await chat.sendMessage(TEST_MESSAGES.simple)
  await chat.expectMessage(TEST_MESSAGES.simple)
  await chat.expectMessage("Response received")

  // Verify system is ready for next message by filling input and checking button enables
  // (Tests that busy state was properly reset after first response)
  await chat.messageInput.fill(TEST_MESSAGES.question)
  await chat.expectSendButtonEnabled()

  // Send second message
  await chat.sendButton.click()
  await chat.expectMessage(TEST_MESSAGES.question)
  await chat.expectMessage("Response received")
})
