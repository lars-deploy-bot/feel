/**
 * Tunnel configuration — loaded from server-config.json at runtime.
 * No env vars. If a value is missing, throw.
 */

import { readFileSync } from "node:fs"
import { parseServerConfig, requireEnv } from "@webalive/shared"

export interface TunnelConfig {
  /** Cloudflare account ID */
  accountId: string
  /** Tunnel UUID (from `cloudflared tunnel create`) */
  tunnelId: string
  /** Cloudflare API token with Tunnel + DNS permissions */
  apiToken: string
  /** Zone ID for the domain (e.g. alive.best zone) */
  zoneId: string
  /** Base domain for sites (e.g. "alive.best") */
  baseDomain: string
}

function must(val: unknown, field: string): string {
  if (typeof val !== "string" || !val) {
    throw new Error(`Missing tunnel.${field} in server-config.json`)
  }
  return val
}

/**
 * Load tunnel config from server-config.json.
 * Reads `tunnel.accountId`, `tunnel.tunnelId`, `tunnel.apiToken`, `tunnel.zoneId`
 * and derives `baseDomain` from `domains.main`.
 */
export function loadTunnelConfig(): TunnelConfig {
  const configPath = requireEnv("SERVER_CONFIG_PATH")
  const raw = readFileSync(configPath, "utf8")
  const serverCfg = parseServerConfig(raw)

  const tunnel = (serverCfg as Record<string, unknown>).tunnel as Record<string, unknown> | undefined
  if (!tunnel) {
    throw new Error("Missing 'tunnel' section in server-config.json")
  }

  return {
    accountId: must(tunnel.accountId, "accountId"),
    tunnelId: must(tunnel.tunnelId, "tunnelId"),
    apiToken: must(tunnel.apiToken, "apiToken"),
    zoneId: must(tunnel.zoneId, "zoneId"),
    baseDomain: serverCfg.domains.main,
  }
}
