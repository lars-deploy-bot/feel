/**
 * Next.js Middleware — Security headers + Request ID tracing
 *
 * 1. Request ID: Guarantees every response carries X-Request-Id.
 *    - Preserves an incoming X-Request-Id if the caller supplies one.
 *    - Generates a new UUIDv4 otherwise.
 *    - Exposes the header to browser JS via Access-Control-Expose-Headers.
 *
 * 2. CSP (Report-Only): Sets Content-Security-Policy-Report-Only on page
 *    responses to baseline what the app needs before enforcing.
 *    Only applied to document routes — CSP is meaningless on API JSON.
 */

import { type NextRequest, NextResponse } from "next/server"
import { generateRequestId, REQUEST_ID_HEADER } from "@/lib/request-id"

/**
 * Build Content-Security-Policy-Report-Only directives.
 *
 * Phase 1: permissive policy with 'unsafe-inline' for scripts/styles.
 * Next.js RSC hydration injects inline scripts (self.__next_f.push(...))
 * and next-themes uses inline style attributes, so strict CSP requires
 * nonce support (Phase 2, separate issue).
 *
 * frame-src is derived from NEXT_PUBLIC_PREVIEW_BASE to avoid hardcoding domains.
 */
function buildCspDirectives(): string {
  const previewBase = process.env.NEXT_PUBLIC_PREVIEW_BASE
  const frameSrc = previewBase ? `'self' *.${previewBase}` : "'self'"

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' wss: https:",
    "font-src 'self'",
    `frame-src ${frameSrc}`,
    "frame-ancestors 'none'",
  ].join("; ")
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Defense-in-depth: block /api/internal* from external access (#310).
  // Primary block is at Caddy (responds 404 before reverse_proxy).
  // This catches the case where Caddy's rule is accidentally removed.
  //
  // Detection: Caddy adds X-Forwarded-For to proxied requests.
  // Direct localhost calls (from worker/MCP tools) skip Caddy entirely
  // and won't have this header, so they pass through to route-level auth.
  if (pathname.startsWith("/api/internal") && request.headers.get("x-forwarded-for")) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const requestId = request.headers.get(REQUEST_ID_HEADER) || generateRequestId()

  // Forward the ID to route handlers via a modified request header.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Attach to the outgoing response so clients can correlate.
  response.headers.set(REQUEST_ID_HEADER, requestId)

  // CSP Report-Only on page routes only — meaningless on API JSON responses.
  if (!pathname.startsWith("/api/")) {
    response.headers.set("Content-Security-Policy-Report-Only", buildCspDirectives())
  }

  // Merge with any existing expose list so we don't clobber other headers.
  const existing = response.headers.get("access-control-expose-headers")
  const alreadyExposed = existing
    ?.split(",")
    .map(h => h.trim().toLowerCase())
    .includes(REQUEST_ID_HEADER)
  if (!alreadyExposed) {
    const exposeValue = existing ? `${existing}, X-Request-Id` : "X-Request-Id"
    response.headers.set("Access-Control-Expose-Headers", exposeValue)
  }

  return response
}

export const config = {
  matcher: [
    // API routes — request-id tracing. Excludes upload endpoints because
    // middleware buffers request bodies (default 10 MB limit), which
    // truncates large uploads and breaks multipart parsing.
    "/api/((?!images/upload|files/upload|drive/upload).*)",
    // Page routes — CSP + request-id. Excludes Next.js internals and static files.
    "/((?!_next|api|favicon\\.ico).*)",
  ],
}
