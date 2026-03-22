import { exec } from "node:child_process"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import * as Sentry from "@sentry/nextjs"
import { DEFAULTS, PATHS, TIMEOUTS } from "@webalive/shared"
import type { NextRequest } from "next/server"
import { requireManagerAuth } from "@/features/manager/lib/api-helpers"
import { createCorsErrorResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { getAllDomains } from "@/lib/deployment/domain-registry"
import { ErrorCodes } from "@/lib/error-codes"
import type { DomainStatus } from "@/types/domain"

const execAsync = promisify(exec)

// ---------------------------------------------------------------------------
// Batched lookups — run once, shared across all domains
// ---------------------------------------------------------------------------

/** Parse `ss -ln` output into a set of listening ports (1 shell spawn for all domains) */
async function getListeningPorts(): Promise<Set<number>> {
  try {
    const { stdout } = await execAsync("ss -tlnH")
    const ports = new Set<number>()
    for (const line of stdout.split("\n")) {
      // Match the local address:port column (e.g. *:3352, 0.0.0.0:8998, [::]:443)
      const match = line.match(/:(\d+)\s/)
      if (match) ports.add(Number.parseInt(match[1], 10))
    }
    return ports
  } catch (_err) {
    return new Set()
  }
}

/** Read Caddyfile once and extract configured domains (1 file read for all domains) */
async function getCaddyDomains(): Promise<Set<string>> {
  try {
    const content = await readFile(PATHS.CADDYFILE_PATH, "utf-8")
    const domains = new Set<string>()
    for (const line of content.split("\n")) {
      const match = line.match(/^(\S+)\s*\{/)
      if (match) domains.add(match[1])
    }
    return domains
  } catch (_err) {
    return new Set()
  }
}

/** List all site@* units and their states (1 shell spawn for all domains) */
async function getSystemdServiceStates(): Promise<Map<string, { exists: boolean; running: boolean }>> {
  const states = new Map<string, { exists: boolean; running: boolean }>()
  try {
    const { stdout } = await execAsync(
      "systemctl list-units 'site@*.service' --all --no-legend --plain 2>/dev/null || true",
    )
    for (const line of stdout.split("\n")) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 4) continue
      // unit, load, active, sub
      const unit = parts[0]
      const active = parts[2]
      // Extract domain slug from site@slug.service
      const slugMatch = unit.match(/^site@(.+)\.service$/)
      if (slugMatch) {
        const slug = slugMatch[1]
        states.set(slug, { exists: true, running: active === "active" })
      }
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { check: "systemd-batch" } })
  }
  return states
}

// ---------------------------------------------------------------------------
// Per-domain checks (only for things that MUST be per-domain)
// ---------------------------------------------------------------------------

async function checkHttpAccessible(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUTS.HTTP_REQUEST)

    const response = await fetch(`http://${domain}`, {
      signal: controller.signal,
      redirect: "manual",
    })

    clearTimeout(timeout)
    return response.status < 500
  } catch (_err) {
    return false
  }
}

async function checkHttpsAccessible(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUTS.HTTP_REQUEST)

    const response = await fetch(`https://${domain}`, {
      signal: controller.signal,
      redirect: "manual",
    })

    clearTimeout(timeout)
    return response.status < 500
  } catch (_err) {
    return false
  }
}

async function checkDnsResolution(
  domain: string,
  serverIp: string,
): Promise<{ pointsToServer: boolean; resolvedIp: string | null; isProxied?: boolean; verificationMethod?: string }> {
  try {
    const { stdout } = await execAsync(`host -t A ${domain} 2>/dev/null || echo "NXDOMAIN"`)

    let resolvedIp: string | null = null
    if (!stdout.includes("NXDOMAIN") && !stdout.includes("not found")) {
      const match = stdout.match(/has address\s+(\d+\.\d+\.\d+\.\d+)/)
      if (match) resolvedIp = match[1]
    }

    const verificationPath = "/.well-known/alive-verify.txt"

    for (const protocol of ["https", "http"]) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), TIMEOUTS.HTTP_REQUEST)

        const response = await fetch(`${protocol}://${domain}${verificationPath}`, {
          signal: controller.signal,
          redirect: "follow",
        })

        clearTimeout(timeout)

        if (response.ok) {
          const content = (await response.text()).trim()
          const pointsToServer = content === serverIp
          const isProxied = resolvedIp !== null && resolvedIp !== serverIp

          return { pointsToServer, resolvedIp, isProxied, verificationMethod: protocol }
        }
      } catch (_err) {
        // Expected: verification endpoint may be unreachable
      }
    }

    const directMatch = resolvedIp === serverIp
    return {
      pointsToServer: directMatch,
      resolvedIp,
      isProxied: false,
      verificationMethod: directMatch ? "direct-ip" : "none",
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { check: "dns-resolution" } })
    return { pointsToServer: false, resolvedIp: null, verificationMethod: "error" }
  }
}

/** Check serve mode using direct file reads instead of spawning cat */
function checkServeMode(domain: string): "dev" | "build" | "unknown" {
  const slug = domain.replace(/\./g, "-")
  const serviceDir = `/etc/systemd/system/site@${slug}.service.d`
  for (const file of ["serve-mode.conf", "override.conf"]) {
    try {
      // Use require("fs").readFileSync — this is admin-only, sync is fine for small config files
      const content = require("node:fs").readFileSync(`${serviceDir}/${file}`, "utf-8")
      if (content.includes("preview") || content.includes("bun run start")) return "build"
      if (content.includes("bun run dev")) return "dev"
    } catch (_err) {
      // File doesn't exist, try next
    }
  }
  return "dev"
}

/** Check vite config port using direct file reads instead of spawning test/grep */
function checkViteConfigPort(
  domain: string,
  expectedPort: number,
): { mismatch: boolean; actualPort: number | null; hasSystemdOverride: boolean } {
  try {
    const sitePath = `${PATHS.SITES_ROOT}/${domain}`
    const slug = domain.replace(/[^a-zA-Z0-9]/g, "-")

    const hasSystemdOverride = existsSync(`/etc/systemd/system/site@${slug}.service.d/port-override.conf`)

    // Try vite.config.ts then .js
    let configContent: string | null = null
    for (const ext of ["ts", "js"]) {
      const configPath = `${sitePath}/user/vite.config.${ext}`
      try {
        configContent = require("node:fs").readFileSync(configPath, "utf-8")
        break
      } catch (_err) {
        // Try next extension
      }
    }

    if (!configContent) {
      return { mismatch: hasSystemdOverride, actualPort: null, hasSystemdOverride }
    }

    const match = configContent.match(/port:\s*(\d+)/)
    if (!match) {
      return { mismatch: hasSystemdOverride, actualPort: null, hasSystemdOverride }
    }

    const actualPort = Number.parseInt(match[1], 10)
    return { mismatch: actualPort !== expectedPort || hasSystemdOverride, actualPort, hasSystemdOverride }
  } catch (err) {
    Sentry.captureException(err, { tags: { check: "vite-config-port" } })
    return { mismatch: false, actualPort: null, hasSystemdOverride: false }
  }
}

function checkSiteDirectory(domain: string): boolean {
  return existsSync(`${PATHS.SITES_ROOT}/${domain}`) || existsSync(`${PATHS.SITES_ROOT}/${domain.replace(/\./g, "-")}`)
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  const authError = await requireManagerAuth()
  if (authError) {
    return authError
  }

  const domains = await getAllDomains()
  const serverIp = DEFAULTS.SERVER_IP
  if (!serverIp) {
    return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, {
      details: { reason: "SERVER_IP not configured" },
    })
  }

  // Run batched lookups once (3 operations instead of 3 × N)
  const [listeningPorts, caddyDomains, systemdStates] = await Promise.all([
    getListeningPorts(),
    getCaddyDomains(),
    getSystemdServiceStates(),
  ])

  // Per-domain: only network checks (HTTP/HTTPS/DNS) still need individual calls
  const checks = domains.map(async domainInfo => {
    const domain = domainInfo.hostname
    const port = domainInfo.port
    const slug = domain.replace(/\./g, "-")

    // These are instant lookups from pre-fetched data
    const portListening = listeningPorts.has(port)
    const caddyConfigured = caddyDomains.has(domain)
    const systemdService = systemdStates.get(slug) ?? { exists: false, running: false }
    const siteDirectoryExists = checkSiteDirectory(domain)
    const serveMode = checkServeMode(domain)
    const vitePortCheck = checkViteConfigPort(domain, port)

    // These still need per-domain network calls
    const [httpAccessible, httpsAccessible, dnsCheck] = await Promise.all([
      checkHttpAccessible(domain),
      checkHttpsAccessible(domain),
      checkDnsResolution(domain, serverIp),
    ])

    return {
      domain,
      portListening,
      httpAccessible,
      httpsAccessible,
      systemdServiceExists: systemdService.exists,
      systemdServiceRunning: systemdService.running,
      caddyConfigured,
      siteDirectoryExists,
      dnsPointsToServer: dnsCheck.pointsToServer,
      dnsResolvedIp: dnsCheck.resolvedIp,
      dnsIsProxied: dnsCheck.isProxied,
      dnsVerificationMethod: dnsCheck.verificationMethod,
      vitePortMismatch: vitePortCheck.mismatch,
      viteExpectedPort: port,
      viteActualPort: vitePortCheck.actualPort,
      hasSystemdPortOverride: vitePortCheck.hasSystemdOverride,
      serveMode,
      createdAt: domainInfo.createdAt || null,
      lastChecked: Date.now(),
    }
  })

  const statuses: DomainStatus[] = await Promise.all(checks)

  return createCorsSuccessResponse(origin, { statuses })
}
