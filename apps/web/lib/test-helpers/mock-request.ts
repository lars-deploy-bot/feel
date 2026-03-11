/**
 * Shared test helpers for mocking NextRequest and parsing Set-Cookie headers.
 *
 * Used by auth-related route tests (login, logout, login-manager).
 */
import { DOMAINS } from "@webalive/shared"

/**
 * Parsed cookie attributes from a Set-Cookie header.
 */
export interface CookieConfig {
  name: string
  value: string
  httpOnly: boolean
  secure: boolean
  sameSite: string | null
  path: string | null
  maxAge: number | null
  expires: string | null
}

/**
 * Parse a single Set-Cookie header string into a CookieConfig.
 * Handles expires values containing "=" correctly via substring.
 */
export function parseCookieHeader(setCookieHeader: string): CookieConfig {
  const parts = setCookieHeader.split(";").map(p => p.trim())
  const [nameValue] = parts
  const eqIndex = nameValue.indexOf("=")
  const name = nameValue.substring(0, eqIndex)
  const value = nameValue.substring(eqIndex + 1)

  const config: CookieConfig = {
    name,
    value,
    httpOnly: false,
    secure: false,
    sameSite: null,
    path: null,
    maxAge: null,
    expires: null,
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const lower = part.toLowerCase()

    if (lower === "httponly") {
      config.httpOnly = true
    } else if (lower === "secure") {
      config.secure = true
    } else if (lower.startsWith("samesite=")) {
      config.sameSite = part.split("=")[1]
    } else if (lower.startsWith("path=")) {
      config.path = part.split("=")[1]
    } else if (lower.startsWith("max-age=")) {
      config.maxAge = Number.parseInt(part.split("=")[1], 10)
    } else if (lower.startsWith("expires=")) {
      config.expires = part.substring(part.indexOf("=") + 1)
    }
  }

  return config
}

/**
 * Split a combined Set-Cookie header string into individual cookie strings.
 * Handles the tricky case where Expires values also contain ", ".
 */
export function splitSetCookieHeaders(setCookieHeader: string): string[] {
  const cookies: string[] = []
  const parts = setCookieHeader.split("; ")
  let current = ""

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const separatorMatch = part.match(/(.*),\s*([a-zA-Z_][a-zA-Z0-9_-]*)=(.*)/)

    if (separatorMatch && !separatorMatch[2].match(/^(Path|Expires|Max-Age|Domain|Secure|HttpOnly|SameSite)$/i)) {
      if (current) {
        current += "; "
      }
      current += separatorMatch[1]
      cookies.push(current.trim())
      current = `${separatorMatch[2]}=${separatorMatch[3]}`
    } else {
      if (current) {
        current += "; "
      }
      current += part
    }
  }

  if (current) {
    cookies.push(current.trim())
  }

  return cookies
}

/**
 * Create a mock NextRequest for testing route handlers.
 *
 * Supports two patterns:
 * - Standard mock with a full cookies object (for routes that access req.cookies)
 * - Cookie string builder via options.cookies record (for routes that read the Cookie header)
 */
export function createMockNextRequest(
  url: string,
  options?: RequestInit & { cookies?: Record<string, string> },
): import("next/server").NextRequest {
  const urlObj = new URL(url)
  const req = new Request(url, options) as unknown as import("next/server").NextRequest
  ;(req as unknown as Record<string, unknown>).nextUrl = urlObj
  ;(req as unknown as Record<string, unknown>).cookies = {
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => {},
    delete: () => {},
  }
  const originalGet = req.headers.get.bind(req.headers)
  req.headers.get = (name: string) => {
    if (name === "origin") return DOMAINS.STREAM_PROD
    if (name === "host") return urlObj.host
    if (name === "cookie" && options?.cookies) {
      return Object.entries(options.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")
    }
    return originalGet(name)
  }
  return req
}
