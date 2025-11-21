/**
 * Cookie Configuration
 *
 * Cookie names and session config imported from @webalive/shared (single source of truth).
 * This file provides cookie options helpers for Next.js.
 */

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
}

/**
 * Get standard cookie options for session cookies
 * Automatically handles production vs development secure flag
 */
export function getSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  }
}

/**
 * Get cookie options for clearing a cookie
 * Must match the original cookie's attributes except value/expiry
 */
export function getClearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0), // Expire immediately
  }
}
