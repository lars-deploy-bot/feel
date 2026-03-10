import { browserPool } from "../browser-pool.js"
import { takeSnapshot } from "../snapshot-formatter.js"
import type { RouteHandler } from "../types.js"

/**
 * POST /snapshot
 * Get the accessibility tree of the current page with element refs.
 *
 * Stores roleRefs on the session so subsequent /act calls can resolve them.
 *
 * Body: { domain: string, sessionId?: string, interactive?: boolean }
 * Returns: { tree, refs, stats, url, title }
 */
export const handleSnapshot: RouteHandler = async (body, signal) => {
  const domain = typeof body.domain === "string" ? body.domain : ""
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined
  const interactive = body.interactive === true

  if (!domain) {
    return { ok: false, status: 400, error: "domain is required" }
  }

  const session = await browserPool.getSession(domain, sessionId)
  const currentUrl = session.page.url()

  if (currentUrl === "about:blank") {
    return { ok: false, status: 400, error: "No page loaded. Use the 'open' action first to navigate to your site." }
  }

  const result = await takeSnapshot(session.page, { interactive })

  if (signal.aborted) throw new Error("aborted")

  // Store refs on session so /act can resolve them without re-snapshotting
  session.roleRefs = result.refs

  return { ok: true, data: result as unknown as Record<string, unknown> }
}
