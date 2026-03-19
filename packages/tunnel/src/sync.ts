#!/usr/bin/env bun

/**
 * Sync all sites from the database to the Cloudflare Tunnel + generate Caddyfile.internal.
 *
 * Single source of truth for routing: reads DB + environments + infrastructure services,
 * pushes ingress rules to the tunnel API, generates the internal Caddy host→port map,
 * validates, and reloads Caddy.
 *
 * Caddy write + rollback: if validation or reload fails, restores the backup and
 * re-pushes the previous tunnel ingress.
 *
 * Usage: bun run --cwd packages/tunnel sync
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  FLOW                                                           │
 * │                                                                 │
 * │  1. Read server-config.json                                     │
 * │  2. Query site domains from Supabase                            │
 * │  3. Build static routes (environments + shell + infra services) │
 * │  4. Push ingress to Cloudflare Tunnel (syncRoutes)              │
 * │  5. Generate Caddyfile.internal from same data                  │
 * │  6. Validate → Write → Reload Caddy (with rollback on failure)  │
 * └──────────────────────────────────────────────────────────────────┘
 */

import { execSync } from "node:child_process"
import { copyFileSync, existsSync, writeFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import {
  environments,
  INFRASTRUCTURE_SERVICES,
  type InfrastructureService,
  isAliveWorkspace,
  requireEnv,
  type ServerConfig,
} from "@webalive/shared"
import { loadServerConfig, tunnelConfigFromServerConfig } from "./config.js"
import { errorMsg, TunnelSyncError } from "./errors.js"
import { type IngressRule, localService, TunnelManager } from "./tunnel.js"

const LOG_PREFIX = "[tunnel:sync]"

/** Minimum number of sites from DB before we proceed. Prevents catastrophic route wipe. */
const MIN_EXPECTED_SITES = 10

/** Path to the internal Caddy config file (host→port map for tunnel-backed sites). */
const CADDY_INTERNAL_PATH = "/etc/caddy/Caddyfile.internal"

/** Hostname must be a valid DNS label sequence (prevents Caddy config injection). */
const HOSTNAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/

function log(msg: string): void {
  process.stderr.write(`${LOG_PREFIX} ${msg}\n`)
}

function buildStaticRoutes(serverCfg: ServerConfig): IngressRule[] {
  const routes: IngressRule[] = []

  // Environment routes (production, staging, dev) — direct to port
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

  // Infrastructure services (widget, manager, OpenClaw, etc.)
  const baseDomain = serverCfg.domains.main
  for (const svc of INFRASTRUCTURE_SERVICES) {
    routes.push({ hostname: `${svc.subdomain}.${baseDomain}`, service: localService(svc.port) })
  }

  return routes
}

interface SiteDomainRow {
  hostname: string
  port: number
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
    .returns<SiteDomainRow[]>()

  if (error) throw new TunnelSyncError(`DB query failed: ${error.message}`)

  const sites = new Map<string, number>()
  for (const d of data) {
    if (isAliveWorkspace(d.hostname)) continue
    sites.set(d.hostname, d.port)
  }
  return sites
}

// ---------------------------------------------------------------------------
// Caddyfile.internal generation
// ---------------------------------------------------------------------------

function isValidHostname(hostname: string): boolean {
  return HOSTNAME_REGEX.test(hostname)
}

/**
 * Pure function: generate the content of Caddyfile.internal.
 *
 * Takes all data as arguments — no side effects, no global imports.
 * This is the ONLY way Caddyfile.internal should be produced — never edit it manually.
 */
function generateCaddyInternal(
  sites: Map<string, number>,
  infraServices: ReadonlyArray<InfrastructureService>,
  previewProxyPort: number,
  baseDomain: string,
  onInvalidHostname?: (hostname: string) => void,
): string {
  const lines: string[] = [
    "# AUTO-GENERATED by packages/tunnel/src/sync.ts — DO NOT EDIT MANUALLY",
    "# Regenerate: bun run --cwd packages/tunnel sync",
    "#",
    "# Internal Caddy — image serving + reverse proxy for tunnel-backed sites",
    `# cloudflared routes *.${baseDomain} site traffic here on :8444`,
    "# This layer intercepts /_images/* and /files/* before proxying to the site.",
    "",
    ":8444 {",
    "    map {host} {site_upstream} {",
  ]

  // Wildcard entry first (Caddy map uses first-match, but explicit hostnames take precedence)
  lines.push(`        *.${baseDomain} "localhost:${previewProxyPort}"`)

  // Site domains
  const sortedSites = [...sites.entries()].sort(([a], [b]) => a.localeCompare(b))
  for (const [hostname, port] of sortedSites) {
    if (!isValidHostname(hostname)) {
      onInvalidHostname?.(hostname)
      continue
    }
    lines.push(`        ${hostname} "localhost:${port}"`)
  }

  // Infrastructure services: direct services get a map entry as fallback
  // (in case traffic arrives at :8444 via wildcard instead of direct tunnel route)
  for (const svc of infraServices) {
    if (svc.routeVia === "caddy") continue
    const infraHostname = `${svc.subdomain}.${baseDomain}`
    if (!isValidHostname(infraHostname)) continue
    lines.push(`        ${infraHostname} "localhost:${svc.port}"`)
  }

  lines.push(`        default "localhost:${previewProxyPort}"`)
  lines.push("    }")
  lines.push("")
  lines.push("    # Global image serving from /srv/webalive/storage")
  lines.push("    handle_path /_images/* {")
  lines.push("        root * /srv/webalive/storage")
  lines.push('        header Cache-Control "public, max-age=31536000, immutable"')
  lines.push("        file_server")
  lines.push("    }")
  lines.push("")
  lines.push("    # Per-site work files")
  lines.push("    handle_path /files/* {")
  lines.push("        root * /srv/webalive/sites/{host}/user/.alive/files")
  lines.push('        header Cache-Control "no-cache"')
  lines.push("        file_server")
  lines.push("    }")
  lines.push("")
  lines.push("    # Everything else goes to the site's dev server")
  lines.push("    reverse_proxy {site_upstream}")
  lines.push("}")
  lines.push("")

  return lines.join("\n")
}

/**
 * Write Caddyfile.internal, validate, and reload Caddy.
 * On failure: restore backup and throw.
 */
const EXEC_OPTS: { stdio: ["pipe", "pipe", "pipe"]; timeout: number } = {
  stdio: ["pipe", "pipe", "pipe"],
  timeout: 15_000,
}

function writeCaddyWithRollback(content: string): void {
  const backupPath = `${CADDY_INTERNAL_PATH}.backup`

  const restoreBackup = () => {
    if (existsSync(backupPath)) copyFileSync(backupPath, CADDY_INTERNAL_PATH)
  }

  // 1. Backup current file (if it exists)
  if (existsSync(CADDY_INTERNAL_PATH)) {
    copyFileSync(CADDY_INTERNAL_PATH, backupPath)
  }

  // 2. Write new content
  writeFileSync(CADDY_INTERNAL_PATH, content, "utf8")

  // 3. Validate
  try {
    execSync("caddy validate --config /etc/caddy/Caddyfile", EXEC_OPTS)
  } catch (err) {
    log("ERROR: Caddy validation failed — rolling back Caddyfile.internal")
    restoreBackup()
    throw new TunnelSyncError(`Caddy validation failed: ${errorMsg(err)}`)
  }

  // 4. Reload
  try {
    execSync("systemctl reload caddy", EXEC_OPTS)
  } catch (err) {
    log("ERROR: Caddy reload failed — rolling back Caddyfile.internal")
    restoreBackup()
    try {
      execSync("systemctl reload caddy", EXEC_OPTS)
    } catch {
      log("ERROR: Caddy reload of backup also failed — manual intervention required")
    }
    throw new TunnelSyncError(`Caddy reload failed: ${errorMsg(err)}`)
  }

  log("Caddy validated and reloaded successfully")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const serverCfg = loadServerConfig()
  const tunnelCfg = tunnelConfigFromServerConfig(serverCfg)

  log(`Server: ${serverCfg.serverId}`)
  log(`Domain: ${serverCfg.domains.main}`)

  const tunnel = new TunnelManager(tunnelCfg)
  const sites = await querySiteDomains(serverCfg)
  log(`Found ${sites.size} sites`)

  // Safety guard: abort if DB returned suspiciously few sites
  if (sites.size < MIN_EXPECTED_SITES) {
    throw new TunnelSyncError(
      `Only ${sites.size} sites found (minimum: ${MIN_EXPECTED_SITES}). ` +
        "Aborting to prevent catastrophic route wipe. If this is expected, lower MIN_EXPECTED_SITES.",
    )
  }

  const staticRoutes = buildStaticRoutes(serverCfg)
  log(`Static routes: ${staticRoutes.length}`)
  for (const r of staticRoutes) {
    log(`  ${r.hostname} → ${r.service}`)
  }

  // Save current ingress for rollback in case Caddy fails
  let previousIngress: IngressRule[] | undefined
  try {
    previousIngress = await tunnel.getIngress()
  } catch {
    log("WARNING: Could not fetch current ingress for rollback — proceeding without backup")
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

  // Generate and write Caddyfile.internal
  const previewProxyPort = serverCfg.previewProxy.port
  const caddyContent = generateCaddyInternal(
    sites,
    INFRASTRUCTURE_SERVICES,
    previewProxyPort,
    serverCfg.domains.main,
    h => log(`WARNING: Skipping invalid hostname for Caddy config: ${h}`),
  )
  log(`Generated Caddyfile.internal: ${sites.size} site entries`)

  try {
    writeCaddyWithRollback(caddyContent)
  } catch (caddyErr) {
    // Caddy write/reload failed — try to roll back tunnel ingress too
    if (previousIngress) {
      log("Rolling back tunnel ingress to previous state...")
      try {
        await tunnel.syncRoutes(new Map(), previousIngress)
        log("Tunnel ingress rolled back successfully")
      } catch (rollbackErr) {
        log(`ERROR: Tunnel rollback also failed: ${errorMsg(rollbackErr)}`)
      }
    }
    throw caddyErr
  }
}

// Only run main() when executed as a script, not when imported for testing
if (import.meta.main) {
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
}

// Exported for testing
export { buildStaticRoutes, generateCaddyInternal, HOSTNAME_REGEX, isValidHostname, MIN_EXPECTED_SITES }
