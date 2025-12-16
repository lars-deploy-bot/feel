/**
 * Custom assertions and helpers for E2E tests
 *
 * Benefits:
 * - Consistent waiting strategies
 * - Better error messages
 * - Reusable patterns
 *
 * IMPORTANT: Synchronization Strategy
 * - Use waitForAppHydrated() as the "clock" - it waits for window.__APP_HYDRATED__
 * - DOM markers (workspace-ready) become assertions AFTER hydration is confirmed
 * - This decouples test sync from React render timing
 */
import { expect, type Page } from "@playwright/test"
import { TEST_SELECTORS, TEST_TIMEOUTS } from "../fixtures/test-data"

/**
 * Wait for app hydration to complete.
 *
 * This is the PRIMARY synchronization primitive for E2E tests.
 * Waits for window.__APP_HYDRATED__ which is set by HydrationManager
 * after all Zustand persisted stores have rehydrated.
 *
 * Why this instead of DOM markers:
 * - Not dependent on React render timing
 * - Not affected by suspense boundaries or slow JS
 * - Deterministic: single boolean flag, no DOM traversal
 */
export async function waitForAppHydrated(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __APP_HYDRATED__?: boolean }).__APP_HYDRATED__ === true, {
    timeout: TEST_TIMEOUTS.max,
  })
}

/**
 * Navigate to chat page and wait for hydration
 * Uses domcontentloaded for fast navigation, then waits for __APP_HYDRATED__
 */
export async function gotoChat(page: Page) {
  await page.goto("/chat", { waitUntil: "domcontentloaded" })
  await waitForAppHydrated(page)
  // DOM marker is now an assertion, not the clock
  await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({ timeout: TEST_TIMEOUTS.fast })
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

  // Wait for hydration (the clock)
  await waitForAppHydrated(page)

  // DOM marker is an assertion after hydration, not the synchronization primitive
  await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({ timeout: TEST_TIMEOUTS.fast })
}

/**
 * Wait for workspace to be fully initialized
 * - First waits for hydration (the clock)
 * - Then asserts DOM marker is present
 */
export async function expectWorkspaceReady(page: Page) {
  await waitForAppHydrated(page)
  await expect(page.locator(TEST_SELECTORS.workspaceReady)).toBeAttached({ timeout: TEST_TIMEOUTS.fast })
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
