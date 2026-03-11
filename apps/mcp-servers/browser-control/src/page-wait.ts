/**
 * Page Wait Utility
 *
 * Smart waiting for SPAs and dynamic pages. Waits for network idle
 * AND DOM stability so screenshots/snapshots capture rendered content.
 *
 * The problem: Vite/React sites return HTML instantly (domcontentloaded)
 * but then fetch data and render async. Without waiting, screenshots
 * and accessibility snapshots capture blank/incomplete pages.
 */

import type { Page } from "playwright-core"

interface WaitOptions {
  /** Max time to wait for stability (ms). Default: 8000. */
  timeoutMs?: number
}

/**
 * Wait for a page to stabilize after navigation or interaction.
 *
 * Strategy: try networkidle first (best signal for SPAs), fall back
 * to a short fixed wait if it times out. Never throws — always
 * resolves so the caller can proceed with whatever state the page is in.
 */
export async function waitForPageStable(page: Page, options?: WaitOptions): Promise<void> {
  const timeout = options?.timeoutMs ?? 8_000

  // Try networkidle — fires when no network requests for 500ms.
  // This is the best signal that a SPA has finished fetching data.
  try {
    await page.waitForLoadState("networkidle", { timeout })
    return
  } catch {
    // networkidle timed out — page may have long-polling/websocket connections.
    // Fall back to a shorter DOM-stability check.
  }

  // Fallback: wait for the DOM to stop changing (mutation observer).
  // If the page has streaming connections that prevent networkidle,
  // this catches when the visible DOM has at least stabilized.
  try {
    await page.evaluate(
      (waitMs: number) =>
        new Promise<void>(resolve => {
          let timer: ReturnType<typeof setTimeout> | null = null
          const observer = new MutationObserver(() => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
              observer.disconnect()
              resolve()
            }, 300) // 300ms of no mutations = stable
          })
          observer.observe(document.body, { childList: true, subtree: true })
          // Start the timer in case there are no mutations at all
          timer = setTimeout(() => {
            observer.disconnect()
            resolve()
          }, 300)
          // Hard cap
          setTimeout(() => {
            observer.disconnect()
            resolve()
          }, waitMs)
        }),
      Math.min(timeout, 3_000),
    )
  } catch {
    // Page might not have a body yet — just continue
  }
}
