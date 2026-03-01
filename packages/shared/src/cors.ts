import { DEFAULTS, DOMAINS } from "./config.js"

export interface CorsDomainsConfig {
  main: string
  wildcard: string
}

/**
 * Check if a hostname (without protocol) is a subdomain of the given domain.
 * Prevents partial matches like "notalive.best" matching "alive.best".
 */
function isSubdomainOf(hostname: string, domain: string): boolean {
  return (
    hostname.length > domain.length + 1 &&
    hostname[hostname.length - domain.length - 1] === "." &&
    hostname.endsWith(domain)
  )
}

/**
 * Check if an origin is allowed for CORS with credentials.
 *
 * Allows:
 * - Subdomains of config.wildcard (e.g., *.alive.best)
 * - Bare config.wildcard domain
 * - Subdomains of config.main if different from wildcard (e.g., *.sonno.tech)
 * - Bare config.main domain
 * - localhost / 127.0.0.1 on any port (development)
 *
 * Rejects everything else — non-HTTP schemes, origins with ports on
 * production domains, and any domain not in the allowlist.
 */
export function checkOriginAllowed(origin: string, config: CorsDomainsConfig): boolean {
  if (!origin) return false

  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }

  // Only allow http/https schemes
  if (url.protocol !== "http:" && url.protocol !== "https:") return false

  const hostname = url.hostname

  // Allow localhost and 127.0.0.1 on any port (development)
  if (hostname === "localhost" || hostname === "127.0.0.1") return true

  // Production domains: reject origins with explicit ports (port is stripped by
  // URL.hostname, so we check if the origin had one via url.port)
  if (url.port) return false

  // Allow wildcard domain and its subdomains
  if (config.wildcard) {
    if (hostname === config.wildcard || isSubdomainOf(hostname, config.wildcard)) return true
  }

  // Allow main domain and its subdomains (when different from wildcard, e.g. sonno.tech on server 2)
  if (config.main && config.main !== config.wildcard) {
    if (hostname === config.main || isSubdomainOf(hostname, config.main)) return true
  }

  return false
}

/**
 * Check if an origin is allowed, using DOMAINS from server-config.json.
 * This is the standard entry point — use checkOriginAllowed() directly for testing.
 */
export function isAllowedOrigin(origin: string): boolean {
  return checkOriginAllowed(origin, { main: DOMAINS.MAIN, wildcard: DOMAINS.WILDCARD })
}

/**
 * Return the origin if allowed, or the fallback origin.
 * Config-injectable for testing — use getAllowedOrigin() for production.
 */
export function checkGetAllowedOrigin(
  requestOrigin: string | null,
  config: CorsDomainsConfig,
  fallback: string,
): string {
  if (requestOrigin && checkOriginAllowed(requestOrigin, config)) {
    return requestOrigin
  }
  return fallback
}

/**
 * Return the origin if allowed, or the fallback origin.
 * Uses DOMAINS and DEFAULTS from server-config.json.
 */
export function getAllowedOrigin(requestOrigin: string | null): string {
  return checkGetAllowedOrigin(
    requestOrigin,
    { main: DOMAINS.MAIN, wildcard: DOMAINS.WILDCARD },
    DEFAULTS.FALLBACK_ORIGIN,
  )
}
