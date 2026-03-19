import { dirname, join } from "node:path"

/**
 * Require ALIVE_ENV to be set. No fallbacks.
 *
 * Used by routing generator, sync script, deploy pipeline verification,
 * and tests — every caller that needs environment-aware Caddy artifact paths.
 */
export function requireAliveEnv(): string {
  const env = process.env.ALIVE_ENV
  if (!env) {
    throw new Error("ALIVE_ENV is required")
  }
  return env
}

/**
 * Derive the environment-specific Caddyfile.sites path from the base path
 * in server-config.json (`generated.caddySites`).
 *
 * production → /var/lib/alive/generated/Caddyfile.sites
 * staging    → /var/lib/alive/generated/Caddyfile.staging-sites
 *
 * Each environment generates its own file from its own DB.
 * Shared Caddy imports all of them.
 */
export function caddySitesPath(basePath: string, aliveEnv: string): string {
  if (aliveEnv === "production") return basePath
  return join(dirname(basePath), `Caddyfile.${aliveEnv}-sites`)
}

/**
 * Derive the filtered Caddyfile path for an environment.
 *
 * production → /var/lib/alive/generated/Caddyfile.sites.filtered
 * staging    → /var/lib/alive/generated/Caddyfile.staging-sites.filtered
 */
export function caddySitesFilteredPath(basePath: string, aliveEnv: string): string {
  return `${caddySitesPath(basePath, aliveEnv)}.filtered`
}
