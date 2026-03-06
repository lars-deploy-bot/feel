/**
 * Client Identification for Rate Limiting
 *
 * Extracts client IP addresses from requests, handling proxies and CDNs
 */

import type { NextRequest } from "next/server"

/**
 * Extract client IP from request headers (handles proxies/CDNs)
 *
 * @param req - Next.js request object
 * @returns IP address or 'unknown' if not available
 */
function extractClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) {
    // Can be a comma-separated chain: client, proxy1, proxy2
    for (const part of forwardedFor.split(",")) {
      const candidate = part.trim()
      if (candidate && candidate.toLowerCase() !== "unknown") {
        return candidate
      }
    }
  }

  const cfConnectingIp = req.headers.get("cf-connecting-ip")
  if (cfConnectingIp?.trim()) {
    return cfConnectingIp.trim()
  }

  const realIp = req.headers.get("x-real-ip")
  if (realIp?.trim()) {
    return realIp.trim()
  }

  // Available in some runtimes/proxies (not always populated in Next.js Node runtime).
  const requestIp = (req as NextRequest & { ip?: string | null }).ip
  if (requestIp?.trim()) {
    return requestIp.trim()
  }

  // Never fall back to host/domain: that can collapse all users into one bucket.
  return "unknown"
}

/**
 * Generate a unique client identifier for rate limiting
 *
 * Combines a namespace prefix with the client IP to create a unique key
 * for tracking rate limits across different types of operations.
 *
 * @param req - Next.js request object
 * @param namespace - Rate limiting namespace (e.g., 'oauth:linear', 'integration:github')
 * @returns Unique client identifier string
 *
 * @example
 * const clientId = getClientIdentifier(req, 'oauth:linear')
 * // Returns: 'oauth:linear:192.168.1.1'
 */
export function getClientIdentifier(req: NextRequest, namespace: string): string {
  const ip = extractClientIp(req)
  return `${namespace}:${ip}`
}
