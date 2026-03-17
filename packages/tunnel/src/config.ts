/**
 * Tunnel configuration — loaded from server-config.json at runtime.
 * No env vars. If a value is missing, throw.
 */

import { readFileSync } from "node:fs"
import { parseServerConfig, requireEnv, type ServerConfig } from "@webalive/shared"
import { TunnelConfigError } from "./errors.js"

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

/**
 * Extract TunnelConfig from an already-parsed ServerConfig.
 * Use this when you already have the config to avoid double-reading.
 */
export function tunnelConfigFromServerConfig(serverCfg: ServerConfig): TunnelConfig {
  const tunnel = serverCfg.tunnel
  if (!tunnel) {
    throw new TunnelConfigError("Missing 'tunnel' section in server-config.json")
  }

  return {
    accountId: tunnel.accountId,
    tunnelId: tunnel.tunnelId,
    apiToken: tunnel.apiToken,
    zoneId: tunnel.zoneId,
    baseDomain: serverCfg.domains.main,
  }
}

/**
 * Load and parse server-config.json from SERVER_CONFIG_PATH.
 * Single place for the requireEnv → readFile → parse pattern.
 * Used by both loadTunnelConfig() and sync.ts main().
 */
export function loadServerConfig(): ServerConfig {
  const configPath = requireEnv("SERVER_CONFIG_PATH")
  const raw = readFileSync(configPath, "utf8")
  return parseServerConfig(raw)
}

/**
 * Convenience: load tunnel config directly from server-config.json.
 * Prefer tunnelConfigFromServerConfig() when you already have ServerConfig.
 */
export function loadTunnelConfig(): TunnelConfig {
  return tunnelConfigFromServerConfig(loadServerConfig())
}
