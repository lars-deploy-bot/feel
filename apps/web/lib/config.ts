export const WILDCARD_DOMAIN = process.env.WILDCARD_TLD || "alive.best"
export const WILDCARD_PATTERN = `*.${WILDCARD_DOMAIN}`
export const WORKSPACE_BASE = process.env.WORKSPACE_BASE || "/srv/webalive/sites"

export function buildSubdomain(slug: string): string {
  return `${slug}.${WILDCARD_DOMAIN}`
}

export function isWildcardSubdomain(domain: string): boolean {
  return domain.endsWith(`.${WILDCARD_DOMAIN}`)
}

export function extractSlugFromDomain(domain: string): string | null {
  if (!isWildcardSubdomain(domain)) return null
  return domain.replace(`.${WILDCARD_DOMAIN}`, "")
}
