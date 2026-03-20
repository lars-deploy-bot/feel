/**
 * Web application configuration
 *
 * Domain config comes from server-config.json via @webalive/shared.
 * Re-exports for convenience — canonical source is DOMAINS/PATHS from @webalive/shared.
 */

import { DOMAINS, PATHS } from "@webalive/shared"

export const MAIN_DOMAIN = DOMAINS.MAIN
export const WILDCARD_DOMAIN = DOMAINS.WILDCARD
export const PREVIEW_BASE = DOMAINS.PREVIEW_BASE
export const COOKIE_DOMAIN = DOMAINS.COOKIE_DOMAIN
export const WILDCARD_PATTERN = `*.${WILDCARD_DOMAIN}`
export const WORKSPACE_BASE = PATHS.SITES_ROOT

export function buildSubdomain(slug: string): string {
  return `${slug.toLowerCase()}.${WILDCARD_DOMAIN}`
}

export function isWildcardSubdomain(domain: string): boolean {
  return domain.endsWith(`.${WILDCARD_DOMAIN}`)
}

export function extractSlugFromDomain(domain: string): string | null {
  if (!isWildcardSubdomain(domain)) return null
  return domain.replace(`.${WILDCARD_DOMAIN}`, "")
}
