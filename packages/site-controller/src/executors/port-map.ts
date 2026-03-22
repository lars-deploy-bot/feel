/**
 * Port Map Generator
 *
 * Regenerates /var/lib/alive/generated/port-map.json from Supabase app.domains.
 * Called after every deployment. Verifies the target domain is present, then
 * sends SIGHUP to preview-proxy for instant reload.
 *
 * IMPORTANT: This writes shared server-wide artifacts under /var/lib/alive/generated/.
 * It always uses canonical (production) DB credentials and filters by server_id,
 * matching the same authoritative domain set as the Caddy routing generator.
 * This prevents staging/dev processes from overwriting production data.
 *
 * Strict: throws on any failure. A deployment without a working preview is not a deployment.
 */

import { execSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { getServerId, retryAsync } from "@webalive/shared"
import { PATHS } from "../constants.js"
import { assertNoDangerousCountDrop, readExistingPortMapCount } from "../generated-safety.js"
import { loadCanonicalInfraEnvFileOnly } from "../infra-env.js"

const PORT_MAP_FILENAME = "port-map.json"
/** Default dev server port inside E2B sandboxes (Vite default). Must match E2B_DEFAULT_PORT in @webalive/sandbox. */
const E2B_DEFAULT_PORT = 5173
const SANDBOX_MAP_FILENAME = "sandbox-map.json"
const PREVIEW_PROXY_SERVICE = "preview-proxy.service"
const TEMPLATE_ENV_DIR = "/etc/templates"

function getOutputPath(): string {
  const generatedDir = PATHS.GENERATED_DIR
  if (generatedDir) {
    return join(generatedDir, PORT_MAP_FILENAME)
  }
  return `/var/lib/alive/generated/${PORT_MAP_FILENAME}`
}

function getCanonicalSupabaseClient() {
  const infraEnv = loadCanonicalInfraEnvFileOnly()
  const url = infraEnv.SUPABASE_URL
  const key = infraEnv.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("[port-map] Canonical .env.production must have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
  }
  return { client: createClient(url, key, { db: { schema: "app" } }), infraEnv }
}

/**
 * Send SIGHUP to the preview-proxy so it reloads the port-map immediately.
 * Throws if the signal fails — a stale proxy is a broken preview.
 */
function signalPreviewProxy(): void {
  try {
    execSync(`systemctl kill --signal=SIGHUP ${PREVIEW_PROXY_SERVICE}`, {
      timeout: 5_000,
      stdio: "pipe",
    })
  } catch (err) {
    // Check if service simply doesn't exist (dev/CI) — that's the only acceptable failure
    try {
      const status = execSync(`systemctl is-enabled ${PREVIEW_PROXY_SERVICE} 2>&1`, {
        timeout: 5_000,
        encoding: "utf-8",
      }).trim()
      // If the service is enabled but SIGHUP failed, that's a real error
      if (status === "enabled") {
        throw new Error(
          `[port-map] Failed to signal ${PREVIEW_PROXY_SERVICE}: ${err instanceof Error ? err.message : err}`,
        )
      }
    } catch (checkErr) {
      // is-enabled failed = service doesn't exist = dev environment, fine
      if (checkErr instanceof Error && checkErr.message.includes("Failed to signal")) {
        throw checkErr
      }
    }
  }
}

/** E2B sandbox entry in sandbox-map.json */
interface SandboxMapEntry {
  sandboxId: string
  e2bDomain: string
  /** Dev server port inside the sandbox (from DB port column) */
  port: number
}

function getSandboxMapPath(): string {
  const generatedDir = PATHS.GENERATED_DIR
  if (generatedDir) {
    return join(generatedDir, SANDBOX_MAP_FILENAME)
  }
  return `/var/lib/alive/generated/${SANDBOX_MAP_FILENAME}`
}

export function readTemplatePortMap(templateEnvDir = TEMPLATE_ENV_DIR): Record<string, number> {
  const ports: Record<string, number> = {}

  let entries: string[]
  try {
    entries = readdirSync(templateEnvDir)
  } catch {
    return ports
  }

  for (const entry of entries) {
    if (!entry.endsWith(".env")) continue

    const hostname = entry.slice(0, -".env".length)
    if (hostname.length === 0) continue

    let raw: string
    try {
      raw = readFileSync(join(templateEnvDir, entry), "utf-8")
    } catch {
      continue
    }

    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("PORT=")) continue

      const value = Number.parseInt(trimmed.slice("PORT=".length), 10)
      if (Number.isInteger(value) && value > 0) {
        ports[hostname] = value
      }
      break
    }
  }

  return ports
}

/**
 * Regenerate port-map.json and sandbox-map.json from Supabase,
 * verify them, and signal the Go preview-proxy.
 *
 * port-map.json: { "hostname": port } — for systemd sites (local port)
 * sandbox-map.json: { "hostname": { sandboxId, e2bDomain } } — for E2B sites
 *
 * Uses canonical (production) DB credentials and filters by server_id,
 * matching the same authoritative domain set as the Caddy routing generator.
 *
 * @param requiredHostname - If set, throws if this hostname is missing from the result.
 *                           Used by deploy pipeline to guarantee the new site is routable.
 * @returns number of domains written
 * @throws Error if Supabase query fails, required hostname missing, or signal fails
 */
export async function regeneratePortMap(requiredHostname?: string): Promise<number> {
  const serverId = getServerId()
  if (!serverId) {
    throw new Error("[port-map] serverId not configured in server-config.json")
  }

  const { portMap, sandboxMap } = await retryAsync(
    async () => {
      const { client: app, infraEnv } = getCanonicalSupabaseClient()

      // Query domains assigned to THIS server only, excluding test envs.
      // Same scoping as Caddy routing generator (generate-routing.ts:queryDomains).
      const { data, error } = await app
        .from("domains")
        .select("hostname, port, execution_mode, sandbox_id, sandbox_status")
        .eq("server_id", serverId)
        .is("is_test_env", false)

      if (error) {
        throw new Error(`[port-map] Failed to fetch domains: ${error.message}`)
      }

      const ports: Record<string, number> = {}
      const sandboxes: Record<string, SandboxMapEntry> = {}
      const e2bDomain = infraEnv.E2B_DOMAIN

      for (const row of data || []) {
        if (!row.hostname) continue

        if (row.execution_mode === "e2b" && row.sandbox_id && row.sandbox_status === "running") {
          if (!e2bDomain) {
            throw new Error(
              `[port-map] E2B_DOMAIN environment variable is required: found E2B domain "${row.hostname}" but no E2B_DOMAIN configured`,
            )
          }
          sandboxes[row.hostname] = {
            sandboxId: row.sandbox_id,
            e2bDomain,
            port: row.port || E2B_DEFAULT_PORT,
          }
        } else if (row.port) {
          ports[row.hostname] = row.port
        }
      }

      for (const [hostname, port] of Object.entries(readTemplatePortMap())) {
        if (!(hostname in ports)) {
          ports[hostname] = port
        }
      }

      // Strict: if a hostname was just deployed, it MUST be in one of the maps
      if (requiredHostname && !(requiredHostname in ports) && !(requiredHostname in sandboxes)) {
        throw new Error(
          `[port-map] Required hostname "${requiredHostname}" not found in domains table. ` +
            `registerDomain() may have failed silently. Got ${Object.keys(ports).length + Object.keys(sandboxes).length} domains.`,
        )
      }

      return { portMap: ports, sandboxMap: sandboxes }
    },
    { attempts: requiredHostname ? 3 : 1, minDelayMs: 500, label: "port-map" },
  )

  const portMapPath = getOutputPath()
  const sandboxMapPath = getSandboxMapPath()
  const existingTotal = readExistingPortMapCount(portMapPath) + readExistingPortMapCount(sandboxMapPath)
  const nextTotal = Object.keys(portMap).length + Object.keys(sandboxMap).length

  assertNoDangerousCountDrop({
    kind: "generated port-map",
    filePath: portMapPath,
    existingCount: existingTotal,
    nextCount: nextTotal,
  })

  mkdirSync(dirname(portMapPath), { recursive: true })

  writeFileSync(portMapPath, JSON.stringify(portMap, null, 2), "utf-8")
  writeFileSync(sandboxMapPath, JSON.stringify(sandboxMap, null, 2), "utf-8")

  // Read back and verify the file was written correctly
  const written: unknown = JSON.parse(readFileSync(portMapPath, "utf-8"))
  const writtenSandbox: unknown = JSON.parse(readFileSync(sandboxMapPath, "utf-8"))
  if (requiredHostname) {
    const inPorts = typeof written === "object" && written !== null && requiredHostname in written
    const inSandbox =
      typeof writtenSandbox === "object" && writtenSandbox !== null && requiredHostname in writtenSandbox
    if (!inPorts && !inSandbox) {
      throw new Error(`[port-map] Write verification failed: "${requiredHostname}" not in port-map or sandbox-map`)
    }
  }

  // Signal preview-proxy to reload immediately
  signalPreviewProxy()

  if (Object.keys(sandboxMap).length > 0) {
    console.error(`[port-map] Wrote ${Object.keys(portMap).length} ports + ${Object.keys(sandboxMap).length} sandboxes`)
  }
  return nextTotal
}
