import { dirname, join } from "node:path"

/**
 * Require STREAM_ENV to be set. No fallbacks.
 *
 * Used by routing generator, sync script, deploy pipeline verification,
 * and tests — every caller that needs environment-aware Caddy artifact paths.
 */
export function requireStreamEnv(): string {
  const env = process.env.STREAM_ENV
  if (!env) {
    throw new Error("STREAM_ENV is required")
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
export function caddySitesPath(basePath: string, streamEnv: string): string {
  if (streamEnv === "production") return basePath
  return join(dirname(basePath), `Caddyfile.${streamEnv}-sites`)
}

/**
 * Derive the filtered Caddyfile path for an environment.
 *
 * production → /var/lib/alive/generated/Caddyfile.sites.filtered
 * staging    → /var/lib/alive/generated/Caddyfile.staging-sites.filtered
 */
export function caddySitesFilteredPath(basePath: string, streamEnv: string): string {
  return `${caddySitesPath(basePath, streamEnv)}.filtered`
}
