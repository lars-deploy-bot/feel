/**
 * Chat E2E Tests - Worker Isolated Version
 *
 * Each worker gets dedicated tenant, no shared state.
 */

import { TEST_MESSAGES } from "./fixtures/test-data"
import { login } from "./helpers"
import { expectWorkspaceReady } from "./helpers/assertions"
import { handlers } from "./lib/handlers"
import { ChatPage } from "./pages/ChatPage"
import { expect, test } from "./fixtures"

test("has chat interface", async ({ page, tenant }) => {
  await login(page, tenant)
  const chat = new ChatPage(page)
  await chat.goto()
  await expectWorkspaceReady(page)

  await expect(chat.messageInput).toBeVisible()
  await expect(chat.sendButton).toBeVisible()
})

test("can send a message and receive response", async ({ page, tenant }) => {
  await page.route("**/api/claude/stream", handlers.text("Hi there! How can I help you today?"))
  await login(page, tenant)

  const chat = new ChatPage(page)
  await chat.goto()
  await chat.waitForReady()

  await chat.sendMessage(TEST_MESSAGES.simple)
  await chat.expectMessage(TEST_MESSAGES.simple)
  await chat.expectMessage(/Hi there.*help you today/)
})

test("send button disabled when no workspace", async ({ page }) => {
  // Use unauthenticated page - no workspace setup
  await page.goto("/chat")
  const chat = new ChatPage(page)
  await chat.expectSendButtonDisabled()
})

test("can send multiple messages", async ({ page, tenant }) => {
  await page.route("**/api/claude/stream", handlers.text("Response received"))
  await login(page, tenant)

  const chat = new ChatPage(page)
  await chat.goto()
  await chat.waitForReady()

  // First message
  await chat.sendMessage(TEST_MESSAGES.simple)
  await chat.expectMessage(TEST_MESSAGES.simple)
  await chat.expectMessage("Response received")

  // Verify ready for next message
  await chat.messageInput.fill(TEST_MESSAGES.question)
  await chat.expectSendButtonEnabled()

  // Second message
  await chat.sendButton.click()
  await chat.expectMessage(TEST_MESSAGES.question)
  await chat.expectMessage("Response received")
})
