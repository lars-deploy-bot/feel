import { getAllowedOrigin } from "@webalive/shared"

/**
 * Authentication and CORS guards
 */

/**
 * Check if a session cookie exists
 */
export function hasSessionCookie(cookie: unknown): cookie is { value: string } {
  if (typeof cookie !== "object" || cookie === null) {
    return false
  }
  const candidate = cookie as { value?: unknown }
  return typeof candidate.value === "string"
}

/**
 * Check if a session cookie value is valid
 */
export function isValidSessionCookie(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

/**
 * Check if a user object is valid
 */
export function hasValidUser(user: unknown): boolean {
  if (typeof user !== "object" || user === null) {
    return false
  }
  const candidate = user as { id?: unknown }
  return typeof candidate.id === "string"
}

// getAllowedOrigin re-exported from @webalive/shared for convenience
export { getAllowedOrigin }

/**
 * Check if a referer header exists and is valid
 */
export function hasValidReferer(referer: string | null): referer is string {
  return referer !== null && referer !== undefined && referer.length > 0
}

/**
 * Extract origin from referer header if available
 */
export function extractOriginFromReferer(referer: string | null): string | undefined {
  if (!hasValidReferer(referer)) {
    return undefined
  }
  const parts = referer.split("/").slice(0, 3)
  return parts.join("/")
}
