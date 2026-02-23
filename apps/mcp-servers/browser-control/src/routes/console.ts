import type { IncomingMessage, ServerResponse } from "node:http"
import { browserPool } from "../browser-pool.js"
import { parseJsonBody, sendError, sendJson } from "../http.js"

/**
 * POST /console
 * Read console messages and page errors from the current session.
 *
 * Body: { domain: string, sessionId?: string, clear?: boolean }
 */
export async function handleConsole(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: Record<string, unknown>
  try {
    body = await parseJsonBody(req)
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Invalid request body")
    return
  }

  const domain = typeof body.domain === "string" ? body.domain : ""
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined
  const clear = body.clear === true

  if (!domain) {
    sendError(res, 400, "domain is required")
    return
  }

  try {
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

    sendJson(res, result)
  } catch (err) {
    sendError(res, 500, `Console read failed: ${String(err instanceof Error ? err.message : err)}`)
  }
}
