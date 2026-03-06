/**
 * Port Map Generator
 *
 * Regenerates /var/lib/alive/generated/port-map.json from Supabase app.domains.
 * Called after every deployment. Verifies the target domain is present, then
 * sends SIGHUP to preview-proxy for instant reload.
 *
 * Strict: throws on any failure. A deployment without a working preview is not a deployment.
 */

import { execSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { retryAsync } from "@webalive/shared"
import { PATHS } from "../constants.js"

const PORT_MAP_FILENAME = "port-map.json"
const SANDBOX_MAP_FILENAME = "sandbox-map.json"
const PREVIEW_PROXY_SERVICE = "preview-proxy.service"

function getOutputPath(): string {
  const generatedDir = PATHS.GENERATED_DIR
  if (generatedDir) {
    return join(generatedDir, PORT_MAP_FILENAME)
  }
  return `/var/lib/alive/generated/${PORT_MAP_FILENAME}`
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("[port-map] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  }
  return createClient(url, key, { db: { schema: "app" } })
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

/**
 * Regenerate port-map.json and sandbox-map.json from Supabase,
 * verify them, and signal the Go preview-proxy.
 *
 * port-map.json: { "hostname": port } — for systemd sites (local port)
 * sandbox-map.json: { "hostname": { sandboxId, e2bDomain } } — for E2B sites
 *
 * @param requiredHostname - If set, throws if this hostname is missing from the result.
 *                           Used by deploy pipeline to guarantee the new site is routable.
 * @returns number of domains written
 * @throws Error if Supabase query fails, required hostname missing, or signal fails
 */
export async function regeneratePortMap(requiredHostname?: string): Promise<number> {
  const { portMap, sandboxMap } = await retryAsync(
    async () => {
      const app = getSupabaseClient()
      const { data, error } = await app
        .from("domains")
        .select("hostname, port, execution_mode, sandbox_id, sandbox_status")

      if (error) {
        throw new Error(`[port-map] Failed to fetch domains: ${error.message}`)
      }

      const ports: Record<string, number> = {}
      const sandboxes: Record<string, SandboxMapEntry> = {}
      const e2bDomain = process.env.E2B_DOMAIN || "e2b.sonno.tech"

      for (const row of data || []) {
        if (!row.hostname) continue

        if (row.execution_mode === "e2b" && row.sandbox_id && row.sandbox_status === "running") {
          sandboxes[row.hostname] = {
            sandboxId: row.sandbox_id,
            e2bDomain,
            port: row.port || 5173,
          }
        } else if (row.port) {
          ports[row.hostname] = row.port
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

  const total = Object.keys(portMap).length + Object.keys(sandboxMap).length
  if (Object.keys(sandboxMap).length > 0) {
    console.error(`[port-map] Wrote ${Object.keys(portMap).length} ports + ${Object.keys(sandboxMap).length} sandboxes`)
  }
  return total
}
