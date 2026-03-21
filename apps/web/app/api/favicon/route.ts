/**
 * GET /api/favicon?domain=example.com
 *
 * Proxies Google's gstatic favicon service (same-origin, no CORS/CSP issues).
 * Uses the gstatic URL directly to avoid the google.com → gstatic redirect.
 */

import type { NextRequest } from "next/server"

const GSTATIC_BASE = "https://t2.gstatic.com/faviconV2"
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")
  if (!domain) {
    return new Response(null, { status: 400 })
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
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable`,
    },
  })
}
