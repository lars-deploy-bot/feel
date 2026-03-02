/**
 * Sentry Tunnel - Proxies Sentry envelopes to bypass ad blockers.
 *
 * The browser POSTs envelopes to /api/monitoring (same origin),
 * this route extracts the DSN, validates it matches our project,
 * and forwards the envelope to the self-hosted Sentry instance.
 */

import { SENTRY } from "@webalive/shared"

export async function POST(request: Request) {
  if (!SENTRY.DSN) {
    return new Response("Sentry not configured", { status: 404 })
  }

  const envelope = await request.text()
  const firstLine = envelope.split("\n")[0]

  let dsn: URL
  try {
    const header = JSON.parse(firstLine)
    dsn = new URL(header.dsn)
  } catch (_err) {
    // Expected: malformed envelope header from client
    return new Response("Invalid envelope header", { status: 400 })
  }

  // Only forward envelopes destined for our Sentry project
  if (dsn.hostname !== SENTRY.HOST) {
    return new Response("Invalid DSN host", { status: 403 })
  }

  const projectId = dsn.pathname.replace("/", "")
  if (projectId !== SENTRY.PROJECT_ID) {
    return new Response("Invalid project", { status: 403 })
  }

  const upstreamUrl = `https://${SENTRY.HOST}/api/${projectId}/envelope/`

  try {
    const response = await fetch(upstreamUrl, {
      method: "POST",
      body: envelope,
      headers: { "Content-Type": "application/x-sentry-envelope" },
      signal: AbortSignal.timeout(5_000),
    })

    return new Response(response.body, { status: response.status })
  } catch (_err) {
    // Expected: Sentry upstream may be unreachable or timeout
    return new Response("Upstream unavailable", { status: 504 })
  }
}
