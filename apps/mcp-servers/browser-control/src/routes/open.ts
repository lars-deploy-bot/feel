import type { IncomingMessage, ServerResponse } from "node:http"
import { browserPool } from "../browser-pool.js"
import { parseJsonBody, sendError, sendJson } from "../http.js"
import { resolveUrl } from "../port-resolver.js"

/**
 * POST /open
 * Navigate to the workspace site (or a path within it).
 *
 * Body: { domain: string, path?: string }
 */
export async function handleOpen(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req)
  const domain = body.domain as string
  const path = (body.path as string) ?? "/"

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
    const session = await browserPool.getSession(domain)
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
