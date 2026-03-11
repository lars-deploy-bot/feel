/**
 * Page Wait Utility
 *
 * Waits for a page to stabilize before screenshot/snapshot.
 * Called after open (which already waits for domcontentloaded),
 * this catches async rendering from data fetches and JS modules.
 */

import type { Page } from "playwright-core"

interface WaitOptions {
  /** Max time to wait (ms). Default: 5000. */
  timeoutMs?: number
}

/**
 * Wait for the page to finish loading resources and rendering.
 * Uses the `load` event (fires after images, stylesheets, iframes).
 * Never throws — catches timeout and continues.
 */
export async function waitForPageStable(page: Page, options?: WaitOptions): Promise<void> {
  const timeout = options?.timeoutMs ?? 5_000
  await page.waitForLoadState("load", { timeout }).catch(() => {})
}
