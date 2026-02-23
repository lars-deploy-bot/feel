import type { IncomingMessage, ServerResponse } from "node:http"
import { browserPool } from "../browser-pool.js"
import { sendJson } from "../http.js"
import { isDomainKnown } from "../port-resolver.js"

/**
 * GET /status/:domain
 * Check browser status for a workspace.
 */
export async function handleStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost")
  const parts = url.pathname.split("/")
  // /status/:domain
  const domain = parts[2]

  if (!domain) {
    // Return global stats
    sendJson(res, browserPool.stats)
    return
  }

  const known = isDomainKnown(domain)

  sendJson(res, {
    domain,
    knownInPortMap: known,
    ...browserPool.stats,
  })
}
