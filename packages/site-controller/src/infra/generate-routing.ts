/**
 * Generate Caddy routing configuration from database
 *
 * Reads server identity from server-config.json (via SERVER_CONFIG_PATH env var)
 * Queries database for domains assigned to this server
 * Generates Caddyfile.sites and Caddyfile.shell
 *
 * Preview domains are generated for EACH environment (production, staging, dev)
 * with auth routing to the respective environment's port.
 *
 * Usage: bun run routing:generate
 */

import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  caddySitesPath,
  isAliveWorkspace,
  parseServerConfig,
  requireAliveEnv,
  requireEnv,
  type ServerConfig,
} from "@webalive/shared"
import { assertNoDangerousCountDrop, readExistingGeneratedCaddyDomainCount } from "../generated-safety.js"
import { loadCanonicalInfraEnv } from "../infra-env.js"

interface EnvironmentConfigRaw {
  key: string
  subdomain: string
  port: number
}

interface EnvironmentConfig {
  key: string
  port: number
  domain: string
  previewBase: string
}

interface DomainRow {
  hostname: string
  port: number
}

// =============================================================================
// Helpers
// =============================================================================

function must<T>(v: T | undefined | null, msg: string): T {
  if (v === undefined || v === null) throw new Error(msg)
  return v
}

/** Narrow an untyped Supabase row into a validated DomainRow */
function toDomainRow(row: unknown): DomainRow {
  if (typeof row !== "object" || row === null || !("hostname" in row) || !("port" in row)) {
    throw new Error("Invalid domain row: missing hostname or port")
  }
  // After `in` checks, TS knows hostname and port exist on the object
  const hostname = row.hostname
  const port = row.port
  if (typeof hostname !== "string" || typeof port !== "number") {
    throw new Error(`Invalid domain row: hostname=${String(hostname)}, port=${String(port)}`)
  }
  return { hostname, port }
}

function filterReservedDomains(domains: DomainRow[], environments: EnvironmentConfig[]): DomainRow[] {
  const reservedDomains = new Set(environments.flatMap(e => [e.domain, e.previewBase]))

  return domains.filter(d => {
    if (isAliveWorkspace(d.hostname)) return false
    if (reservedDomains.has(d.hostname)) return false
    return !environments.some(e => d.hostname.endsWith(`.${e.previewBase}`))
  })
}

async function loadServerConfig(): Promise<ServerConfig> {
  const configPath = requireEnv("SERVER_CONFIG_PATH")
  const raw = await readFile(configPath, "utf8")
  return parseServerConfig(raw)
}

async function loadEnvironments(aliveRoot: string, mainDomain: string): Promise<EnvironmentConfig[]> {
  const envPath = path.join(aliveRoot, "packages/shared/environments.json")
  const raw = await readFile(envPath, "utf8")
  const envConfigRaw: unknown = JSON.parse(raw)

  function extractEnvironments(cfg: unknown): unknown[] {
    if (typeof cfg !== "object" || cfg === null || !("environments" in cfg)) return []
    const envs = cfg.environments
    if (typeof envs !== "object" || envs === null) return []
    return Object.values(envs)
  }

  function isEnvironmentConfigRaw(env: unknown): env is EnvironmentConfigRaw {
    if (typeof env !== "object" || env === null) return false
    return (
      "key" in env &&
      "port" in env &&
      "subdomain" in env &&
      typeof env.key === "string" &&
      typeof env.port === "number" &&
      typeof env.subdomain === "string"
    )
  }

  const rawEnvs = extractEnvironments(envConfigRaw).filter(isEnvironmentConfigRaw)

  if (rawEnvs.length === 0) {
    throw new Error(`No valid environments found in ${envPath}. Each needs: key, port, subdomain`)
  }

  // Derive full domains from mainDomain
  // Pattern: {subdomain}.{mainDomain} (e.g., app.sonno.tech, staging.sonno.tech)
  // PreviewBase: preview.{subdomain}.{mainDomain} (e.g., preview.app.sonno.tech)
  return rawEnvs.map(env => ({
    key: env.key,
    port: env.port,
    domain: `${env.subdomain}.${mainDomain}`,
    previewBase: `preview.${env.subdomain}.${mainDomain}`,
  }))
}

async function loadStaticEmbeddableHosts(aliveRoot: string): Promise<Set<string>> {
  const filePath = path.join(aliveRoot, "ops/caddy/embeddable-hosts.txt")
  if (!existsSync(filePath)) {
    return new Set()
  }

  const raw = await readFile(filePath, "utf8")
  const hosts = new Set<string>()

  for (const line of raw.split("\n")) {
    const trimmed = line.trim().toLowerCase()
    if (!trimmed || trimmed.startsWith("#")) continue
    hosts.add(trimmed)
  }

  return hosts
}

async function atomicWrite(filePath: string, content: string) {
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  const tmp = `${filePath}.tmp.${process.pid}`
  await writeFile(tmp, content, "utf8")
  // Rename for atomicity (works on most filesystems)
  const { rename } = await import("node:fs/promises")
  await rename(tmp, filePath)
}

// =============================================================================
// Database Query
// =============================================================================

function createAppSupabaseClient() {
  const infraEnv = loadCanonicalInfraEnv()
  const url = must(infraEnv.SUPABASE_URL, "SUPABASE_URL is required")
  const key = must(infraEnv.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY is required")

  return createClient(url, key, {
    db: { schema: "app" },
  })
}

async function queryDomains(serverId: string): Promise<DomainRow[]> {
  const supabase = createAppSupabaseClient()

  // Query domains assigned to this server
  // The user said they added server_id column via migration
  const { data, error } = await supabase
    .from("domains")
    .select("hostname, port")
    .eq("server_id", serverId)
    .is("is_test_env", false)
    .order("hostname", { ascending: true })

  if (error) {
    throw new Error(`Failed to query domains: ${error.message}`)
  }

  if (!data) return []

  return data.map(toDomainRow)
}

async function queryEmbeddableTemplateHosts(): Promise<Set<string>> {
  const supabase = createAppSupabaseClient()
  const { data, error } = await supabase.from("templates").select("preview_url").eq("is_active", true)

  if (error) {
    throw new Error(`Failed to query templates: ${error.message}`)
  }

  const hosts = new Set<string>()
  for (const row of data ?? []) {
    if (typeof row !== "object" || row === null || !("preview_url" in row)) continue
    const previewUrl = row.preview_url
    if (typeof previewUrl !== "string") continue

    try {
      const url = new URL(previewUrl)
      if (url.hostname) {
        hosts.add(url.hostname.toLowerCase())
      }
    } catch {
      console.warn(`  Skipping invalid template preview_url: ${previewUrl}`)
    }
  }

  return hosts
}

// =============================================================================
// Renderers
// =============================================================================

export function renderCaddySites(
  cfg: ServerConfig,
  environments: EnvironmentConfig[],
  domains: DomainRow[],
  embeddableHosts: Set<string>,
  aliveEnv: string,
): string {
  const filteredDomains = filterReservedDomains(domains, environments)
  const previewBase = cfg.domains.previewBase
  const embeddableOnThisServer = filteredDomains.filter(d => embeddableHosts.has(d.hostname.toLowerCase())).length
  const tlsMode = cfg.tls?.wildcardOriginCert ? "wildcard_origin_cert" : "acme_force_automate"

  const header = [
    "# GENERATED FILE - DO NOT EDIT",
    `# serverId: ${cfg.serverId}`,
    `# generated: ${new Date().toISOString()}`,
    `# domains: ${filteredDomains.length}`,
    `# embeddable_template_domains: ${embeddableOnThisServer}`,
    `# environments: ${environments.map(e => e.key).join(", ")}`,
    `# previewBase: ${previewBase || "(not configured)"}`,
    `# tls_mode: ${tlsMode}`,
    "",
    "# NOTE: Snippets (common_headers, image_serving) are imported globally",
    "# by the main Caddyfile (see ops/caddy/Caddyfile.snippets)",
    "",
  ].join("\n")

  // Generate site blocks (main domain only — preview is handled by wildcard below)
  const siteBlocks = filteredDomains
    .map(({ hostname, port }) => {
      const isEmbeddable = embeddableHosts.has(hostname.toLowerCase())
      const tlsConfigLine = renderSiteTlsConfigLine(cfg, hostname)
      return [
        `${hostname} {`,
        tlsConfigLine,
        ...(isEmbeddable ? [] : ["    import common_headers"]),
        "    import image_serving",
        "",
        "    # Serve user work files directly from disk",
        "    handle_path /files/* {",
        `        root * ${cfg.paths.sitesRoot}/${hostname}/user/.alive/files`,
        '        header Cache-Control "no-cache"',
        "        file_server",
        "    }",
        "",
        ...(isEmbeddable
          ? [
              `    # Template preview host: keep security headers but allow iframe embedding from ${cfg.domains.wildcard}`,
              "    header {",
              "        X-Content-Type-Options nosniff",
              '        X-XSS-Protection "1; mode=block"',
              "        Referrer-Policy strict-origin-when-cross-origin",
              `        Content-Security-Policy "frame-ancestors 'self' https://*.${cfg.domains.wildcard} https://${cfg.domains.wildcard}"`,
              "        -X-Frame-Options",
              "        -Server",
              "        -X-Powered-By",
              "    }",
              "",
            ]
          : []),
        `    reverse_proxy localhost:${port} {`,
        "        header_up Host {host}",
        "        header_up X-Real-IP {remote_host}",
        "        header_up X-Forwarded-For {remote_host}",
        "        header_up X-Forwarded-Proto {scheme}",
        "    }",
        "}",
      ].join("\n")
    })
    .join("\n\n")

  // Wildcard catch-all for preview subdomains (preview--{label}.{WILDCARD}).
  // Only included in production — the wildcard is a server-wide catch-all,
  // and having it in multiple env files causes a Caddy duplicate-hostname error.
  const wildcardDomain = cfg.domains.previewBase ?? cfg.domains.main
  const wildcardBlock =
    aliveEnv === "production" && wildcardDomain
      ? renderWildcardPreviewBlock(wildcardDomain, cfg.previewProxy?.port)
      : ""

  return `${header}${siteBlocks}${wildcardBlock ? `\n\n${wildcardBlock}` : ""}`
}

function renderSiteTlsConfigLine(cfg: ServerConfig, hostname: string): string {
  const wildcardOriginCert = cfg.tls?.wildcardOriginCert
  if (!wildcardOriginCert) {
    return "    tls force_automate"
  }

  const wildcardSuffix = `.${cfg.domains.wildcard}`
  const shouldUseWildcardOriginCert = hostname.endsWith(wildcardSuffix)
  if (!shouldUseWildcardOriginCert) {
    return "    tls force_automate"
  }

  return `    tls ${wildcardOriginCert.certFile} ${wildcardOriginCert.keyFile}`
}

/**
 * Generate a wildcard catch-all block for the domain.
 *
 * Routes ALL preview traffic to the Go preview-proxy which handles
 * JWT auth, port lookup, and native WebSocket support.
 *
 * Specific domain blocks take precedence over this wildcard (Caddy routes by specificity).
 * Uses single-level subdomain pattern (preview--{label}.{WILDCARD}) so that
 * Cloudflare Universal SSL covers them (it only supports one-level wildcards).
 */
function renderWildcardPreviewBlock(wildcardDomain: string, previewProxyPort?: number): string {
  if (!previewProxyPort) {
    throw new Error(
      "previewProxy.port is required in server-config.json. The legacy Next.js preview-router has been removed.",
    )
  }

  return [
    "# ============================================================================",
    `# WILDCARD CATCH-ALL (*.${wildcardDomain})`,
    `# Routes to Go preview-proxy on port ${previewProxyPort} for native WebSocket support.`,
    "# The proxy handles JWT auth, hostname→port lookup, CSP headers, and script injection.",
    "# Specific domain blocks above take precedence (Caddy routes by specificity).",
    "# On-demand TLS: Caddy gets real LE certs via the ask endpoint.",
    "# Requires tls-check API to be running on production (port 9000).",
    "# ============================================================================",
    "",
    `*.${wildcardDomain} {`,
    "    tls {",
    "        on_demand",
    "    }",
    "",
    `    reverse_proxy localhost:${previewProxyPort} {`,
    "        header_up X-Forwarded-Host {host}",
    "        header_up X-Forwarded-Proto {scheme}",
    "        header_up X-Real-IP {remote_host}",
    "        header_up X-Forwarded-For {remote_host}",
    "    }",
    "}",
    "",
  ].join("\n")
}

export function renderCaddyShell(cfg: ServerConfig): string {
  const header = [
    "# GENERATED FILE - DO NOT EDIT",
    `# serverId: ${cfg.serverId}`,
    `# generated: ${new Date().toISOString()}`,
    "",
  ].join("\n")

  if (!cfg.shell?.domains?.length) {
    return `${header}# No shell domains configured\n`
  }

  const e2bUpstream = cfg.shell.e2bUpstream ?? cfg.shell.upstream

  const blocks = cfg.shell.domains
    .map(d => {
      return [
        `${d}${cfg.shell.listen} {`,
        "    # Keep websocket terminal traffic unbuffered/untransformed through proxy chain.",
        "    @e2b_ws path /e2b/ws /e2b/ws/*",
        "    handle @e2b_ws {",
        '        header Cache-Control "no-cache, no-transform"',
        "        header X-Accel-Buffering no",
        `        reverse_proxy ${e2bUpstream} {`,
        "            stream_close_delay 5m",
        "        }",
        "    }",
        "",
        "    @ws path /ws /ws/*",
        "    handle @ws {",
        '        header Cache-Control "no-cache, no-transform"',
        "        header X-Accel-Buffering no",
        `        reverse_proxy ${cfg.shell.upstream} {`,
        "            stream_close_delay 5m",
        "        }",
        "    }",
        "",
        "    handle /e2b/* {",
        `        reverse_proxy ${e2bUpstream} {`,
        "            stream_close_delay 5m",
        "        }",
        "    }",
        "",
        "    handle {",
        `        reverse_proxy ${cfg.shell.upstream} {`,
        "            stream_close_delay 5m",
        "        }",
        "    }",
        "}",
      ].join("\n")
    })
    .join("\n\n")

  return `${header}\n${blocks}\n`
}

/**
 * Render the full Caddyfile.internal for tunnel-backed *.alive.best domains.
 *
 * Cloudflare tunnel routes *.alive.best → :8444. Infrastructure services
 * (e.g. mg.alive.best) get explicit map entries. Everything else falls
 * through to shell-server-go, which handles:
 *   - preview--* hosts (JWT auth + nav script injection)
 *   - known sites (port-map.json lookup → direct reverse proxy)
 *   - shell connections (fallback)
 *
 * Site routing is dynamic: shell-server-go refreshes port-map.json every 30s,
 * so new sites become reachable without a Caddy reload.
 */
function renderCaddyInternal(cfg: ServerConfig): string {
  const header = [
    "# GENERATED FILE - DO NOT EDIT",
    `# Generated: ${new Date().toISOString()}`,
    `# serverId: ${cfg.serverId}`,
    "# Cloudflare tunnel routes *.alive.best site traffic here on :8444",
    "# Site routing: shell-server-go dispatches via port-map.json (no per-site map entries needed)",
    "",
  ].join("\n")

  // Only infrastructure services need explicit map entries (e.g. mg.alive.best → 5090).
  // All site traffic falls through to shell-server-go which does port-map lookup.
  const serviceEntries = Object.entries(cfg.services ?? {}).map(([host, port]) => `        ${host} "localhost:${port}"`)

  const block = [
    ":8444 {",
    "    map {host} {site_upstream} {",
    ...serviceEntries,
    `        default "localhost:${cfg.previewProxy.port}"`,
    "    }",
    "",
    "    # Global image serving from /srv/webalive/storage",
    "    handle_path /_images/* {",
    "        root * /srv/webalive/storage",
    '        header Cache-Control "public, max-age=31536000, immutable"',
    "        file_server",
    "    }",
    "",
    "    # Per-site work files",
    "    handle_path /files/* {",
    "        root * /srv/webalive/sites/{host}/user/.alive/files",
    '        header Cache-Control "no-cache"',
    "        file_server",
    "    }",
    "",
    "    # Everything else: services via map, sites via shell-server-go port-map",
    "    reverse_proxy {site_upstream} {",
    "        header_up X-Forwarded-Proto https",
    "        header_up X-Forwarded-Host {host}",
    "    }",
    "}",
    "",
  ].join("\n")

  return `${header}${block}`
}

function renderNginxSniMap(cfg: ServerConfig): string {
  const header = ["# GENERATED FILE - DO NOT EDIT", `# serverId: ${cfg.serverId}`, ""].join("\n")

  if (!cfg.shell?.domains?.length) {
    return `${header}map $ssl_preread_server_name $backend {\n    default caddy_main;\n}\n`
  }

  const lines = [
    "map $ssl_preread_server_name $backend {",
    ...cfg.shell.domains.map(d => `    ${d}   caddy_shell;`),
    "    default   caddy_main;",
    "}",
    "",
  ]

  return `${header}${lines.join("\n")}`
}

// =============================================================================
// Main
// =============================================================================

async function run() {
  const aliveEnv = requireAliveEnv()
  console.log("Loading server config...")
  const cfg = await loadServerConfig()
  cfg.generated.caddySites = caddySitesPath(cfg.generated.caddySites, aliveEnv)
  console.log(`  environment: ${aliveEnv}`)
  console.log(`  serverId: ${cfg.serverId}`)
  console.log(`  aliveRoot: ${cfg.paths.aliveRoot}`)
  console.log(`  mainDomain: ${cfg.domains.main}`)
  console.log(`  previewBase: ${cfg.domains.previewBase || "(not configured)"}`)
  console.log(
    `  previewProxy: ${cfg.previewProxy ? `localhost:${cfg.previewProxy.port}` : "(not configured, using Next.js)"}`,
  )

  console.log("\nLoading environments (domains derived from server config)...")
  const environments = await loadEnvironments(cfg.paths.aliveRoot, cfg.domains.main)
  for (const env of environments) {
    console.log(`  - ${env.key}: ${env.domain} (preview: ${env.previewBase}) → localhost:${env.port}`)
  }

  console.log("\nLoading static embeddable hosts...")
  const staticEmbeddableHosts = await loadStaticEmbeddableHosts(cfg.paths.aliveRoot)
  console.log(`  Loaded ${staticEmbeddableHosts.size} static embeddable hosts`)

  console.log("\nQuerying database for domains...")
  const [domains, embeddableTemplateHosts] = await Promise.all([
    queryDomains(cfg.serverId),
    queryEmbeddableTemplateHosts(),
  ])
  const embeddableHosts = new Set([...embeddableTemplateHosts, ...staticEmbeddableHosts])
  const filteredDomains = filterReservedDomains(domains, environments)
  const embeddableOnThisServer = filteredDomains.filter(d => embeddableHosts.has(d.hostname.toLowerCase())).length
  const existingGeneratedDomainCount = readExistingGeneratedCaddyDomainCount(cfg.generated.caddySites)
  console.log(`  Found ${domains.length} domains for this server`)
  console.log(`  Found ${embeddableTemplateHosts.size} embeddable template domains (global)`)
  console.log(`  Found ${staticEmbeddableHosts.size} embeddable hosts from static allowlist`)
  console.log(`  Found ${embeddableOnThisServer} embeddable hosts on this server`)
  if (existingGeneratedDomainCount > 0) {
    console.log(`  Existing generated domain count: ${existingGeneratedDomainCount}`)
  }
  console.log(`  Will generate ${filteredDomains.length + (cfg.domains.previewBase ? 1 : 0)} blocks total`)
  console.log(`    - ${filteredDomains.length} main domain blocks`)
  if (cfg.domains.previewBase) {
    console.log(`    - 1 wildcard preview block (*.${cfg.domains.previewBase})`)
  } else {
    console.log("    - 0 preview blocks (previewBase not configured)")
  }

  console.log("\nGenerating files...")

  // Safety check: prevent accidental mass deletion of production routing.
  // Non-production environments start with 0 domains, so the check would always fail.
  if (aliveEnv === "production") {
    assertNoDangerousCountDrop({
      kind: "generated Caddy routing",
      filePath: cfg.generated.caddySites,
      existingCount: existingGeneratedDomainCount,
      nextCount: filteredDomains.length,
    })
  }

  // Ensure output directory exists
  await mkdir(cfg.generated.dir, { recursive: true })

  // Generate Caddyfile.sites
  const sites = renderCaddySites(cfg, environments, domains, embeddableHosts, aliveEnv)
  await atomicWrite(cfg.generated.caddySites, sites)
  console.log(`  ${cfg.generated.caddySites}`)

  // Internal Caddy config for tunnel-backed *.alive.best domains.
  // Every environment generates this — all sites need tunnel routing.
  // Writes to both generated dir and /etc/caddy/Caddyfile.internal.
  const caddyInternalContent = renderCaddyInternal(cfg)
  const generatedInternalPath = path.join(cfg.generated.dir, "Caddyfile.internal")
  await atomicWrite(generatedInternalPath, caddyInternalContent)
  console.log(`  ${generatedInternalPath}`)

  // Also write directly to /etc/caddy/Caddyfile.internal (live Caddy config)
  const liveInternalPath = "/etc/caddy/Caddyfile.internal"
  try {
    await atomicWrite(liveInternalPath, caddyInternalContent)
    console.log(`  ${liveInternalPath} (live)`)
  } catch (err) {
    console.warn(`  ⚠ Could not write ${liveInternalPath}: ${err instanceof Error ? err.message : err}`)
  }

  // Caddyfile.shell and nginx SNI map are server-wide shared artifacts.
  // Only production generates them — staging sites don't need shell routing.
  if (aliveEnv === "production") {
    const shell = renderCaddyShell(cfg)
    await atomicWrite(cfg.generated.caddyShell, shell)
    console.log(`  ${cfg.generated.caddyShell}`)

    const nginxMap = renderNginxSniMap(cfg)
    await atomicWrite(cfg.generated.nginxMap, nginxMap)
    console.log(`  ${cfg.generated.nginxMap}`)
  }

  console.log("\nDone!")
  console.log("\nNext steps:")
  console.log("  1. Validate: caddy validate --config /etc/caddy/Caddyfile")
  console.log("  2. Reload:   systemctl reload caddy")
  console.log("  3. Reload:   systemctl reload caddy-shell")
}

if (import.meta.main) {
  run().catch(e => {
    const msg = e.message || String(e)

    console.error("\n\x1b[31m╔══════════════════════════════════════════════════════════════╗\x1b[0m")
    console.error("\x1b[31m║                    Generation Failed                         ║\x1b[0m")
    console.error("\x1b[31m╚══════════════════════════════════════════════════════════════╝\x1b[0m")
    console.error(`\n\x1b[31mError:\x1b[0m ${msg}\n`)

    // Provide specific help based on error
    if (msg.includes("SERVER_CONFIG_PATH")) {
      console.error("\x1b[33mFix:\x1b[0m Set SERVER_CONFIG_PATH env var to point to server-config.json")
      console.error("     Example: export SERVER_CONFIG_PATH=/var/lib/alive/server-config.json")
      console.error("     Copy from: ops/server-config.example.json\n")
    } else if (msg.includes("server-config.json") || msg.includes("ENOENT")) {
      console.error("\x1b[33mFix:\x1b[0m Ensure server-config.json exists at the SERVER_CONFIG_PATH location")
      console.error("     Copy from: ops/server-config.example.json")
      console.error("     Then edit with this server's configuration\n")
    } else if (msg.includes("SUPABASE_URL")) {
      console.error("\x1b[33mFix:\x1b[0m Ensure database credentials are set in infra-env.ts source")
      console.error(
        "     Credentials are loaded from .env.production (canonical file only), not runtime environment variables",
      )
      console.error("     Check packages/site-controller/src/infra-env.ts for the canonical source\n")
    } else if (msg.includes("server_id")) {
      console.error("\x1b[33mFix:\x1b[0m Add server_id column to domains table:")
      console.error("     ALTER TABLE app.domains ADD COLUMN server_id TEXT;\n")
    } else if (msg.includes("snippets") || msg.includes("common_headers") || msg.includes("image_serving")) {
      console.error("\x1b[33mFix:\x1b[0m Ensure Caddy snippets exist in ops/caddy/snippets/")
      console.error("     Required: common_headers.caddy, image_serving.caddy\n")
    } else if (msg.includes("environments")) {
      console.error("\x1b[33mFix:\x1b[0m Ensure packages/shared/environments.json exists")
      console.error("     Each environment needs: key, port, subdomain\n")
    } else if (msg.includes("domains.main")) {
      console.error("\x1b[33mFix:\x1b[0m Add domains.main to server-config.json")
      console.error('     Example: "domains": { "main": "test.example" }\n')
    }

    console.error("Run \x1b[36mbun run --cwd packages/site-controller setup:validate\x1b[0m for full diagnostics.\n")
    process.exit(1)
  })
}
