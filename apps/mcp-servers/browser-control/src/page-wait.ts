/**
 * Page Wait Utility
 *
 * Smart waiting for SPAs. Uses page.evaluate() exclusively — NEVER
 * Playwright's waitForLoadState() which hangs indefinitely on
 * Vite dev pages with Chrome 144+ (Playwright 1.58 bug).
 *
 * After goto(waitUntil: "commit"), the page may not have an execution
 * context yet. We use a small native delay + race timeouts around every
 * page.evaluate() to prevent hanging.
 */

import type { Page } from "playwright-core"

interface WaitOptions {
  /** Max time to wait for stability (ms). Default: 8000. */
  timeoutMs?: number
}

/** Run page.evaluate with a hard timeout. Returns undefined if it times out. */
async function safeEvaluate<T>(
  page: Page,
  fn: (arg: number) => Promise<T>,
  arg: number,
  timeoutMs: number,
): Promise<T | undefined> {
  return Promise.race([
    page.evaluate(fn, arg),
    new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), timeoutMs)),
  ])
}

/** Simple native delay — no Playwright internals. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wait for a page to stabilize after navigation.
 *
 * Strategy:
 * 1. Small native delay (let Chrome create execution context after "commit")
 * 2. Wait for document.readyState === "complete" (up to 5s, with hard timeout)
 * 3. Wait for DOM mutations to settle (up to 3s, with hard timeout)
 *
 * Never throws — always resolves.
 */
export async function waitForPageStable(page: Page, options?: WaitOptions): Promise<void> {
  const timeout = options?.timeoutMs ?? 8_000

  // Give Chrome time to create the execution context after navigation "commit".
  // Without this, page.evaluate() hangs indefinitely waiting for a context.
  await delay(500)

  // Step 1: Wait for document.readyState via evaluate (with hard race timeout)
  try {
    await safeEvaluate(
      page,
      (maxMs: number) =>
        new Promise<void>(resolve => {
          if (document.readyState === "complete") {
            resolve()
            return
          }
          const onReady = () => {
            if (document.readyState === "complete") {
              window.removeEventListener("load", onReady)
              resolve()
            }
          }
          window.addEventListener("load", onReady)
          setTimeout(() => {
            window.removeEventListener("load", onReady)
            resolve()
          }, maxMs)
        }),
      Math.min(timeout - 500, 5_000),
      Math.min(timeout - 500, 5_000) + 1_000, // race timeout: evaluate timeout + 1s buffer
    )
  } catch {
    // Page context unavailable — continue
  }

  // Step 2: Wait for DOM to stop mutating (React/Vue rendering)
  try {
    await safeEvaluate(
      page,
      (maxMs: number) =>
        new Promise<void>(resolve => {
          if (!document.body) {
            resolve()
            return
          }
          let timer: ReturnType<typeof setTimeout> | null = null
          const done = () => {
            observer.disconnect()
            resolve()
          }
          const observer = new MutationObserver(() => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(done, 200)
          })
          observer.observe(document.body, { childList: true, subtree: true })
          timer = setTimeout(done, 200)
          setTimeout(done, maxMs)
        }),
      Math.min(Math.max(timeout - 5_500, 1_000), 3_000),
      Math.min(Math.max(timeout - 5_500, 1_000), 3_000) + 1_000,
    )
  } catch {
    // Page might be navigating — continue
  }
}
