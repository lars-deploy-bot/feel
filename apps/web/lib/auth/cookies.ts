/**
 * Cookie Configuration - Single Source of Truth
 *
 * All cookie names and configurations defined here.
 * DO NOT duplicate cookie config anywhere else.
 */

type CookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "lax" | "strict" | "none"
  path?: string
  maxAge?: number
  expires?: Date
}

// Cookie Names
export const COOKIE_NAMES = {
  SESSION: "auth_session",
  MANAGER_SESSION: "manager_session",
} as const

// Cookie Expiry
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

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
