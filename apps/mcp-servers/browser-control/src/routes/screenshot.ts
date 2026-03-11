import { browserPool } from "../browser-pool.js"
import { waitForPageStable } from "../page-wait.js"
import type { RouteHandler } from "../types.js"

/**
 * POST /screenshot
 * Take a screenshot of the current page.
 *
 * Body: { domain: string, sessionId?: string, fullPage?: boolean }
 * Returns: { image: string (base64 PNG), url, title }
 */
export const handleScreenshot: RouteHandler = async (body, signal) => {
  const domain = typeof body.domain === "string" ? body.domain : ""
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined
  const fullPage = body.fullPage !== false // default true

  if (!domain) {
    return { ok: false, status: 400, error: "domain is required" }
  }

  const session = await browserPool.getSession(domain, sessionId)
  const currentUrl = session.page.url()

  if (currentUrl === "about:blank") {
    return { ok: false, status: 400, error: "No page loaded. Use the 'open' action first to navigate to your site." }
  }

  // Wait for page to stabilize before capturing — SPAs may still be rendering
  await waitForPageStable(session.page, { timeoutMs: 5_000 })

  if (signal.aborted) throw new Error("aborted")

  const buffer = await session.page.screenshot({
    fullPage,
    type: "png",
  })

  if (signal.aborted) throw new Error("aborted")

  const title = await session.page.title().catch(() => "")

  return {
    ok: true,
    data: {
      image: buffer.toString("base64"),
      url: currentUrl,
      title,
    },
  }
}
