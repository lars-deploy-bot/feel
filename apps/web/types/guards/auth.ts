import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Authentication and CORS guards
 */

/**
 * Check if a session cookie exists
 */
export function hasSessionCookie(cookie: any): boolean {
  return cookie !== undefined && cookie !== null
}

/**
 * Check if a session cookie value is valid
 */
export function isValidSessionCookie(value: any): value is string {
  return typeof value === "string" && value.length > 0
}

/**
 * Check if a user object is valid
 */
export function hasValidUser(user: any): boolean {
  return user !== null && user !== undefined && typeof user.id === "string"
}

/**
 * Check if an origin is allowed based on allowed domains file
 */
export function isOriginInAllowedDomains(origin: string): boolean {
  try {
    const domainsFile = join(process.cwd(), "allowed-domains.json")

    if (existsSync(domainsFile)) {
      const allowedDomains = JSON.parse(readFileSync(domainsFile, "utf8"))
      return Array.isArray(allowedDomains) && allowedDomains.includes(origin)
    }
  } catch (error) {
    console.warn("Failed to read allowed domains file:", error)
  }

  return false
}

/**
 * Check if an origin matches the allowed domain pattern (.goalive.nl)
 */
export function isOriginGoaliveNLDomain(origin: string): boolean {
  return origin.endsWith(".goalive.nl")
}

/**
 * Check if an origin is allowed (file check + fallback pattern check)
 */
export function isOriginAllowed(origin: string): boolean {
  return isOriginInAllowedDomains(origin) || isOriginGoaliveNLDomain(origin)
}

/**
 * Get the allowed origin for CORS response
 * Returns matched origin or sensible fallback
 */
export function getAllowedOrigin(requestOrigin: string | null): string {
  const fallback = "https://terminal.goalive.nl"

  if (!requestOrigin) {
    return fallback
  }

  if (isOriginAllowed(requestOrigin)) {
    return requestOrigin
  }

  return fallback
}

/**
 * Check if an origin is null/undefined
 */
export function hasOrigin(origin: string | null): origin is string {
  return origin !== null && origin !== undefined && origin.length > 0
}

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
