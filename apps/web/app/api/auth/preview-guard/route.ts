import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { verifySessionToken } from "@/features/auth/lib/jwt"
import { COOKIE_NAMES } from "@/lib/auth/cookies"

/**
 * Preview Guard - Authentication endpoint for Caddy forward_auth
 *
 * This endpoint is called by Caddy's forward_auth directive to verify
 * that requests to preview subdomains are authenticated.
 *
 * Used in Caddyfile:
 *   forward_auth localhost:8998 {
 *     uri /api/auth/preview-guard
 *     copy_headers Cookie
 *   }
 *
 * Returns:
 *   - 200: User is authenticated (has valid JWT session)
 *   - 401: User is not authenticated or token invalid/expired
 */
export async function GET() {
  try {
    const jar = await cookies()
    const sessionCookie = jar.get(COOKIE_NAMES.SESSION)

    // Check if session cookie exists
    if (!sessionCookie?.value) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Verify JWT signature and expiration
    const payload = await verifySessionToken(sessionCookie.value)
    if (!payload) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Valid session
    return new NextResponse("OK", { status: 200 })
  } catch (error) {
    console.error("[preview-guard] Error:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

/**
 * Support HEAD requests (Caddy may use HEAD for auth checks)
 */
export async function HEAD() {
  return GET()
}
