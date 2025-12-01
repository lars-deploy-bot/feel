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
 * Get standard cookie options for session cookies
 * Automatically handles production vs development secure flag
 *
 * Uses sameSite: "none" to allow cross-origin requests from preview iframes
 * (e.g., preview.terminal.goalive.nl embedded in terminal.goalive.nl)
 */
export function getSessionCookieOptions(): CookieOptions {
  const isDeployed = isDeployedServer()
  return {
    httpOnly: true,
    secure: isDeployed, // Required for sameSite: "none"
    sameSite: isDeployed ? "none" : "lax", // "none" allows cross-origin iframe requests
    path: "/",
    maxAge: SESSION_MAX_AGE,
    // Domain set to allow cookie on preview subdomains (*.preview.terminal.goalive.nl)
    ...(isDeployed && { domain: DOMAINS.COOKIE_DOMAIN }),
  }
}

/**
 * Get cookie options for clearing a cookie
 * Must match the original cookie's attributes except value/expiry
 */
export function getClearCookieOptions(): CookieOptions {
  const isDeployed = isDeployedServer()
  return {
    httpOnly: true,
    secure: isDeployed,
    sameSite: isDeployed ? "none" : "lax",
    path: "/",
    expires: new Date(0), // Expire immediately
    ...(isDeployed && { domain: DOMAINS.COOKIE_DOMAIN }),
  }
}
