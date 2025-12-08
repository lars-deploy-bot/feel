/**
 * Chat E2E Tests - Fast Version
 *
 * Uses authenticatedPage fixture + gotoFast for speed.
 * No login flow, state pre-injected before navigation.
 */

import { TEST_MESSAGES } from "./fixtures/test-data"
import { handlers } from "./lib/handlers"
import { ChatPage } from "./pages/ChatPage"
import { expect, test } from "./fixtures"

test("has chat interface", async ({ authenticatedPage, workerTenant }) => {
  const chat = new ChatPage(authenticatedPage)
  await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

  await expect(chat.messageInput).toBeVisible({ timeout: 2000 })
  await expect(chat.sendButton).toBeVisible({ timeout: 1000 })
})

test("can send a message and receive response", async ({ authenticatedPage, workerTenant }) => {
  await authenticatedPage.route("**/api/claude/stream", handlers.text("Hi there! How can I help you today?"))

  const chat = new ChatPage(authenticatedPage)
  await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

  await chat.sendMessage(TEST_MESSAGES.simple)
  await chat.expectMessage(TEST_MESSAGES.simple)
  await chat.expectMessage(/Hi there.*help you today/)
})

test("send button disabled when no workspace", async ({ page }) => {
  // Use unauthenticated page - no workspace setup
  await page.goto("/chat", { waitUntil: "domcontentloaded" })
  const chat = new ChatPage(page)
  await chat.expectSendButtonDisabled()
})

test("can send multiple messages", async ({ authenticatedPage, workerTenant }) => {
  await authenticatedPage.route("**/api/claude/stream", handlers.text("Response received"))

  const chat = new ChatPage(authenticatedPage)
  await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

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
