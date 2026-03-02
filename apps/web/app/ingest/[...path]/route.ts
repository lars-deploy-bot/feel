/**
 * PostHog reverse proxy — forwards /ingest/* to PostHog with the real client IP.
 *
 * Replaces the Next.js `rewrites()` approach which drops X-Forwarded-For,
 * causing PostHog GeoIP to see the server IP instead of the user's IP.
 */

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "")

async function proxy(req: Request): Promise<Response> {
  if (!POSTHOG_HOST) {
    return new Response("PostHog not configured", { status: 503 })
  }

  const url = new URL(req.url)
  const pathAfterIngest = url.pathname.replace(/^\/ingest/, "")
  const target = `${POSTHOG_HOST}${pathAfterIngest}${url.search}`

  const headers = new Headers()
  // Forward content type
  const contentType = req.headers.get("content-type")
  if (contentType) {
    headers.set("content-type", contentType)
  }

  // Forward the real client IP so PostHog GeoIP works correctly.
  // Chain: Browser → Cloudflare → Caddy → Next.js, each appends to X-Forwarded-For.
  // We take the first (original client) IP.
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (clientIp) {
    headers.set("X-Forwarded-For", clientIp)
  }

  const response = await fetch(target, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
    // @ts-expect-error -- Node fetch supports duplex for streaming request bodies
    duplex: "half",
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
    },
  })
}

export const GET = proxy
export const POST = proxy
