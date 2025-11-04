/**
 * Central configuration for the Claude Bridge application
 *
 * This file contains all constants and configuration values used across the app.
 * Centralizing these values makes the codebase more maintainable and easier to update.
 */

/**
 * The wildcard domain used for subdomain deployments
 * All deployed sites will be subdomains of this domain (e.g., mysite.alive.best)
 *
 * This can be overridden with the WILDCARD_TLD environment variable
 */
export const WILDCARD_DOMAIN = process.env.WILDCARD_TLD || "alive.best"

/**
 * The full wildcard pattern for DNS/routing
 */
export const WILDCARD_PATTERN = `*.${WILDCARD_DOMAIN}`

/**
 * Base path for site workspaces
 */
export const WORKSPACE_BASE = process.env.WORKSPACE_BASE || "/srv/webalive/sites"

/**
 * Build a full subdomain URL from a slug
 * @param slug - The subdomain slug (e.g., "myapp")
 * @returns Full domain (e.g., "myapp.alive.best")
 */
export function buildSubdomain(slug: string): string {
  return `${slug}.${WILDCARD_DOMAIN}`
}

/**
 * Check if a domain is a subdomain of the wildcard domain
 * @param domain - The domain to check
 * @returns true if it's a subdomain of the wildcard domain
 */
export function isWildcardSubdomain(domain: string): boolean {
  return domain.endsWith(`.${WILDCARD_DOMAIN}`)
}

/**
 * Extract slug from a wildcard subdomain
 * @param domain - The full domain (e.g., "myapp.alive.best")
 * @returns The slug (e.g., "myapp") or null if not a wildcard subdomain
 */
export function extractSlugFromDomain(domain: string): string | null {
  if (!isWildcardSubdomain(domain)) return null
  return domain.replace(`.${WILDCARD_DOMAIN}`, "")
}
