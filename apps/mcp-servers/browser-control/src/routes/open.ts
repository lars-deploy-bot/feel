import type { IncomingMessage, ServerResponse } from "node:http"
import { browserPool } from "../browser-pool.js"
import { parseJsonBody, sendError, sendJson } from "../http.js"
import { resolveUrl } from "../port-resolver.js"

/**
 * POST /open
 * Navigate to the workspace site (or a path within it).
 *
 * Body: { domain: string, sessionId?: string, path?: string }
 */
export async function handleOpen(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: Record<string, unknown>
  try {
    body = await parseJsonBody(req)
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Invalid request body")
    return
  }

  const domain = typeof body.domain === "string" ? body.domain : ""
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined
  const path = typeof body.path === "string" ? body.path : "/"

  if (!domain) {
    sendError(res, 400, "domain is required")
    return
  }

  let url: string
  try {
    url = resolveUrl(domain, path)
  } catch (err) {
    sendError(res, 404, String(err instanceof Error ? err.message : err))
    return
  }

  try {
    const session = await browserPool.getSession(domain, sessionId)
    const response = await session.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    })

    const title = await session.page.title().catch(() => "")

    sendJson(res, {
      ok: true,
      url: session.page.url(),
      title,
      status: response?.status() ?? null,
    })
  } catch (err) {
    sendError(res, 500, `Navigation failed: ${String(err instanceof Error ? err.message : err)}`)
  }
}
