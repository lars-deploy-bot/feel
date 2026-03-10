/**
 * Cookie Configuration
 *
 * Cookie names and session config imported from @webalive/shared (single source of truth).
 * This file provides cookie options helpers for Next.js.
 *
 * SERVER-AGNOSTIC: Cookie domain is extracted dynamically from the request host,
 * allowing the app to work on any domain without hardcoding.
 */

import { env } from "@webalive/env/server"
import { COOKIE_NAMES, SESSION_MAX_AGE } from "@webalive/shared"

// Re-export for backward compatibility
export { COOKIE_NAMES, SESSION_MAX_AGE }

type CookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "lax" | "strict" | "none"
  path?: string
  maxAge?: number
  expires?: Date
  domain?: string
}

/** Minimal request shape — works with NextRequest, Request, etc. */
type RequestLike = { headers: { get(name: string): string | null } }

/** Minimal response shape — works with NextResponse, etc. */
type ResponseLike = { cookies: { set(name: string, value: string, options: CookieOptions): void } }

/**
 * Extract the Host header from a request, or throw.
 * Every cookie-setting code path must call this — a missing Host header
 * causes domain-less cookies that coexist with domain cookies as duplicates.
 */
export function requireHost(request: RequestLike): string {
  const host = request.headers.get("host")
  if (!host) {
    throw new Error("Missing Host header — cannot set session cookie domain")
  }
  return host
}

/**
 * Extract the root domain from a host for cookie domain setting.
 * Returns the domain with a leading dot for subdomain sharing.
 *
 * Examples:
 * - "app.example.com" -> ".example.com"
 * - "app.sonno.tech" -> ".sonno.tech"
 * - "dev.app.sonno.tech" -> ".sonno.tech"
 * - "localhost:3000" -> undefined (no domain for localhost)
 */
function extractRootDomain(host: string): string | undefined {
  // Remove port if present
  const hostname = host.split(":")[0]

  // Don't set domain for localhost/IP addresses
  if (hostname === "localhost" || hostname === "127.0.0.1" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return undefined
  }

  const parts = hostname.split(".")

  // Need at least 2 parts for a valid domain (e.g., "example.com")
  if (parts.length < 2) {
    return undefined
  }

  // Get the last 2 parts as the root domain
  // This works for most TLDs (.com, .nl, .tech, .best, etc.)
  // Note: Does not handle special TLDs like .co.uk - add explicit handling if needed
  const rootDomain = parts.slice(-2).join(".")

  return `.${rootDomain}`
}

/**
 * Build base cookie options shared by set and clear.
 * Uses sameSite: "lax" — Safari ITP clears "none" cookies within 24 hours.
 * Preview iframes use separate token-based auth via /api/auth/preview-token.
 */
function baseCookieOptions(host: string): CookieOptions {
  const isDeployed = env.STREAM_ENV !== "local"
  return {
    httpOnly: true,
    secure: isDeployed,
    sameSite: "lax",
    path: "/",
    ...(isDeployed && { domain: extractRootDomain(host) }),
  }
}

/** Cookie options for setting a session cookie. */
export function getSessionCookieOptions(host: string): CookieOptions {
  return { ...baseCookieOptions(host), maxAge: SESSION_MAX_AGE }
}

/** Cookie options for clearing a cookie. Must match set options except value/expiry. */
export function getClearCookieOptions(host: string): CookieOptions {
  return { ...baseCookieOptions(host), expires: new Date(0) }
}

// =============================================================================
// Route helpers — one-liner cookie operations with guaranteed domain
// =============================================================================

function setCookie(res: ResponseLike, name: string, token: string, request: RequestLike): void {
  res.cookies.set(name, token, getSessionCookieOptions(requireHost(request)))
}

function clearCookie(res: ResponseLike, name: string, request: RequestLike): void {
  res.cookies.set(name, "", getClearCookieOptions(requireHost(request)))
}

export function setSessionCookie(res: ResponseLike, token: string, request: RequestLike): void {
  setCookie(res, COOKIE_NAMES.SESSION, token, request)
}

export function clearSessionCookie(res: ResponseLike, request: RequestLike): void {
  clearCookie(res, COOKIE_NAMES.SESSION, request)
}

export function setManagerSessionCookie(res: ResponseLike, token: string, request: RequestLike): void {
  setCookie(res, COOKIE_NAMES.MANAGER_SESSION, token, request)
}

export function clearManagerSessionCookie(res: ResponseLike, request: RequestLike): void {
  clearCookie(res, COOKIE_NAMES.MANAGER_SESSION, request)
}
