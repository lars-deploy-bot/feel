/**
 * Sandbox Manager
 *
 * Manages E2B sandbox lifecycle: create, connect, evict, kill.
 * Deduplicates concurrent creates for the same domain.
 * Reconnects by stored sandbox_id; on failure creates a new sandbox.
 * Syncs workspace source files into the sandbox on first create.
 *
 * The manager is a singleton per worker process. Sandboxes are keyed by domain_id.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import type { SandboxStatus } from "@webalive/database"
import { Sandbox } from "e2b"
import type { E2bTemplate } from "./constants.js"
import { E2B_DEFAULT_TEMPLATE } from "./constants.js"

/** Domain info needed to resolve or create a sandbox. */
export interface SandboxDomain {
  domain_id: string
  hostname: string
  sandbox_id: string | null
  sandbox_status: SandboxStatus | null
  is_test_env?: boolean
}

/** Standard workspace root inside the sandbox. */
export const SANDBOX_WORKSPACE_ROOT = "/home/user/project"

/** Callback to persist sandbox state changes to the database. */
export interface SandboxPersistence {
  updateSandbox(domainId: string, sandboxId: string, status: "creating" | "running" | "dead"): Promise<void>
}

interface SandboxManagerConfig {
  persistence: SandboxPersistence
  /** E2B template name (default: E2B_DEFAULT_TEMPLATE) */
  template?: E2bTemplate
  /** Sandbox timeout in ms (default: 30 days) */
  timeoutMs?: number
  /** E2B domain for self-hosted (default: reads E2B_DOMAIN env var) */
  domain?: string
}

const DEFAULT_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/** Directories to skip when syncing workspace into sandbox. */
const SYNC_SKIP_DIRS = new Set([
  "node_modules",
  ".bun",
  "dist",
  ".next",
  ".turbo",
  ".git",
  ".cache",
  ".vite",
  "__pycache__",
  ".alive",
])

/** Max files to sync. If workspace exceeds this, skip sync and let Claude install from scratch. */
const SYNC_MAX_FILES = 500

/** Max total bytes to sync (10 MB). */
const SYNC_MAX_BYTES = 10 * 1024 * 1024

/** Max size per file to sync (1 MB). Larger files are usually binary/build artifacts. */
const SYNC_MAX_FILE_SIZE_BYTES = 1024 * 1024

export class SandboxManager {
  private readonly sandboxes = new Map<string, Sandbox>()
  private readonly pending = new Map<string, Promise<Sandbox>>()
  private readonly persistence: SandboxPersistence
  private readonly template: string
  private readonly timeoutMs: number
  private readonly domain: string

  constructor(config: SandboxManagerConfig) {
    // FAIL FAST: E2B_API_KEY must be in the environment. The SDK reads it implicitly.
    if (!process.env.E2B_API_KEY) {
      throw new Error("[SandboxManager] FATAL: E2B_API_KEY env var is missing. Cannot authenticate with E2B.")
    }
    if (!config.domain) {
      throw new Error("[SandboxManager] FATAL: E2B domain is required. Set E2B_DOMAIN env var (e.g. 'e2b.sonno.tech').")
    }
    this.persistence = config.persistence
    this.template = config.template ?? E2B_DEFAULT_TEMPLATE
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.domain = config.domain
  }

  /**
   * Get an existing sandbox or create/reconnect one.
   * Deduplicates concurrent calls for the same domain_id.
   */
  async getOrCreate(domain: SandboxDomain, hostWorkspacePath?: string): Promise<Sandbox> {
    // Fast path: already connected in-memory
    const cached = this.sandboxes.get(domain.domain_id)
    if (cached) {
      return cached
    }

    // Deduplicate concurrent creates
    const inflight = this.pending.get(domain.domain_id)
    if (inflight) {
      return inflight
    }

    const promise = this.resolve(domain, hostWorkspacePath)
    this.pending.set(domain.domain_id, promise)

    try {
      const sandbox = await promise
      this.sandboxes.set(domain.domain_id, sandbox)
      return sandbox
    } finally {
      this.pending.delete(domain.domain_id)
    }
  }

  /** Remove a sandbox from the in-memory cache. Does not kill it. */
  evict(domainId: string): void {
    this.sandboxes.delete(domainId)
  }

  /** Kill a sandbox and remove from cache. */
  async kill(domainId: string): Promise<void> {
    const sandbox = this.sandboxes.get(domainId)
    if (sandbox) {
      this.sandboxes.delete(domainId)
      try {
        await sandbox.kill()
      } catch {
        // Already dead, ignore
      }
      await this.persistence.updateSandbox(domainId, sandbox.sandboxId, "dead")
    }
  }

  /** Try to reconnect by stored sandbox_id, fall back to creating a new one. */
  private async resolve(domain: SandboxDomain, hostWorkspacePath?: string): Promise<Sandbox> {
    // Try reconnect if we have a stored sandbox_id
    if (domain.sandbox_id && domain.sandbox_status === "running") {
      try {
        const sandbox = await Sandbox.connect(domain.sandbox_id, {
          timeoutMs: this.timeoutMs,
          domain: this.domain,
        })

        // If workspace root doesn't exist yet, seed it (e.g. sandbox created before sync was implemented)
        if (hostWorkspacePath) {
          try {
            await sandbox.files.list(SANDBOX_WORKSPACE_ROOT)
          } catch {
            await syncWorkspaceToSandbox(sandbox, hostWorkspacePath)
          }
        }

        console.error(`[sandbox-manager] Reconnected to ${domain.sandbox_id} for ${domain.hostname}`)
        return sandbox
      } catch (err) {
        console.error(
          `[sandbox-manager] Reconnect failed for ${domain.hostname} (${domain.sandbox_id}): ${err instanceof Error ? err.message : String(err)}`,
        )
        // Mark dead, then fall through to create
        await this.persistence.updateSandbox(domain.domain_id, domain.sandbox_id, "dead")
      }
    }

    // Create a new sandbox
    return this.create(domain, hostWorkspacePath)
  }

  private async create(domain: SandboxDomain, hostWorkspacePath?: string): Promise<Sandbox> {
    await this.persistence.updateSandbox(domain.domain_id, "", "creating")

    const sandbox = await Sandbox.create(this.template, {
      timeoutMs: this.timeoutMs,
      domain: this.domain,
      metadata: {
        domain_id: domain.domain_id,
        hostname: domain.hostname,
      },
    })

    // Sync workspace source files into the sandbox
    if (hostWorkspacePath) {
      await syncWorkspaceToSandbox(sandbox, hostWorkspacePath)
    }

    await this.persistence.updateSandbox(domain.domain_id, sandbox.sandboxId, "running")

    console.error(`[sandbox-manager] Created ${sandbox.sandboxId} for ${domain.hostname}`)
    return sandbox
  }
}

/**
 * Collect source files from host workspace, skipping build artifacts.
 * Returns files ready for sandbox.files.write().
 * If limits are exceeded, returns an empty list with exceeded=true to avoid partial sync.
 */
function collectWorkspaceFiles(hostDir: string): {
  files: Array<{ path: string; data: ArrayBuffer }>
  totalBytes: number
  exceededLimits: boolean
  exceededReason: "file_count" | "byte_size" | null
} {
  const files: Array<{ path: string; data: ArrayBuffer }> = []
  let totalBytes = 0
  let exceededLimits = false
  let exceededReason: "file_count" | "byte_size" | null = null

  const toArrayBuffer = (data: Buffer): ArrayBuffer =>
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer

  function walk(dir: string) {
    if (exceededLimits) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return // Permission denied or gone, skip
    }

    for (const entry of entries) {
      if (exceededLimits) return

      if (entry.isDirectory()) {
        if (SYNC_SKIP_DIRS.has(entry.name)) continue
        walk(path.join(dir, entry.name))
      } else if (entry.isFile()) {
        const filePath = path.join(dir, entry.name)
        const relativePath = path.relative(hostDir, filePath)
        const sandboxPath = path.join(SANDBOX_WORKSPACE_ROOT, relativePath)

        try {
          const stat = fs.statSync(filePath)
          // Skip very large files individually
          if (stat.size > SYNC_MAX_FILE_SIZE_BYTES) continue

          // IMPORTANT: If limits are exceeded, skip sync entirely (no partial workspace copies).
          if (files.length + 1 > SYNC_MAX_FILES) {
            exceededLimits = true
            exceededReason = "file_count"
            return
          }
          if (totalBytes + stat.size > SYNC_MAX_BYTES) {
            exceededLimits = true
            exceededReason = "byte_size"
            return
          }

          const data = fs.readFileSync(filePath)
          files.push({ path: sandboxPath, data: toArrayBuffer(data) })
          totalBytes += stat.size
        } catch {
          // Unreadable file, skip
        }
      }
    }
  }

  walk(hostDir)
  if (exceededLimits) {
    return { files: [], totalBytes, exceededLimits: true, exceededReason }
  }
  return { files, totalBytes, exceededLimits: false, exceededReason: null }
}

/** Sync host workspace source files into the sandbox. */
async function syncWorkspaceToSandbox(sandbox: Sandbox, hostWorkspacePath: string): Promise<void> {
  const startMs = Date.now()
  const collected = collectWorkspaceFiles(hostWorkspacePath)

  if (collected.exceededLimits) {
    const reason = collected.exceededReason === "file_count" ? `${SYNC_MAX_FILES} files` : `${SYNC_MAX_BYTES} bytes`
    console.error(`[sandbox-manager] Workspace sync skipped: source exceeds limit (${reason})`)
    return
  }

  // Ensure workspace root exists even when host workspace is empty.
  try {
    await sandbox.files.makeDir(SANDBOX_WORKSPACE_ROOT)
  } catch {
    // Ignore if already exists.
  }

  if (collected.files.length === 0) {
    console.error("[sandbox-manager] No source files to sync (workspace root created)")
    return
  }

  // Batch write all files (E2B SDK supports array writes)
  await sandbox.files.write(collected.files)

  const elapsedMs = Date.now() - startMs
  console.error(`[sandbox-manager] Synced ${collected.files.length} files to sandbox in ${elapsedMs}ms`)
}
