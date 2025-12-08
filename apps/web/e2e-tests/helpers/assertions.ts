/**
 * Custom assertions and helpers for E2E tests
 *
 * Benefits:
 * - Consistent waiting strategies
 * - Better error messages
 * - Reusable patterns
 */
import { expect, type Page } from "@playwright/test"
import { TEST_SELECTORS, TEST_TIMEOUTS } from "../fixtures/test-data"

/**
 * Navigate to chat page and wait for React to hydrate
 * Uses domcontentloaded for fast navigation, then waits for workspace-ready
 * This handles concurrent test load where networkidle would timeout
 */
export async function gotoChat(page: Page) {
  await page.goto("/chat", { waitUntil: "domcontentloaded" })
  await expectWorkspaceReady(page)
}

/**
 * FAST: Navigate to chat with workspace pre-injected
 *
 * IMPORTANT: Must be used with authenticatedPage fixture which sets up
 * localStorage via context.addInitScript before any navigation.
 */
export async function gotoChatFast(page: Page, _workspace: string, _orgId: string) {
  // Navigate to chat - localStorage is already set via fixture's context.addInitScript
  await page.goto("/chat", { waitUntil: "domcontentloaded" })

  // Wait for workspace to be ready with generous timeout
  // Zustand persist hydration can be slow under parallel load
  await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({
    timeout: TEST_TIMEOUTS.max, // 15s - hydration under load can be very slow
  })
}

/**
 * Wait for workspace to be fully initialized
 * - Waits for both mounted and workspace state to be set
 * - Required before any chat interactions
 */
export async function expectWorkspaceReady(page: Page) {
  await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({
    timeout: TEST_TIMEOUTS.max, // 15s - hydration under load can be very slow
  })
}

/**
 * Expect a chat message to be visible
 * Uses .first() to handle message appearing in both sidebar and chat area
 */
export async function expectChatMessage(page: Page, text: string | RegExp) {
  const locator = typeof text === "string" ? page.getByText(text, { exact: true }) : page.getByText(text)

  await expect(locator.first()).toBeVisible({
    timeout: TEST_TIMEOUTS.medium,
  })
}

/**
 * Expect send button to be enabled
 * Indicates workspace is ready and no message is being sent
 *
 * Note: Uses medium timeout because after sending a message,
 * the button needs time to process response and re-enable
 */
export async function expectSendButtonEnabled(page: Page) {
  await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({
    timeout: TEST_TIMEOUTS.medium, // 3s - needs time for response cycle
  })
}

/**
 * Expect send button to be disabled
 * Indicates message is being sent or workspace not ready
 */
export async function expectSendButtonDisabled(page: Page) {
  await expect(page.locator(TEST_SELECTORS.sendButton)).toBeDisabled({
    timeout: TEST_TIMEOUTS.fast,
  })
}
