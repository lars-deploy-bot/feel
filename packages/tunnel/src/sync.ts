#!/usr/bin/env bun
/**
 * Sync all sites from the database to the Cloudflare Tunnel.
 *
 * Reads the same DB as generate-routing.ts, but instead of writing a Caddyfile,
 * it pushes ingress rules to the tunnel API.
 *
 * Usage: bun run --cwd packages/tunnel sync
 */

import { createClient } from "@supabase/supabase-js"
import { environments, isAliveWorkspace, parseServerConfig, requireEnv, type ServerConfig } from "@webalive/shared"
import { tunnelConfigFromServerConfig } from "./config.js"
import { TunnelSyncError } from "./errors.js"
import { TunnelManager } from "./tunnel.js"

const LOG_PREFIX = "[tunnel:sync]"

function log(msg: string): void {
  process.stderr.write(`${LOG_PREFIX} ${msg}\n`)
}

interface StaticRoute {
  hostname: string
  service: string
}

function localService(port: number): string {
  return `http://localhost:${port}`
}

function buildStaticRoutes(serverCfg: ServerConfig): StaticRoute[] {
  const routes: StaticRoute[] = []

  // Environment routes (production, staging, dev) — use domain from environments source of truth
  for (const env of Object.values(environments)) {
    if (!env.domain) continue
    routes.push({ hostname: env.domain, service: localService(env.port) })
  }

  // Shell routes (WebSocket terminal)
  if (serverCfg.shell?.domains) {
    const upstreamRaw = serverCfg.shell.upstream.includes("://")
      ? serverCfg.shell.upstream
      : `http://${serverCfg.shell.upstream}`
    const upstreamUrl = new URL(upstreamRaw)
    if (!upstreamUrl.port) {
      throw new TunnelSyncError(`Invalid shell.upstream (missing port): ${serverCfg.shell.upstream}`)
    }
    const shellPort = Number.parseInt(upstreamUrl.port, 10)

    for (const domain of serverCfg.shell.domains) {
      routes.push({ hostname: domain, service: localService(shellPort) })
    }
  }

  return routes
}

async function querySiteDomains(serverCfg: ServerConfig): Promise<Map<string, number>> {
  const supabaseUrl = requireEnv("SUPABASE_URL")
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: "app" } })

  const { data, error } = await supabase
    .from("domains")
    .select("hostname, port")
    .eq("server_id", serverCfg.serverId)
    .is("is_test_env", false)
    .order("hostname", { ascending: true })

  if (error) throw new TunnelSyncError(`DB query failed: ${error.message}`)

  const sites = new Map<string, number>()
  for (const d of data) {
    if (isAliveWorkspace(d.hostname)) continue
    sites.set(d.hostname, d.port)
  }
  return sites
}

async function main() {
  const configPath = requireEnv("SERVER_CONFIG_PATH")
  const raw = await Bun.file(configPath).text()
  const serverCfg = parseServerConfig(raw)
  const tunnelCfg = tunnelConfigFromServerConfig(serverCfg)

  log(`Server: ${serverCfg.serverId}`)
  log(`Domain: ${serverCfg.domains.main}`)

  const tunnel = new TunnelManager(tunnelCfg)
  const sites = await querySiteDomains(serverCfg)
  log(`Found ${sites.size} sites`)

  const staticRoutes = buildStaticRoutes(serverCfg)
  log(`Static routes: ${staticRoutes.length}`)
  for (const r of staticRoutes) {
    log(`  ${r.hostname} → ${r.service}`)
  }

  log("Syncing to Cloudflare Tunnel...")
  const result = await tunnel.syncRoutes(sites, staticRoutes)

  log(`Done: added=${result.added.length} updated=${result.updated.length} removed=${result.removed.length}`)
  if (result.added.length > 0) {
    for (const h of result.added) log(`  + ${h}`)
  }
  if (result.updated.length > 0) {
    for (const h of result.updated) log(`  ~ ${h}`)
  }
  if (result.removed.length > 0) {
    for (const h of result.removed) log(`  - ${h}`)
  }
  if (result.dnsErrors.length > 0) {
    log(`DNS errors (${result.dnsErrors.length}):`)
    for (const e of result.dnsErrors) log(`  ! ${e}`)
    process.exitCode = 1
  }
}

main().catch((e: unknown) => {
  if (e instanceof Error) {
    process.stderr.write(`${LOG_PREFIX} FATAL: ${e.message}\n`)
    if (e.stack) {
      process.stderr.write(`${e.stack}\n`)
    }
  } else {
    process.stderr.write(`${LOG_PREFIX} FATAL: ${String(e)}\n`)
  }
  process.exit(1)
})
