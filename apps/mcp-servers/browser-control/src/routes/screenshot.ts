import type { IncomingMessage, ServerResponse } from "node:http"
import { browserPool } from "../browser-pool.js"
import { parseJsonBody, sendError, sendJson } from "../http.js"

/**
 * POST /screenshot
 * Take a screenshot of the current page.
 *
 * Body: { domain: string, sessionId?: string, fullPage?: boolean }
 * Returns: { image: string (base64 PNG), url, title }
 */
export async function handleScreenshot(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: Record<string, unknown>
  try {
    body = await parseJsonBody(req)
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Invalid request body")
    return
  }

  const domain = typeof body.domain === "string" ? body.domain : ""
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined
  const fullPage = body.fullPage !== false // default true

  if (!domain) {
    sendError(res, 400, "domain is required")
    return
  }

  try {
    const session = await browserPool.getSession(domain, sessionId)
    const currentUrl = session.page.url()

    // Don't screenshot blank pages
    if (currentUrl === "about:blank") {
      sendError(res, 400, "No page loaded. Use the 'open' action first to navigate to your site.")
      return
    }

    const buffer = await session.page.screenshot({
      fullPage,
      type: "png",
    })

    const title = await session.page.title().catch(() => "")

    sendJson(res, {
      image: buffer.toString("base64"),
      url: currentUrl,
      title,
    })
  } catch (err) {
    sendError(res, 500, `Screenshot failed: ${String(err instanceof Error ? err.message : err)}`)
  }
}
