import { browserPool } from "../browser-pool.js"
import { waitForPageStable } from "../page-wait.js"
import { resolveUrl } from "../port-resolver.js"
import type { RouteHandler } from "../types.js"

/**
 * POST /open
 * Navigate to the workspace site (or a path within it).
 *
 * Body: { domain: string, sessionId?: string, path?: string }
 */
export const handleOpen: RouteHandler = async (body, signal) => {
  const domain = typeof body.domain === "string" ? body.domain : ""
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined
  const path = typeof body.path === "string" ? body.path : "/"

  if (!domain) {
    return { ok: false, status: 400, error: "domain is required" }
  }

  let url: string
  try {
    url = resolveUrl(domain, path)
  } catch (err) {
    return { ok: false, status: 404, error: String(err instanceof Error ? err.message : err) }
  }

  const session = await browserPool.getSession(domain, sessionId)

  // Navigate and wait for DOM to be ready — "domcontentloaded" is the minimum
  // for React/Vite apps to have their root element in the DOM.
  const response = await session.page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  })

  if (signal.aborted) throw new Error("aborted")

  // Wait for the page to stabilize (network idle + JS rendering)
  // This is critical for SPAs that fetch data and render async.
  await waitForPageStable(session.page, { timeoutMs: 10_000 })

  if (signal.aborted) throw new Error("aborted")

  const title = await session.page.title().catch(() => "")

  return {
    ok: true,
    data: {
      ok: true,
      url: session.page.url(),
      title,
      status: response?.status() ?? null,
    },
  }
}
