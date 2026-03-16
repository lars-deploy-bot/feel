#!/usr/bin/env bun
/**
 * Sync all sites from the database to the Cloudflare Tunnel.
 *
 * Reads the same DB as generate-routing.ts, but instead of writing a Caddyfile,
 * it pushes ingress rules to the tunnel API.
 *
 * Usage: bun run --cwd packages/tunnel sync
 */

import { readFile } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import { isAliveWorkspace, parseServerConfig, requireEnv } from "@webalive/shared"
import { loadTunnelConfig } from "./config.js"
import { TunnelManager } from "./tunnel.js"

interface DomainRow {
  hostname: string
  port: number
}

async function main() {
  // Load server config (same as generate-routing.ts)
  const configPath = requireEnv("SERVER_CONFIG_PATH")
  const raw = await readFile(configPath, "utf8")
  const serverCfg = parseServerConfig(raw)

  console.log(`Server: ${serverCfg.serverId}`)
  console.log(`Domain: ${serverCfg.domains.main}`)

  // Load tunnel config from server-config.json
  const tunnelCfg = loadTunnelConfig()
  const tunnel = new TunnelManager(tunnelCfg)

  // Query domains from DB (same query as generate-routing.ts)
  const supabaseUrl = requireEnv("SUPABASE_URL")
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: "app" } })

  const { data, error } = await supabase
    .from("domains")
    .select("hostname, port")
    .eq("server_id", serverCfg.serverId)
    .is("is_test_env", false)
    .order("hostname", { ascending: true })

  if (error) throw new Error(`DB query failed: ${error.message}`)
  const domains: DomainRow[] = data ?? []

  // Filter reserved domains (same logic as generate-routing.ts)
  const sites = new Map<string, number>()
  for (const d of domains) {
    if (isAliveWorkspace(d.hostname)) continue
    sites.set(d.hostname, d.port)
  }

  console.log(`\nFound ${sites.size} sites to sync`)

  // Static routes: app environments, shell, etc.
  // These are the "infrastructure" routes that don't come from the DB.
  const envPath = `${serverCfg.paths.aliveRoot}/packages/shared/environments.json`
  const envRaw = await readFile(envPath, "utf8")
  const envConfig = JSON.parse(envRaw)

  const staticRoutes: Array<{ hostname: string; service: string }> = []

  // Environment routes (production, staging, dev)
  for (const env of Object.values(envConfig.environments)) {
    if (
      !env ||
      typeof env !== "object" ||
      !("subdomain" in env) ||
      typeof env.subdomain !== "string" ||
      env.subdomain.length === 0
    ) {
      throw new Error("Invalid environments.json: missing subdomain for tunnel static route")
    }
    if (!("port" in env) || typeof env.port !== "number") {
      throw new Error("Invalid environments.json: missing numeric port for tunnel static route")
    }
    const hostname = `${env.subdomain}.${serverCfg.domains.main}`
    staticRoutes.push({ hostname, service: `http://localhost:${env.port}` })
  }

  // Shell routes (WebSocket terminal)
  if (serverCfg.shell?.domains) {
    const upstreamRaw = serverCfg.shell.upstream.includes("://")
      ? serverCfg.shell.upstream
      : `http://${serverCfg.shell.upstream}`
    const upstreamUrl = new URL(upstreamRaw)
    if (!upstreamUrl.port) {
      throw new Error(`Invalid shell.upstream (missing port): ${serverCfg.shell.upstream}`)
    }
    const shellPort = Number.parseInt(upstreamUrl.port, 10)

    for (const domain of serverCfg.shell.domains) {
      staticRoutes.push({
        hostname: domain,
        service: `http://localhost:${shellPort}`,
      })
    }
  }

  console.log(`Static routes: ${staticRoutes.length}`)
  for (const r of staticRoutes) {
    console.log(`  ${r.hostname} → ${r.service}`)
  }

  // Sync to tunnel
  console.log("\nSyncing to Cloudflare Tunnel...")
  const result = await tunnel.syncRoutes(sites, staticRoutes)

  console.log("\nDone:")
  console.log(`  Added:   ${result.added.length}`)
  console.log(`  Updated: ${result.updated.length}`)
  console.log(`  Removed: ${result.removed.length}`)

  if (result.added.length > 0) {
    console.log("\n  Added routes:")
    for (const h of result.added) console.log(`    + ${h}`)
  }
  if (result.updated.length > 0) {
    console.log("\n  Updated routes:")
    for (const h of result.updated) console.log(`    ~ ${h}`)
  }
  if (result.removed.length > 0) {
    console.log("\n  Removed routes:")
    for (const h of result.removed) console.log(`    - ${h}`)
  }
}

main().catch(e => {
  console.error(`\nSync failed: ${e.message}`)
  process.exit(1)
})
