/**
 * E2E Test - Tab Isolation
 *
 * Tests that messages sent in different tabs use different session keys.
 * This is the CRITICAL isolation guarantee - each tab = separate Claude conversation.
 *
 * Strategy:
 * - Intercept API requests and capture the tabId from each request
 * - Verify different tabs send different tabIds
 * - This proves isolation at the protocol level, not just UI visibility
 */

import { expect, type Request } from "@playwright/test"
import { test } from "./fixtures"
import { TEST_SELECTORS, TEST_TIMEOUTS } from "./fixtures/test-data"
import { TEST_API } from "./fixtures/test-constants"
import { handlers } from "./lib/handlers"
import { ChatPage } from "./pages/ChatPage"

/** Extract tabId from request body */
function getTabIdFromRequest(request: Request): string | null {
  const postData = request.postData()
  if (!postData) return null
  try {
    const body = JSON.parse(postData)
    return body.tabId || null
  } catch {
    return null
  }
}

test.describe("Tab Isolation", () => {
  test("different tabs send different tabIds to the API", async ({ authenticatedPage, workerTenant }) => {
    const page = authenticatedPage
    const chatPage = new ChatPage(page)

    // Track tabIds from requests
    const capturedTabIds: string[] = []

    // Mock API and capture tabId from each request
    await page.route(`**${TEST_API.CLAUDE_STREAM}`, async route => {
      const tabId = getTabIdFromRequest(route.request())
      if (tabId) capturedTabIds.push(tabId)
      await handlers.text(`Response ${capturedTabIds.length}`)(route)
    })

    // Navigate and wait for workspace ready
    await chatPage.gotoFast(workerTenant.workspace, workerTenant.orgId)

    // Wait for chat to be fully ready (send button enabled)
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // Expand tabs bar
    const toggleTabsBtn = page.locator(TEST_SELECTORS.toggleTabsButton)
    if (await toggleTabsBtn.isVisible()) {
      await toggleTabsBtn.click()
      await expect(page.locator(TEST_SELECTORS.tabBar)).toBeVisible({
        timeout: TEST_TIMEOUTS.medium,
      })
    }

    // Send message in Tab 1
    await chatPage.sendMessage("Message from Tab 1")

    // Wait for response to complete
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // Create Tab 2
    await page.locator(TEST_SELECTORS.addTabButton).click()

    // Wait for Tab 2 to be active and ready
    await expect(page.locator(`${TEST_SELECTORS.tabPrefix}${TEST_SELECTORS.activeTab}`)).toHaveAttribute(
      "data-tab-name",
      "Tab 2",
      { timeout: TEST_TIMEOUTS.medium },
    )

    // Wait for send button to be enabled in new tab
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // Send message in Tab 2
    await chatPage.sendMessage("Message from Tab 2")

    // Wait for response to complete
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // CRITICAL ASSERTION: We should have 2 requests with DIFFERENT tabIds
    expect(capturedTabIds).toHaveLength(2)
    expect(capturedTabIds[0]).toBeTruthy()
    expect(capturedTabIds[1]).toBeTruthy()
    expect(capturedTabIds[0]).not.toBe(capturedTabIds[1])
  })

  test("switching tabs preserves each tab's tabId", async ({ authenticatedPage, workerTenant }) => {
    const page = authenticatedPage
    const chatPage = new ChatPage(page)

    // Map tabId -> request count to track conversation continuity
    const tabIdRequestCounts = new Map<string, number>()

    await page.route(`**${TEST_API.CLAUDE_STREAM}`, async route => {
      const tabId = getTabIdFromRequest(route.request())
      if (tabId) {
        tabIdRequestCounts.set(tabId, (tabIdRequestCounts.get(tabId) || 0) + 1)
      }
      await handlers.text(`Response for ${tabId?.slice(0, 8)}`)(route)
    })

    await chatPage.gotoFast(workerTenant.workspace, workerTenant.orgId)

    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // Expand tabs
    const toggleTabsBtn = page.locator(TEST_SELECTORS.toggleTabsButton)
    if (await toggleTabsBtn.isVisible()) {
      await toggleTabsBtn.click()
      await expect(page.locator(TEST_SELECTORS.tabBar)).toBeVisible({
        timeout: TEST_TIMEOUTS.medium,
      })
    }

    // Send first message in Tab 1
    await chatPage.sendMessage("Tab 1 - Message 1")
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // Create and switch to Tab 2
    await page.locator(TEST_SELECTORS.addTabButton).click()
    await expect(page.locator(`${TEST_SELECTORS.tabPrefix}${TEST_SELECTORS.activeTab}`)).toHaveAttribute(
      "data-tab-name",
      "Tab 2",
      { timeout: TEST_TIMEOUTS.medium },
    )
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // Send message in Tab 2
    await chatPage.sendMessage("Tab 2 - Message 1")
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // Switch back to Tab 1
    await page.locator('[data-tab-name="Tab 1"]').click()
    await expect(page.locator('[data-tab-name="Tab 1"]')).toHaveAttribute("data-active", "true", {
      timeout: TEST_TIMEOUTS.medium,
    })
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // Send second message in Tab 1
    await chatPage.sendMessage("Tab 1 - Message 2")
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // ASSERTIONS:
    // 1. Should have exactly 2 distinct tabIds
    expect(tabIdRequestCounts.size).toBe(2)

    // 2. Tab 1's tabId should have 2 requests (we sent 2 messages)
    // 3. Tab 2's tabId should have 1 request
    const counts = Array.from(tabIdRequestCounts.values()).sort((a, b) => b - a)
    expect(counts).toEqual([2, 1])
  })

  test("tabId in request matches UUID format", async ({ authenticatedPage, workerTenant }) => {
    const page = authenticatedPage
    const chatPage = new ChatPage(page)

    let capturedTabId: string | null = null

    await page.route(`**${TEST_API.CLAUDE_STREAM}`, async route => {
      capturedTabId = getTabIdFromRequest(route.request())
      await handlers.text("Response")(route)
    })

    await chatPage.gotoFast(workerTenant.workspace, workerTenant.orgId)

    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    await chatPage.sendMessage("Test message")

    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
      timeout: TEST_TIMEOUTS.slow,
    })

    // Verify tabId is a valid UUID
    expect(capturedTabId).toBeTruthy()
    expect(capturedTabId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })
})
