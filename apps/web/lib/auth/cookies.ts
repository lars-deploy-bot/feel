/**
 * Cookie Configuration
 *
 * Cookie names and session config imported from @webalive/shared (single source of truth).
 * This file provides cookie options helpers for Next.js.
 */

import { COOKIE_NAMES, DOMAINS, SESSION_MAX_AGE } from "@webalive/shared"

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

/**
 * Check if running on a deployed server (dev/staging/production)
 * Local development uses BRIDGE_ENV=local
 *
 * All deployed servers (dev/staging/prod) run on *.terminal.goalive.nl
 * and need cross-origin cookie support for preview iframes.
 */
function isDeployedServer(): boolean {
  // BRIDGE_ENV=local means local development (localhost)
  // All other environments (dev, staging, production) are deployed servers
  return process.env.BRIDGE_ENV !== "local"
}

/**
 * Get cookie domain based on request host
 * Supports multiple domains: terminal.goalive.nl, alive.best
 */
function getCookieDomain(host?: string): string | undefined {
  if (!host) return DOMAINS.COOKIE_DOMAIN

  // alive.best and subdomains
  if (host.endsWith("alive.best") || host === "alive.best") {
    return ".alive.best"
  }

  // terminal.goalive.nl and subdomains (default)
  return DOMAINS.COOKIE_DOMAIN
}

/**
 * Get standard cookie options for session cookies
 * Automatically handles production vs development secure flag
 *
 * Uses sameSite: "lax" for mobile browser compatibility.
 * "none" causes issues on mobile Safari due to ITP (Intelligent Tracking Prevention).
 * "lax" works for same-origin requests and top-level navigations.
 *
 * @param host - Optional request host to determine cookie domain
 */
export function getSessionCookieOptions(host?: string): CookieOptions {
  const isDeployed = isDeployedServer()
  return {
    httpOnly: true,
    secure: isDeployed,
    // "none" required for iframe preview auth (cross-origin subresource requests)
    // Safari ITP issue was mitigated by cookie name change (auth_session_v2)
    // If Safari breaks again, implement preview-specific token auth
    sameSite: isDeployed ? "none" : "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    // Domain set dynamically based on request host
    ...(isDeployed && { domain: getCookieDomain(host) }),
  }
}

/**
 * Get cookie options for clearing a cookie
 * Must match the original cookie's attributes except value/expiry
 *
 * @param host - Optional request host to determine cookie domain
 */
export function getClearCookieOptions(host?: string): CookieOptions {
  const isDeployed = isDeployedServer()
  return {
    httpOnly: true,
    secure: isDeployed,
    sameSite: isDeployed ? "none" : "lax", // Must match getSessionCookieOptions
    path: "/",
    expires: new Date(0), // Expire immediately
    ...(isDeployed && { domain: getCookieDomain(host) }),
  }
}
