import { browserPool } from "../browser-pool.js"
import type { RouteHandler } from "../types.js"

/**
 * POST /console
 * Read console messages and page errors from the current session.
 *
 * Body: { domain: string, sessionId?: string, clear?: boolean }
 */
export const handleConsole: RouteHandler = async (body, _signal) => {
  const domain = typeof body.domain === "string" ? body.domain : ""
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined
  const clear = body.clear === true

  if (!domain) {
    return { ok: false, status: 400, error: "domain is required" }
  }

  const session = await browserPool.getSession(domain, sessionId)

  const result = {
    url: session.page.url(),
    consoleMessages: [...session.consoleMessages],
    pageErrors: [...session.pageErrors],
    counts: {
      console: session.consoleMessages.length,
      errors: session.pageErrors.length,
    },
  }

  if (clear) {
    session.consoleMessages.length = 0
    session.pageErrors.length = 0
  }

  return { ok: true, data: result }
}
