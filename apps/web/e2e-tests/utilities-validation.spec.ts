/**
 * Utilities Validation Test
 *
 * Purpose: Test E2E utilities work correctly
 * Uses fast patterns (authenticatedPage + gotoFast) for speed
 */

import { SECURITY, TEST_CONFIG } from "@webalive/shared"
import { TEST_MESSAGES, TEST_SELECTORS, TEST_TIMEOUTS, TEST_USER } from "./fixtures/test-data"
import { expectChatMessage, expectSendButtonEnabled, gotoChatFast } from "./helpers/assertions"
import { handlers } from "./lib/handlers"
import { ChatPage } from "./pages/ChatPage"
import { expect, test } from "./fixtures"

test.describe("E2E Utilities Validation", () => {
  test("test-data constants are accessible and have correct types", async () => {
    // Validate TEST_USER - values come from SECURITY.LOCAL_TEST and TEST_CONFIG
    expect(TEST_USER.email).toBe(SECURITY.LOCAL_TEST.EMAIL)
    expect(TEST_USER.password).toBe(SECURITY.LOCAL_TEST.PASSWORD)
    expect(TEST_USER.workspace).toBe(`test.${TEST_CONFIG.EMAIL_DOMAIN}`)

    // Validate TEST_MESSAGES
    expect(TEST_MESSAGES.simple).toBe("Hello")

    // Validate TEST_TIMEOUTS - updated values for parallel execution
    expect(TEST_TIMEOUTS.fast).toBe(1000)
    expect(TEST_TIMEOUTS.medium).toBe(3000)
    expect(TEST_TIMEOUTS.slow).toBe(10_000) // Updated for parallel load
    expect(TEST_TIMEOUTS.max).toBe(15_000)

    // Validate TEST_SELECTORS
    expect(TEST_SELECTORS.workspaceReady).toBe('[data-testid="workspace-ready"]')
    expect(TEST_SELECTORS.messageInput).toBe('[data-testid="message-input"]')
    expect(TEST_SELECTORS.sendButton).toBe('[data-testid="send-button"]')
  })

  // Tests using fast patterns (authenticatedPage + gotoFast)
  test.describe("Tests requiring page interaction", () => {
    test("selectors match actual DOM elements", async ({ authenticatedPage, workerTenant }) => {
      await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)

      // Verify all selectors point to real elements
      await expect(authenticatedPage.locator(TEST_SELECTORS.workspaceReady)).toBeVisible({ timeout: 2000 })
      await expect(authenticatedPage.locator(TEST_SELECTORS.messageInput)).toBeVisible({ timeout: 1000 })
      await expect(authenticatedPage.locator(TEST_SELECTORS.sendButton)).toBeVisible({ timeout: 1000 })
    })

    test("expectSendButtonEnabled helper works correctly", async ({ authenticatedPage, workerTenant }) => {
      await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)

      // Fill message input (button is disabled when empty)
      await authenticatedPage.locator(TEST_SELECTORS.messageInput).fill(TEST_MESSAGES.simple)

      // Should not throw - send button should be enabled
      await expectSendButtonEnabled(authenticatedPage)

      // Verify button is actually enabled
      const isEnabled = await authenticatedPage.locator(TEST_SELECTORS.sendButton).isEnabled()
      expect(isEnabled).toBe(true)
    })

    test("expectChatMessage helper works correctly", async ({ authenticatedPage, workerTenant }) => {
      await authenticatedPage.route("**/api/claude/stream", handlers.text("Test response"))
      await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)

      await authenticatedPage.locator(TEST_SELECTORS.messageInput).fill(TEST_MESSAGES.simple)
      await expectSendButtonEnabled(authenticatedPage)
      await authenticatedPage.locator(TEST_SELECTORS.sendButton).click()

      // Should not throw - message should appear
      await expectChatMessage(authenticatedPage, TEST_MESSAGES.simple)
      await expectChatMessage(authenticatedPage, "Test response")
    })

    test("ChatPage.gotoFast method works", async ({ authenticatedPage, workerTenant }) => {
      const chat = new ChatPage(authenticatedPage)
      await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

      expect(authenticatedPage.url()).toContain("/chat")
      await expect(chat.messageInput).toBeVisible({ timeout: 2000 })
      await expect(chat.sendButton).toBeVisible({ timeout: 1000 })
    })

    test("ChatPage.sendMessage method works", async ({ authenticatedPage, workerTenant }) => {
      await authenticatedPage.route("**/api/claude/stream", handlers.text("Response from API"))

      const chat = new ChatPage(authenticatedPage)
      await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

      await chat.sendMessage(TEST_MESSAGES.simple)
      await expect(authenticatedPage.getByText(TEST_MESSAGES.simple).first()).toBeVisible({ timeout: 3000 })
    })

    test("ChatPage.expectMessage method works", async ({ authenticatedPage, workerTenant }) => {
      await authenticatedPage.route("**/api/claude/stream", handlers.text("Expected message"))

      const chat = new ChatPage(authenticatedPage)
      await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

      await chat.sendMessage(TEST_MESSAGES.simple)
      await chat.expectMessage(TEST_MESSAGES.simple)
      await chat.expectMessage("Expected message")
    })

    test("ChatPage button state methods work", async ({ authenticatedPage, workerTenant }) => {
      const chat = new ChatPage(authenticatedPage)
      await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

      // Fill message input then check button state
      await chat.messageInput.fill(TEST_MESSAGES.simple)
      await chat.expectSendButtonEnabled()

      // Visibility check
      const sendVisible = await chat.isSendButtonVisible()
      expect(sendVisible).toBe(true)

      const stopVisible = await chat.isStopButtonVisible()
      expect(stopVisible).toBe(false)
    })

    test("send button disabled when no workspace", async ({ page }) => {
      // Use unauthenticated page - no workspace setup
      await page.goto("/chat", { waitUntil: "domcontentloaded" })
      const chat = new ChatPage(page)
      await chat.expectSendButtonDisabled()
    })

    test("integration: full flow using utilities", async ({ authenticatedPage, workerTenant }) => {
      await authenticatedPage.route("**/api/claude/stream", handlers.text("Integration response"))

      const chat = new ChatPage(authenticatedPage)
      await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

      await chat.sendMessage(TEST_MESSAGES.question)
      await expectChatMessage(authenticatedPage, TEST_MESSAGES.question)
      await expectChatMessage(authenticatedPage, "Integration response")

      // Verify send button is re-enabled after response
      await chat.messageInput.fill(TEST_MESSAGES.simple)
      await expectSendButtonEnabled(authenticatedPage)
    })
  })
})
