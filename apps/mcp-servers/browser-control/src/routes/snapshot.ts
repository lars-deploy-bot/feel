import type { IncomingMessage, ServerResponse } from "node:http"
import { browserPool } from "../browser-pool.js"
import { parseJsonBody, sendError, sendJson } from "../http.js"
import { takeSnapshot } from "../snapshot-formatter.js"

/**
 * POST /snapshot
 * Get the accessibility tree of the current page with element refs.
 *
 * Stores roleRefs on the session so subsequent /act calls can resolve them.
 *
 * Body: { domain: string, interactive?: boolean }
 * Returns: { tree, refs, stats, url, title }
 */
export async function handleSnapshot(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req)
  const domain = body.domain as string
  const interactive = body.interactive === true

  if (!domain) {
    sendError(res, 400, "domain is required")
    return
  }

  try {
    const session = await browserPool.getSession(domain)
    const currentUrl = session.page.url()

    if (currentUrl === "about:blank") {
      sendError(res, 400, "No page loaded. Use the 'open' action first to navigate to your site.")
      return
    }

    const result = await takeSnapshot(session.page, { interactive })

    // Store refs on session so /act can resolve them without re-snapshotting
    session.roleRefs = result.refs

    sendJson(res, result)
  } catch (err) {
    sendError(res, 500, `Snapshot failed: ${String(err instanceof Error ? err.message : err)}`)
  }
}
