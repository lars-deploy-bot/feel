import { Hono } from "hono"
import type { AppBindings } from "../../types/hono"

/**
 * GET /api/favicon?domain=example.com
 *
 * Proxies Google's gstatic favicon service so the browser gets a same-origin response.
 * No auth required — favicons are public data.
 */

const GSTATIC_BASE = "https://t2.gstatic.com/faviconV2"
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days

export const faviconRoutes = new Hono<AppBindings>()

faviconRoutes.get("/", async c => {
  const domain = c.req.query("domain")
  if (!domain) {
    return c.json({ error: "Missing domain param" }, 400)
  }

  const url = `${GSTATIC_BASE}?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${encodeURIComponent(domain)}&size=32`

  const res = await fetch(url, { redirect: "follow" })
  const body = await res.arrayBuffer()

  // Google's default globe icon is always exactly 726 bytes.
  // Return 404 so the client falls back to the letter initial.
  if (!res.ok || body.byteLength === 726) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable` },
    })
  }

  const contentType = res.headers.get("content-type") ?? "image/png"

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable`,
    },
  })
})
