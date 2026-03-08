#!/usr/bin/env node
/**
 * Persistent Worker Entry Point
 *
 * Long-running process that handles multiple Claude queries.
 * Communicates with parent via Unix domain socket using NDJSON.
 *
 * IMPORTANT: This worker does NOT import from apps/web.
 * All configuration is passed via IPC from the parent process.
 *
 * Environment:
 *   TARGET_UID - UID to drop privileges to
 *   TARGET_GID - GID to drop privileges to
 *   TARGET_CWD - Workspace directory
 *   WORKER_SOCKET_PATH - Unix socket path for IPC
 *   WORKER_WORKSPACE_KEY - Workspace identifier
 */

import { chmodSync, chownSync, existsSync, mkdirSync, mkdtempSync, statSync } from "node:fs"
import { createConnection } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

// Base directory for stable session storage
// Each workspace gets its own subdirectory to persist Claude session data
const SESSIONS_BASE_DIR = "/var/lib/claude-sessions"

import { query } from "@anthropic-ai/claude-agent-sdk"
// IMPORTANT: Import these BEFORE dropping privileges!
// After privilege drop, the worker can't read /root/alive/node_modules/
import * as Sentry from "@sentry/node"
import {
  createE2bMcp,
  E2B_DEFAULT_TEMPLATE,
  E2B_DISABLED_SDK_TOOLS,
  E2B_MCP_TOOLS,
  EXECUTION_MODES,
  SANDBOX_STATUSES,
  SANDBOX_WORKSPACE_ROOT,
  SandboxManager,
} from "@webalive/sandbox"
// biome-ignore format: import checker expects a single-line import statement for this package.
import { createStreamToolContext, DEFAULTS, formatUncaughtError, GLOBAL_MCP_PROVIDERS, isAbortError, isFatalError, isStreamInitVisibleTool, isTransientNetworkError, resolveStreamMode, SENTRY, STREAM_MODES } from "@webalive/shared"
import {
  emailInternalMcp,
  sandboxedFsInternalMcp,
  toolsInternalMcp,
  withSearchToolsConnectedProviders,
  workspaceInternalMcp,
} from "@webalive/tools"
import { resolveSandboxTemplate } from "../dist/e2b-template.js"
import { E2B_INFRASTRUCTURE_ENV_KEYS, prepareRequestEnv } from "../dist/env-isolation.js"

// Initialize Sentry for error reporting in the worker process.
// DSN comes from server-config.json via @webalive/shared.
if (SENTRY.DSN) {
  Sentry.init({
    dsn: SENTRY.DSN,
    environment: process.env.STREAM_ENV ?? process.env.NODE_ENV ?? "unknown",
    // Workers are long-lived — no need for performance tracing
    tracesSampleRate: 0,
  })
}

// Sandbox managers by template, created lazily on first request for that template.
// Persists sandbox state via PostgREST (Supabase REST API).
const sandboxManagers = new Map()
function getSandboxManager(template = E2B_DEFAULT_TEMPLATE) {
  const existing = sandboxManagers.get(template)
  if (existing) return existing

  // FAIL FAST: All E2B env vars must be present. If any are missing, the worker
  // was spawned without them (check WORKER_SPAWN_ALLOWED_ENV_KEYS in env-isolation.ts).
  const e2bApiKey = process.env.E2B_API_KEY
  const e2bDomain = process.env.E2B_DOMAIN
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const missing = []
  if (!e2bApiKey) missing.push("E2B_API_KEY")
  if (!e2bDomain) missing.push("E2B_DOMAIN")
  if (!supabaseUrl) missing.push("SUPABASE_URL")
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY")
  if (missing.length > 0) {
    throw new Error(
      `[sandbox-manager] FATAL: Missing env vars for E2B mode: ${missing.join(", ")}. Check env-isolation.ts allowlist and .env files.`,
    )
  }

  const manager = new SandboxManager({
    domain: e2bDomain,
    template,
    persistence: {
      async updateSandbox(domainId, sandboxId, status) {
        const response = await fetch(`${supabaseUrl}/rest/v1/domains?domain_id=eq.${domainId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Content-Profile": "app",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            sandbox_id: sandboxId || null,
            sandbox_status: status,
          }),
        })
        if (!response.ok) {
          const body = await response.text()
          const err = new Error(
            `[sandbox-manager] DB update failed for domain ${domainId} (status=${status}): HTTP ${response.status} — ${body}`,
          )
          Sentry.captureException(err, {
            tags: { component: "e2b", operation: "updateSandbox" },
            extra: { domainId, sandboxId, status, httpStatus: response.status, body },
          })
          throw err
        }
      },
    },
  })
  sandboxManagers.set(template, manager)
  return manager
}

// Global unhandled rejection handler - smart handling based on error type
// Pattern from OpenClaw: don't crash on transient network errors or intentional aborts
process.on("unhandledRejection", (reason, _promise) => {
  // AbortError is typically an intentional cancellation (e.g., during shutdown)
  // Log it but don't crash - these are expected during graceful shutdown
  if (isAbortError(reason)) {
    console.warn("[worker] Suppressed AbortError (intentional cancellation):", formatUncaughtError(reason))
    return
  }

  // Transient network errors shouldn't crash the worker
  // They typically resolve on their own or will be retried
  if (isTransientNetworkError(reason)) {
    console.warn("[worker] Non-fatal network error (continuing):", formatUncaughtError(reason))
    return
  }

  // Fatal errors should definitely crash
  if (isFatalError(reason)) {
    console.error("[worker] FATAL unhandled rejection:", formatUncaughtError(reason))
    process.exit(1)
    return
  }

  // Unknown errors - still crash to be safe, but with better logging
  console.error("[worker] Unhandled promise rejection:", formatUncaughtError(reason))
  process.exit(1)
})

process.on("uncaughtException", error => {
  // Transient network errors in sync code (rare but possible)
  if (isTransientNetworkError(error)) {
    console.warn("[worker] Non-fatal uncaught exception (continuing):", formatUncaughtError(error))
    return
  }

  console.error("[worker] FATAL: Uncaught exception:", formatUncaughtError(error))
  process.exit(1)
})

// Metrics
const startTime = Date.now()
let queriesProcessed = 0

// Current query state
let currentRequestId = null
let currentAbortController = null

// Shutdown timeout (10 seconds max wait for query to complete)
const SHUTDOWN_TIMEOUT_MS = 10_000

// Maximum buffer size for NDJSON parser (10 MB - prevents memory exhaustion)
const MAX_BUFFER_SIZE = 10 * 1024 * 1024

// Socket connection timeout (5 seconds)
const SOCKET_CONNECT_TIMEOUT_MS = 5_000

// =============================================================================
// Helper Functions (DRY)
// =============================================================================

/** Clear current query state - used after query completes or errors */
function clearQueryState() {
  currentRequestId = null
  currentAbortController = null
}

/**
 * Sanitize workspace key for use as a directory name.
 * Replaces unsafe characters with underscores.
 */
function sanitizeWorkspaceKey(key) {
  if (!key || typeof key !== "string") return "default"
  // Replace any characters that could cause path issues
  // Allow alphanumeric, dash, underscore, and dot
  return key.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)
}

/**
 * Ensure stable session home directory exists with proper ownership.
 * Creates /var/lib/claude-sessions/<workspace>/ for persistent session storage.
 *
 * @param {string} workspaceKey - The workspace identifier
 * @param {number} uid - Target user ID
 * @param {number} gid - Target group ID
 * @returns {string} Path to the stable home directory
 */
function ensureStableSessionHome(workspaceKey, uid, gid) {
  const sanitizedKey = sanitizeWorkspaceKey(workspaceKey)
  const stableHome = join(SESSIONS_BASE_DIR, sanitizedKey)

  try {
    // Create directory if it doesn't exist
    if (!existsSync(stableHome)) {
      mkdirSync(stableHome, { recursive: true, mode: 0o700 })
      console.error(`[worker] Created stable session home: ${stableHome}`)
    }

    // Ensure correct ownership
    chownSync(stableHome, uid, gid)

    return stableHome
  } catch (error) {
    // If we can't create stable home (e.g., permissions), fall back to temp
    console.error(`[worker] Failed to create stable session home: ${error.message}`)
    console.error("[worker] Falling back to temp directory")
    return null
  }
}

/**
 * Extract structured SDK errors from a query result.
 * Claude often emits these before exiting with a generic code 1.
 */
function extractStructuredResultErrors(queryResult) {
  if (queryResult?.subtype !== "error_during_execution" || !Array.isArray(queryResult.errors)) {
    return []
  }
  return queryResult.errors.filter(msg => typeof msg === "string" && msg.trim().length > 0)
}

/**
 * Create compact MCP status counts from system init payload.
 * Example output: { connected: 3, failed: 2, needsAuth: 1, pending: 0, disabled: 0 }
 */
function summarizeMcpStatuses(mcpServers) {
  const summary = {
    connected: 0,
    failed: 0,
    needsAuth: 0,
    pending: 0,
    disabled: 0,
    unknown: 0,
  }

  if (!Array.isArray(mcpServers)) {
    return summary
  }

  for (const server of mcpServers) {
    const status = server?.status
    if (status === "connected") summary.connected++
    else if (status === "failed") summary.failed++
    else if (status === "needs-auth") summary.needsAuth++
    else if (status === "pending") summary.pending++
    else if (status === "disabled") summary.disabled++
    else summary.unknown++
  }

  return summary
}

// =============================================================================
// NDJSON IPC Client
// =============================================================================

class IpcClient {
  constructor(socketPath) {
    this.socketPath = socketPath
    this.socket = null
    this.buffer = ""
    this.onMessage = null
  }

  async connect() {
    return new Promise((resolve, reject) => {
      let connected = false

      // Connection timeout to prevent hanging indefinitely
      const timeoutId = setTimeout(() => {
        if (!connected) {
          this.socket?.destroy()
          reject(new Error(`Socket connection timed out after ${SOCKET_CONNECT_TIMEOUT_MS}ms`))
        }
      }, SOCKET_CONNECT_TIMEOUT_MS)

      this.socket = createConnection(this.socketPath)

      this.socket.on("connect", () => {
        connected = true
        clearTimeout(timeoutId)
        console.error(`[worker] Connected to ${this.socketPath}`)
        resolve()
      })

      this.socket.on("data", chunk => this.handleData(chunk))

      this.socket.on("close", () => {
        console.error("[worker] Socket closed, exiting")
        process.exit(0)
      })

      this.socket.on("error", err => {
        clearTimeout(timeoutId)
        console.error("[worker] Socket error:", err.message)
        reject(err)
      })
    })
  }

  handleData(chunk) {
    this.buffer += chunk.toString()

    // Prevent memory exhaustion from unbounded buffer growth
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      console.error(`[worker] FATAL: IPC buffer exceeded ${MAX_BUFFER_SIZE} bytes`)
      this.buffer = ""
      process.exit(1)
    }

    let newlineIndex = this.buffer.indexOf("\n")
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim()
      this.buffer = this.buffer.slice(newlineIndex + 1)

      if (line.length === 0) continue

      try {
        const msg = JSON.parse(line)
        this.onMessage?.(msg)
      } catch (_err) {
        console.error("[worker] Failed to parse message:", line.slice(0, 200))
      }

      newlineIndex = this.buffer.indexOf("\n")
    }
  }

  send(msg) {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(`${JSON.stringify(msg)}\n`)
    }
  }

  close() {
    if (this.socket) {
      this.socket.destroy()
    }
  }
}

// =============================================================================
// Privilege Dropping
// =============================================================================

function dropPrivileges() {
  const targetUid = process.env.TARGET_UID && Number(process.env.TARGET_UID)
  const targetGid = process.env.TARGET_GID && Number(process.env.TARGET_GID)
  const targetCwd = process.env.TARGET_CWD

  // Validate UID/GID are reasonable values (not NaN, not negative)
  if (targetUid !== undefined && targetUid !== 0) {
    if (Number.isNaN(targetUid) || targetUid < 0) {
      console.error(`[worker] FATAL: Invalid TARGET_UID: ${process.env.TARGET_UID}`)
      process.exit(1)
    }
  }
  if (targetGid !== undefined && targetGid !== 0) {
    if (Number.isNaN(targetGid) || targetGid < 0) {
      console.error(`[worker] FATAL: Invalid TARGET_GID: ${process.env.TARGET_GID}`)
      process.exit(1)
    }
  }

  // === SESSION PERSISTENCE ARCHITECTURE ===
  //
  // The Claude Agent SDK persists conversations as JSONL files on disk.
  // Two directories are involved:
  //
  //   1. CLAUDE_CONFIG_DIR (e.g. /root/.claude)
  //      - Contains credentials (.credentials.json), settings, and the
  //        `projects/` subdirectory where session JSONL files are stored.
  //      - Path: CLAUDE_CONFIG_DIR/projects/<hash-of-cwd>/<session-id>.jsonl
  //      - Must point to a real .claude dir with valid credentials.
  //
  //   2. HOME (per-workspace)
  //      - The SDK also uses HOME for temp files and caching.
  //      - Each workspace gets a stable HOME so sessions survive restarts.
  //
  // CRITICAL BUG FIX (2026-02-20):
  //   Workers start as root, then drop privileges to workspace users (e.g.
  //   site-mysite-com, uid 993). After the drop, the worker can no longer
  //   write to /root/.claude/projects/ if it's owned by root with mode 0700.
  //   The SDK silently fails to save session files, so `resume` calls fail
  //   with "No conversation found with session ID: <id>".
  //
  //   The session recovery code in route.ts then retries WITHOUT resume,
  //   starting a fresh conversation — making it look like Claude "forgot"
  //   the previous context. The symptom is subtle: no errors in the UI,
  //   just lost context.
  //
  //   Fix: Set projects/ to mode 1777 (world-writable + sticky bit, like
  //   /tmp) so all workspace users can create session subdirectories.
  //
  // HOW TO DEBUG SESSION ISSUES:
  //   1. Check SDK debug logs: /root/.claude/debug/<session-id>.txt
  //      Look for EACCES or permission denied errors.
  //   2. Check permissions: ls -la /root/.claude/projects/
  //      Should be drwxrwxrwt (1777). If it's drwx------ (0700), that's the bug.
  //   3. Check route.ts logs: grep "SESSION RECOVERY" in journalctl output.
  //      If you see "Session not found, clearing and retrying", sessions
  //      aren't persisting on disk.
  //   4. Verify session files exist:
  //      find /root/.claude/projects/ -name "*.jsonl" -ls
  //
  const originalHome = process.env.HOME || "/root"
  const workspaceKey = process.env.WORKER_WORKSPACE_KEY

  // CLAUDE_CONFIG_DIR must point to a directory with valid SDK credentials.
  // We use /root/.claude (shared across all workers). Do NOT set this to a
  // per-workspace directory — the SDK needs .credentials.json and settings
  // from here to function at all.
  const configuredClaudeDir = process.env.CLAUDE_CONFIG_DIR
  const defaultClaudeDir = join(originalHome, ".claude")
  if (configuredClaudeDir?.startsWith("/")) {
    process.env.CLAUDE_CONFIG_DIR = configuredClaudeDir
  } else {
    if (configuredClaudeDir && !configuredClaudeDir.startsWith("/")) {
      console.error(`[worker] Ignoring invalid CLAUDE_CONFIG_DIR (must be absolute): ${configuredClaudeDir}`)
    }
    process.env.CLAUDE_CONFIG_DIR = defaultClaudeDir
  }

  // Self-healing: ensure CLAUDE_CONFIG_DIR and its subdirectories have correct
  // permissions on every worker init. Guards against permission drift.
  //
  // SECURITY: The config dir must NOT be group- or world-writable (max 755).
  // If writable by non-root principals (via group membership or world bits),
  // SDK subprocesses can overwrite .claude.json, hijacking ownership from root.
  // See postmortem: 2026-02-26 settings permissions break.
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR
  try {
    if (existsSync(claudeConfigDir)) {
      const configDirStat = statSync(claudeConfigDir)
      const configDirMode = configDirStat.mode & 0o777
      if (configDirMode & 0o022) {
        // Group- or world-writable — fix it
        chmodSync(claudeConfigDir, 0o755)
        console.error(`[worker] Fixed config dir permissions: ${configDirMode.toString(8)} → 755`)
      }
    }
  } catch (e) {
    console.error(`[worker] Failed to check/fix config dir permissions: ${e.message}`)
  }

  // Ensure .claude.json stays root-owned with mode 644 (prevents workspace user hijacking)
  const claudeJsonPath = join(claudeConfigDir, ".claude.json")
  try {
    if (existsSync(claudeJsonPath)) {
      const jsonStat = statSync(claudeJsonPath)
      const jsonMode = jsonStat.mode & 0o777
      let repaired = false
      if (jsonStat.uid !== 0 || jsonStat.gid !== 0) {
        chownSync(claudeJsonPath, 0, 0)
        repaired = true
      }
      if (jsonMode !== 0o644) {
        chmodSync(claudeJsonPath, 0o644)
        repaired = true
      }
      if (repaired) {
        console.error(
          `[worker] Fixed .claude.json: uid=${jsonStat.uid}, gid=${jsonStat.gid}, mode=${jsonMode.toString(8)} → root:root 644`,
        )
      }
    }
  } catch (e) {
    console.error(`[worker] Failed to check/fix .claude.json: ${e.message}`)
  }

  // Self-healing: ensure config files are world-readable (0o644).
  // Workers drop privileges to workspace users (e.g. site-example-com) but
  // the Claude CLI subprocess still reads CLAUDE_CONFIG_DIR. If these files
  // are 0o600 (owner-only), the subprocess silently exits with 0 messages.
  // See: docs/postmortems/2026-02-26-claude-code-settings-permissions.md
  for (const configFile of ["settings.json", ".claude.json"]) {
    const filePath = join(claudeConfigDir, configFile)
    try {
      if (existsSync(filePath)) {
        const mode = statSync(filePath).mode & 0o777
        if ((mode & 0o044) !== 0o044) {
          console.error(`[worker] FIXING: ${configFile} has mode ${mode.toString(8)}, needs world-readable (644)`)
          chmodSync(filePath, 0o644)
        }
      }
    } catch (e) {
      console.error(`[worker] Failed to check ${configFile} permissions: ${e.message}`)
    }
  }

  // Ensure projects/ dir exists with world-writable + sticky bit (like /tmp)
  // so all workspace users can create session subdirectories.
  const configProjectsDir = join(claudeConfigDir, "projects")
  try {
    if (!existsSync(configProjectsDir)) {
      mkdirSync(configProjectsDir, { recursive: true, mode: 0o1777 })
    } else {
      chmodSync(configProjectsDir, 0o1777)
    }
  } catch (e) {
    console.error(`[worker] Failed to ensure projects dir permissions: ${e.message}`)
  }

  // Try to use stable session home for this workspace
  // Falls back to temp directory if stable home creation fails
  const workerHome = ensureStableSessionHome(workspaceKey, targetUid, targetGid)

  if (workerHome) {
    // Using stable session home - sessions will persist across restarts
    const claudeDir = join(workerHome, ".claude")

    // Create .claude subdirectory if it doesn't exist
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { mode: 0o700 })
      chownSync(claudeDir, targetUid, targetGid)
    }

    // Skills are superadmin-only and read directly from the repo.
    // Superadmin workers (uid 0) already have access via /root/.claude/skills/.

    process.env.HOME = workerHome
    console.error(`[worker] Using stable session home: ${workerHome}`)
    console.error(`[worker] Using shared credentials from: ${process.env.CLAUDE_CONFIG_DIR}`)
  } else {
    // Fallback: use temp directory (sessions won't persist, but won't crash)
    console.error("[worker] WARN: Using temp home - sessions will not persist across restarts")
    const tempHome = mkdtempSync(join(tmpdir(), `claude-home-${targetUid}-`))
    const claudeDir = join(tempHome, ".claude")

    mkdirSync(claudeDir, { mode: 0o700 })
    chownSync(tempHome, targetUid, targetGid)
    chownSync(claudeDir, targetUid, targetGid)

    process.env.HOME = tempHome
    console.error(`[worker] Using temp home: ${tempHome}`)
    console.error(`[worker] Using shared credentials from: ${process.env.CLAUDE_CONFIG_DIR}`)
  }

  // Ensure temp directory is writable by the workspace user
  const tempDir = join(process.env.HOME || "/tmp", "tmp")
  try {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true, mode: 0o700 })
    }
    if (typeof targetUid === "number" && typeof targetGid === "number") {
      chownSync(tempDir, targetUid, targetGid)
    }
    process.env.TMPDIR = tempDir
    process.env.TMP = tempDir
    process.env.TEMP = tempDir
    console.error(`[worker] TMPDIR set to: ${tempDir}`)
  } catch (error) {
    console.error(`[worker] Failed to set TMPDIR: ${error.message}`)
  }

  // Drop privileges with validation
  // CRITICAL: Must drop GID before UID (can't setgid after dropping root UID)
  try {
    if (targetGid && process.setgid) {
      process.setgid(targetGid)
      const actualGid = process.getgid()
      if (actualGid !== targetGid) {
        throw new Error(`GID mismatch: expected ${targetGid}, got ${actualGid}`)
      }
      console.error(`[worker] Dropped to GID: ${targetGid}`)
    }

    if (targetUid && process.setuid) {
      process.setuid(targetUid)
      const actualUid = process.getuid()
      if (actualUid !== targetUid) {
        throw new Error(`UID mismatch: expected ${targetUid}, got ${actualUid}`)
      }
      console.error(`[worker] Dropped to UID: ${targetUid}`)
    }

    // Verify we're not still running as root when we should have dropped
    if (targetUid && targetUid !== 0 && process.getuid() === 0) {
      throw new Error("Still running as root after privilege drop!")
    }
    if (targetGid && targetGid !== 0 && process.getgid() === 0) {
      throw new Error("Still running as GID 0 after privilege drop!")
    }
  } catch (error) {
    console.error(`[worker] FATAL: Privilege drop failed: ${error.message}`)
    process.exit(1)
  }

  process.umask(0o022)

  if (targetCwd) {
    // SECURITY: Validate TARGET_CWD before use
    if (typeof targetCwd !== "string" || targetCwd.length === 0) {
      console.error("[worker] FATAL: TARGET_CWD must be non-empty string")
      process.exit(1)
    }
    if (!targetCwd.startsWith("/")) {
      console.error(`[worker] FATAL: TARGET_CWD must be absolute path, got: ${targetCwd}`)
      process.exit(1)
    }
    if (targetCwd.includes("..")) {
      console.error(`[worker] FATAL: TARGET_CWD contains path traversal: ${targetCwd}`)
      process.exit(1)
    }

    try {
      process.chdir(targetCwd)
      console.error(`[worker] Changed to workspace: ${targetCwd}`)
    } catch (error) {
      console.error(`[worker] FATAL: Cannot access workspace ${targetCwd}: ${error.message}`)
      process.exit(1)
    }
  }

  console.error(`[worker] Working directory: ${process.cwd()}`)
  console.error(`[worker] Running as UID:${process.getuid()} GID:${process.getgid()}`)
}

// =============================================================================
// Query Handling
// =============================================================================

async function handleQuery(ipc, requestId, payload) {
  const queryStartTime = Date.now()
  const timing = label => console.error(`[worker ${requestId}] [TIMING] ${label}: +${Date.now() - queryStartTime}ms`)

  timing("query_received")

  // NOTE: query, isOAuthMcpTool, internal MCP servers are imported
  // at the top level BEFORE privilege drop. After dropping privileges, the worker
  // can't read /root/alive/node_modules/

  // Get configuration from payload - NO imports from apps/web
  const { agentConfig } = payload
  if (!agentConfig) {
    ipc.send({ type: "error", requestId, error: "Missing agentConfig in payload" })
    clearQueryState()
    return
  }

  const {
    allowedTools,
    disallowedTools,
    permissionMode,
    settingSources,
    oauthMcpServers, // Only OAuth HTTP servers are serializable via IPC
    streamTypes,
    extraTools,
  } = agentConfig

  // Input validation - prevent type confusion attacks
  const validationErrors = []

  // Required string field
  if (typeof payload.message !== "string") {
    validationErrors.push("message must be a string")
  }

  // Required agentConfig fields
  if (!Array.isArray(allowedTools)) {
    validationErrors.push("allowedTools must be an array")
  } else if (!allowedTools.every(t => typeof t === "string")) {
    validationErrors.push("allowedTools must contain only strings")
  }
  if (!Array.isArray(disallowedTools)) {
    validationErrors.push("disallowedTools must be an array")
  } else if (!disallowedTools.every(t => typeof t === "string")) {
    validationErrors.push("disallowedTools must contain only strings")
  }
  if (typeof permissionMode !== "string") {
    validationErrors.push("permissionMode must be a string")
  }
  if (!Array.isArray(settingSources)) {
    validationErrors.push("settingSources must be an array")
  } else if (!settingSources.every(s => typeof s === "string")) {
    validationErrors.push("settingSources must contain only strings")
  }
  if (!streamTypes || typeof streamTypes !== "object") {
    validationErrors.push("streamTypes must be an object")
  } else {
    // Validate individual streamTypes properties
    const streamTypeFields = ["SESSION", "MESSAGE", "COMPLETE", "ERROR"]
    for (const field of streamTypeFields) {
      if (typeof streamTypes[field] !== "string") {
        validationErrors.push(`streamTypes.${field} must be a string`)
      }
    }
  }

  // Optional string fields (validate type if present)
  if (payload.sessionCookie !== undefined && typeof payload.sessionCookie !== "string") {
    validationErrors.push("sessionCookie must be a string")
  }
  if (payload.model !== undefined && typeof payload.model !== "string") {
    validationErrors.push("model must be a string")
  }
  if (payload.systemPrompt !== undefined && typeof payload.systemPrompt !== "string") {
    validationErrors.push("systemPrompt must be a string")
  }
  if (payload.resume !== undefined && typeof payload.resume !== "string") {
    validationErrors.push("resume must be a string")
  }
  if (payload.apiKey !== undefined) {
    validationErrors.push("apiKey is not supported; use oauthAccessToken")
  }
  if (typeof payload.oauthAccessToken !== "string" || payload.oauthAccessToken.length === 0) {
    validationErrors.push("oauthAccessToken is required and must be a non-empty string")
  }

  // Optional numeric field (validate type and bounds if present)
  if (payload.maxTurns !== undefined) {
    if (!Number.isInteger(payload.maxTurns) || payload.maxTurns < 1) {
      validationErrors.push("maxTurns must be a positive integer")
    }
  }

  if (payload.executionMode !== undefined && !EXECUTION_MODES.has(payload.executionMode)) {
    validationErrors.push("executionMode must be 'systemd' or 'e2b'")
  }
  if (payload.executionMode === "e2b") {
    if (!payload.sandboxDomain || typeof payload.sandboxDomain !== "object") {
      validationErrors.push("sandboxDomain is required when executionMode is 'e2b'")
    } else {
      const domain = payload.sandboxDomain
      if (typeof domain.domain_id !== "string" || domain.domain_id.length === 0) {
        validationErrors.push("sandboxDomain.domain_id must be a non-empty string")
      }
      if (typeof domain.hostname !== "string" || domain.hostname.length === 0) {
        validationErrors.push("sandboxDomain.hostname must be a non-empty string")
      }
      if (domain.sandbox_id !== null && typeof domain.sandbox_id !== "string") {
        validationErrors.push("sandboxDomain.sandbox_id must be string|null")
      }
      if (domain.sandbox_status !== null && !SANDBOX_STATUSES.has(domain.sandbox_status)) {
        validationErrors.push("sandboxDomain.sandbox_status must be 'creating'|'running'|'dead'|null")
      }
      if (domain.is_test_env !== undefined && typeof domain.is_test_env !== "boolean") {
        validationErrors.push("sandboxDomain.is_test_env must be boolean|undefined")
      }
    }
  }

  // Optional object fields
  if (oauthMcpServers !== undefined && (typeof oauthMcpServers !== "object" || oauthMcpServers === null)) {
    validationErrors.push("oauthMcpServers must be an object")
  }
  if (payload.oauthTokens !== undefined && (typeof payload.oauthTokens !== "object" || payload.oauthTokens === null)) {
    validationErrors.push("oauthTokens must be an object")
  }
  if (payload.userEnvKeys !== undefined && (typeof payload.userEnvKeys !== "object" || payload.userEnvKeys === null)) {
    validationErrors.push("userEnvKeys must be an object")
  }
  if (extraTools !== undefined && extraTools !== null) {
    if (!Array.isArray(extraTools)) {
      validationErrors.push("extraTools must be an array")
    } else if (!extraTools.every(t => typeof t === "string")) {
      validationErrors.push("extraTools must contain only strings")
    }
  }

  if (validationErrors.length > 0) {
    ipc.send({ type: "error", requestId, error: `Invalid payload: ${validationErrors.join(", ")}` })
    clearQueryState()
    return
  }

  currentAbortController = new AbortController()
  const { signal } = currentAbortController

  // Declare these outside try so they're accessible in catch
  let messageCount = 0
  let queryResult = null
  const stderrBuffer = [] // Captures Claude subprocess stderr for error debugging
  const recentMessageTypes = [] // Last few SDK message types/subtypes to aid crash diagnosis
  let initMcpStatusSummary = null
  let initMcpStatusByServer = null
  let initSessionId = null
  let connectedProviders = []
  let enabledMcpServerKeys = []

  try {
    // SECURITY: Isolate process.env between requests to prevent credential leakage.
    // See src/env-isolation.ts for the full contract.
    const envResult = prepareRequestEnv(payload)
    console.error(`[worker] Using ${envResult.authSource} access token from payload`)
    if (envResult.userEnvKeyCount > 0) {
      console.error(`[worker] Set ${envResult.userEnvKeyCount} user environment key(s)`)
    }

    // Get OAuth tokens for connected MCP providers
    const oauthTokens = payload.oauthTokens || {}
    connectedProviders = Object.keys(oauthTokens).filter(key => !!oauthTokens[key])
    if (connectedProviders.length > 0) {
      console.error(`[worker] Connected OAuth providers: ${connectedProviders.join(", ")}`)
    }

    console.error(`[worker] Allowed tools count: ${allowedTools.length}`)
    console.error(`[worker] Permission mode: "${permissionMode}"`)

    // Stream mode: determines tool availability
    const rawStreamMode = typeof agentConfig.streamMode === "string" ? agentConfig.streamMode : null
    const requestedStreamMode = rawStreamMode && Object.hasOwn(STREAM_MODES, rawStreamMode) ? rawStreamMode : "default"
    const streamMode = resolveStreamMode(requestedStreamMode, {
      isAdmin: !!agentConfig.isAdmin,
      isSuperadmin: !!agentConfig.isSuperadmin,
    })
    const modeConfig = STREAM_MODES[streamMode]
    if (rawStreamMode && rawStreamMode !== requestedStreamMode) {
      console.error(`[worker] Invalid streamMode "${rawStreamMode}", falling back to "${requestedStreamMode}"`)
    }
    if (requestedStreamMode !== streamMode) {
      console.error(`[worker] Unauthorized streamMode "${requestedStreamMode}", falling back to "${streamMode}"`)
    }
    if (streamMode !== "default") {
      console.error(`[worker] Stream mode: ${streamMode} (MCP enabled: ${modeConfig.mcpEnabled})`)
    }

    const toolContext = createStreamToolContext({
      isAdmin: !!agentConfig.isAdmin,
      isSuperadmin: !!agentConfig.isSuperadmin,
      isSuperadminWorkspace: !!agentConfig.isSuperadminWorkspace,
      mode: streamMode,
      connectedProviders,
    })

    // SDK canUseTool: DEAD — never called (SDK v0.2.41). See CLAUDE.md rule #24.
    // Security enforced by: allowedTools/disallowedTools + cwd sandboxing + MCP validateWorkspacePath.
    // Static analysis enforces this stays empty — see scripts/validation/check-canUseTool-dead.sh
    // canUseTool:disabled
    const canUseTool = undefined

    // Build MCP servers: internal (created locally) + global HTTP + OAuth (received via IPC)
    // Internal SDK MCP servers cannot be serialized via IPC because
    // createSdkMcpServer returns function objects.
    // They must be imported and created locally in the worker.

    // Build global HTTP MCP servers (always available, no auth required)
    // These are defined in GLOBAL_MCP_PROVIDERS in @webalive/shared
    const globalMcpServers = {}
    for (const [providerKey, config] of Object.entries(GLOBAL_MCP_PROVIDERS)) {
      globalMcpServers[providerKey] = {
        type: "http",
        url: config.url,
      }
    }

    // Optional MCP servers — only loaded when extraTools references them
    const OPTIONAL_MCP_REGISTRY = { "alive-email": emailInternalMcp }
    const optionalMcpServers = {}
    if (extraTools?.length) {
      const requiredServers = new Set()
      for (const tool of extraTools) {
        const match = tool.match(/^mcp__([^_]+(?:-[^_]+)*)__/)
        if (match) requiredServers.add(match[1])
      }
      for (const serverName of requiredServers) {
        if (OPTIONAL_MCP_REGISTRY[serverName]) {
          optionalMcpServers[serverName] = OPTIONAL_MCP_REGISTRY[serverName]
          console.error(`[worker] Loaded optional MCP server: ${serverName}`)
        }
      }
    }

    // Only register alive-sandboxed-fs when its tools are actually allowed.
    // Superadmin sessions use SDK built-in file tools directly; registering
    // the sandboxed-fs MCP server with no allowed tools causes SDK errors.
    const needsSandboxedFs = allowedTools.some(t => t.startsWith("mcp__alive-sandboxed-fs__"))

    const mcpServers = modeConfig.mcpEnabled
      ? {
          "alive-workspace": workspaceInternalMcp,
          "alive-tools": toolsInternalMcp,
          ...(needsSandboxedFs ? { "alive-sandboxed-fs": sandboxedFsInternalMcp } : {}),
          ...optionalMcpServers,
          ...globalMcpServers,
          ...(oauthMcpServers || {}),
        }
      : {}

    // E2B sandbox routing: swap file/shell tools to remote sandbox.
    // The SDK cwd stays local (needed for subprocess), but Claude sees SANDBOX_WORKSPACE_ROOT
    // in the system prompt and all file ops go through the sandbox MCP.
    if (payload.executionMode === "e2b" && payload.sandboxDomain) {
      if (!modeConfig.mcpEnabled) {
        throw new Error(
          `[worker] executionMode=e2b requires MCP routing, but streamMode="${streamMode}" has mcpEnabled=false`,
        )
      }
      try {
        const template = resolveSandboxTemplate(payload.sandboxDomain.hostname)
        const manager = getSandboxManager(template)
        const hostWorkspacePath = process.cwd()
        const sandbox = await manager.getOrCreate(payload.sandboxDomain, hostWorkspacePath)
        mcpServers.e2b = createE2bMcp(
          sandbox,
          (error, context) => {
            Sentry.captureException(error, {
              tags: { component: "e2b", security: "path_traversal", domain: payload.sandboxDomain.hostname },
              extra: context,
            })
          },
          {
            hostname: payload.sandboxDomain.hostname,
            previewBase: DEFAULTS.PREVIEW_BASE,
          },
        )
        // Swap SDK built-in file/shell tools for E2B MCP equivalents.
        // This is the SINGLE place E2B tool routing happens — not in agent-constants.mjs.
        disallowedTools.push(...E2B_DISABLED_SDK_TOOLS)
        allowedTools.push(...E2B_MCP_TOOLS)
        // E2B mode: strip ALL internal/global MCP servers. Only e2b MCP remains.
        for (const key of Object.keys(mcpServers)) {
          if (key !== "e2b") delete mcpServers[key]
        }
        console.error(
          `[worker] E2B mode: template ${template}, sandbox ${sandbox.sandboxId} for ${payload.sandboxDomain.hostname}, workspace at ${SANDBOX_WORKSPACE_ROOT}`,
        )
      } catch (e2bError) {
        const ctx = payload.sandboxDomain
        const wrapped = new Error(
          `[E2B] Sandbox setup failed for ${ctx.hostname} (domain_id=${ctx.domain_id}, sandbox_id=${ctx.sandbox_id}): ${e2bError instanceof Error ? e2bError.message : String(e2bError)}`,
        )
        if (e2bError instanceof Error) wrapped.cause = e2bError
        Sentry.captureException(wrapped, {
          tags: { component: "e2b", domain: ctx.hostname },
          extra: { domain_id: ctx.domain_id, sandbox_id: ctx.sandbox_id },
        })
        throw wrapped
      }
    }

    enabledMcpServerKeys = Object.keys(mcpServers)

    console.error("[worker] MCP servers enabled:", enabledMcpServerKeys.join(", "))
    console.error("[worker] Resume session:", payload.resume || "none (new session)")
    if (payload.resumeSessionAt) {
      console.error("[worker] Resume at message:", payload.resumeSessionAt)
    }

    timing("before_sdk_query")

    // Capture stderr from agent subprocess for error debugging.
    // With ANTHROPIC_LOG=debug, this also captures HTTP request/response logs.
    // Filter in journalctl: grep "worker:claude-stderr"
    // Network logs specifically: grep "anthropic:debug"
    const stderrHandler = message => {
      stderrBuffer.push(message)
      // Keep last 100 lines (increased from 50 for network debug output)
      if (stderrBuffer.length > 100) stderrBuffer.shift()
      // Tag network-related stderr distinctly for easy filtering
      const isNetworkLog =
        typeof message === "string" &&
        (message.includes("request") || message.includes("response") || message.includes("retry"))
      const tag = isNetworkLog ? "worker:anthropic-net" : "worker:claude-stderr"
      console.error(`[${tag}] ${message}`)
    }

    await withSearchToolsConnectedProviders(connectedProviders, async () => {
      // Bun auto-loads workspace .env files unless disabled. We must disable that
      // to ensure auth never comes from project-local .env state.
      const isBunRuntime = typeof Bun !== "undefined"
      const claudeExecutable = isBunRuntime ? "bun" : "node"
      const claudeExecutableArgs = isBunRuntime ? ["--no-env-file"] : []

      // SECURITY (defense-in-depth): Build explicit env for the Claude subprocess.
      // Even though createWorkerSpawnEnv() already strips secrets at spawn time,
      // this ensures the SDK subprocess never inherits anything unexpected.
      // Infrastructure keys are stripped — they're only needed by the worker process itself.
      const SDK_STRIP_KEYS = new Set(E2B_INFRASTRUCTURE_ENV_KEYS)
      const sdkEnv = {}
      for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined && !SDK_STRIP_KEYS.has(key)) sdkEnv[key] = value
      }

      // NETWORK LOGGING: Enable Anthropic SDK HTTP request/response logging.
      // The @anthropic-ai/sdk inside cli.js reads ANTHROPIC_LOG and logs
      // request method, URL, status, headers, and timing to stderr.
      // Our stderrHandler captures this into stderrBuffer → journalctl.
      sdkEnv.ANTHROPIC_LOG = "debug"

      // Disable GrowthBook feature flags in SDK subprocess.
      // Without this, built-in CLI skills (keybindings-help) pollute the system prompt.
      // Feature flags default to safe values (off) when nonessential traffic is disabled.
      sdkEnv.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"

      // SDK CALL LOGGING: Route API calls through local proxy to capture raw
      // request/response bodies. Proxy runs at scripts/sdk-log-proxy.ts.
      // Requires explicit opt-in via ENABLE_SDK_LOG_PROXY=1 (disabled in production).
      const sdkLogProxyUrl = process.env.SDK_LOG_PROXY_URL
      if (process.env.ENABLE_SDK_LOG_PROXY === "1" && sdkLogProxyUrl) {
        try {
          const probe = await fetch(`${sdkLogProxyUrl}/health`, { signal: AbortSignal.timeout(200) })
          if (probe.ok) {
            sdkEnv.ANTHROPIC_BASE_URL = sdkLogProxyUrl
            console.error(`[worker] SDK log proxy enabled — routing API calls through ${sdkLogProxyUrl}`)
          }
        } catch {}
      }

      const agentQuery = query({
        prompt: payload.message,
        options: {
          cwd: process.cwd(),
          executable: claudeExecutable,
          executableArgs: claudeExecutableArgs,
          model: payload.model,
          maxTurns: payload.maxTurns || DEFAULTS.CLAUDE_MAX_TURNS,
          permissionMode,
          ...(permissionMode === "bypassPermissions" ? { allowDangerouslySkipPermissions: true } : {}),
          allowedTools,
          disallowedTools,
          canUseTool,
          settingSources,
          mcpServers,
          systemPrompt: payload.systemPrompt,
          resume: payload.resume,
          resumeSessionAt: payload.resumeSessionAt,
          abortSignal: signal,
          stderr: stderrHandler,
          strictMcpConfig: true,
          env: sdkEnv,
        },
      })

      let firstMessageLogged = false

      for await (const message of agentQuery) {
        // Log first message timing
        if (!firstMessageLogged) {
          firstMessageLogged = true
          timing("first_sdk_message")
        }

        // Check for cancellation
        if (signal.aborted) {
          console.error("[worker] Query aborted")
          break
        }

        messageCount++

        const messageTag = message.subtype ? `${message.type}:${message.subtype}` : message.type
        recentMessageTypes.push(messageTag)
        if (recentMessageTypes.length > 12) {
          recentMessageTypes.shift()
        }

        if (message.type === "result") {
          queryResult = message
        }

        // Capture session ID from system init message
        if (message.type === "system" && message.subtype === "init" && message.session_id) {
          initSessionId = message.session_id
          console.error(`[worker] Session ID: ${message.session_id}`)

          if (Array.isArray(message.mcp_servers)) {
            initMcpStatusSummary = summarizeMcpStatuses(message.mcp_servers)
            initMcpStatusByServer = message.mcp_servers.map(server => ({
              name: typeof server?.name === "string" ? server.name : "unknown",
              status: typeof server?.status === "string" ? server.status : "unknown",
            }))
            console.error("[worker] MCP status summary:", JSON.stringify(initMcpStatusSummary))
          }

          ipc.send({
            type: "session",
            requestId,
            sessionId: message.session_id,
          })
        }

        // Filter system init message to only show allowed + client-visible tools
        let outputMessage = message
        if (message.type === "system" && message.subtype === "init" && message.tools) {
          outputMessage = {
            ...message,
            tools: message.tools.filter(tool => isStreamInitVisibleTool(tool, toolContext, allowedTools)),
          }
        }

        // Stream message to parent
        ipc.send({
          type: "message",
          requestId,
          content: {
            type: streamTypes.MESSAGE,
            messageCount,
            messageType: message.type,
            content: outputMessage,
          },
        })
      }
    })

    // Send completion (include cancelled flag if aborted)
    const wasCancelled = signal.aborted
    ipc.send({
      type: "complete",
      requestId,
      result: {
        type: streamTypes.COMPLETE,
        totalMessages: messageCount,
        result: queryResult,
        cancelled: wasCancelled,
      },
    })

    queriesProcessed++
    const status = wasCancelled ? "cancelled" : "complete"
    console.error(`[worker] Query ${status}: ${messageCount} messages (total: ${queriesProcessed})`)
  } catch (error) {
    // Check if we already received a successful result before the error
    // The agent SDK sometimes exits with code 1 AFTER yielding all messages including the result
    // In this case, treat it as success since we have the complete response
    if (queryResult && queryResult.subtype === "success") {
      const stderrSnippet = stderrBuffer.length > 0 ? stderrBuffer.slice(-5).join("\n") : ""
      console.error(
        "[worker] Query completed with result before error - treating as success\n" +
          `  Suppressed error: ${error?.message || String(error)}\n` +
          `  Messages received: ${messageCount}` +
          (stderrSnippet ? `\n  Stderr (last 5 lines):\n${stderrSnippet}` : ""),
      )

      // Send completion with the result we already have
      ipc.send({
        type: "complete",
        requestId,
        result: {
          type: streamTypes.COMPLETE,
          totalMessages: messageCount,
          result: queryResult,
          cancelled: false,
        },
      })

      queriesProcessed++
      console.error(`[worker] Query complete: ${messageCount} messages (total: ${queriesProcessed})`)
    } else {
      // No successful result yet. If SDK emitted a structured error result before exit,
      // surface that error text instead of the generic "exited with code 1".
      let surfacedErrorMessage = error?.message || String(error)
      const structuredErrors = extractStructuredResultErrors(queryResult)
      if (structuredErrors.length > 0) {
        surfacedErrorMessage = structuredErrors.join("; ")
        console.error("[worker] Structured SDK error before CLI exit:", surfacedErrorMessage)
      }

      const stderrOutput = stderrBuffer?.length ? stderrBuffer.join("\n") : null

      // Emit one compact diagnostics payload so debuggers can identify
      // stale session vs MCP failure vs permission flow issues quickly.
      const failureDiagnostics = {
        requestId,
        messageCount,
        permissionMode,
        resume: payload.resume || null,
        resumeSessionAt: payload.resumeSessionAt || null,
        connectedProviders,
        mcpServersEnabled: enabledMcpServerKeys,
        initSessionId,
        initMcpStatusSummary,
        initMcpStatusByServer,
        queryResultSubtype: queryResult?.subtype || null,
        queryResultIsError: queryResult?.is_error === true,
        queryResultErrors: structuredErrors,
        recentMessageTypes,
        stderrLinesCaptured: stderrBuffer.length,
        surfacedErrorMessage,
        originalErrorMessage: error?.message || String(error),
      }
      console.error("[worker] Query failure diagnostics:", JSON.stringify(failureDiagnostics))

      console.error("[worker] Query error:", error?.stack || String(error))
      if (stderrOutput) {
        console.error("[worker] Claude stderr:", stderrOutput)
      }
      ipc.send({
        type: "error",
        requestId,
        error: surfacedErrorMessage,
        stack: error?.stack,
        stderr: stderrOutput,
        diagnostics: failureDiagnostics,
      })
    }
  } finally {
    clearQueryState()
  }
}

function handleCancel(requestId) {
  if (currentRequestId === requestId && currentAbortController) {
    console.error(`[worker] Cancelling query: ${requestId}`)
    currentAbortController.abort()
    // CRITICAL: Clear state immediately so worker can accept new queries
    // The handleQuery finally block will also call clearQueryState() but that's harmless
    clearQueryState()
    console.error("[worker] Query state cleared after cancel")
  }
}

async function handleShutdown(ipc, graceful) {
  console.error(`[worker] Shutdown requested (graceful: ${graceful})`)

  if (graceful && currentRequestId) {
    console.error("[worker] Waiting for current query to complete (max 10s)...")

    // Wait with timeout - don't block forever
    const startWait = Date.now()
    while (currentRequestId && Date.now() - startWait < SHUTDOWN_TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, 100))
    }

    if (currentRequestId) {
      console.error("[worker] Timeout waiting for query, aborting...")
      currentAbortController?.abort()
      // Give it a moment to clean up
      await new Promise(r => setTimeout(r, 500))
    }
  }

  ipc.send({ type: "shutdown_ack" })
  console.error("[worker] Shutdown acknowledged, exiting")
  process.exit(0)
}

function handleHealthCheck(ipc) {
  const uptime = Math.floor((Date.now() - startTime) / 1000)
  ipc.send({
    type: "health_ok",
    uptime,
    queriesProcessed,
  })
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const socketPath = process.env.WORKER_SOCKET_PATH
  const workspaceKey = process.env.WORKER_WORKSPACE_KEY

  if (!socketPath) {
    console.error("[worker] WORKER_SOCKET_PATH not set")
    process.exit(1)
  }

  console.error(`[worker] Starting persistent worker for ${workspaceKey}`)
  console.error(`[worker] Socket: ${socketPath}`)

  // Connect to parent via Unix socket BEFORE dropping privileges
  // The socket directory has restrictive permissions (0o700 root only)
  // so we must connect while still running as root
  const ipc = new IpcClient(socketPath)

  try {
    await ipc.connect()
    console.error("[worker] Connected to IPC socket")
  } catch (error) {
    console.error("[worker] Failed to connect:", error?.message || String(error))
    process.exit(1)
  }

  // Now drop privileges - the socket connection stays open
  dropPrivileges()
  ipc.onMessage = msg => {
    // SECURITY: Validate message structure
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") {
      console.error("[worker] Invalid message received:", msg)
      return
    }

    switch (msg.type) {
      case "query": {
        // SECURITY: Validate required fields
        if (typeof msg.requestId !== "string" || !msg.requestId) {
          console.error("[worker] Query message missing valid requestId")
          return
        }
        if (!msg.payload || typeof msg.payload !== "object") {
          console.error("[worker] Query message missing valid payload")
          ipc.send({ type: "error", requestId: msg.requestId, error: "Invalid payload" })
          return
        }

        if (currentRequestId) {
          // Worker is busy - reject immediately
          // The parent should handle queuing or routing to another worker
          ipc.send({
            type: "error",
            requestId: msg.requestId,
            error: "Worker busy - already processing a query",
          })
          return
        }
        currentRequestId = msg.requestId
        // IMPORTANT: Must catch any unhandled promise rejections
        // If handleQuery rejects and we don't catch it, the parent never
        // receives complete/error and thinks the worker is still busy forever
        handleQuery(ipc, msg.requestId, msg.payload).catch(err => {
          console.error("[worker] FATAL: Unhandled error in handleQuery:", err)
          ipc.send({
            type: "error",
            requestId: msg.requestId,
            error: `Unhandled worker error: ${err?.message || String(err)}`,
          })
          clearQueryState()
        })
        break
      }
      case "cancel":
        // SECURITY: Validate requestId for cancel
        if (typeof msg.requestId !== "string" || !msg.requestId) {
          console.error("[worker] Cancel message missing valid requestId")
          return
        }
        handleCancel(msg.requestId)
        break
      case "shutdown":
        handleShutdown(ipc, !!msg.graceful).catch(err => {
          console.error("[worker] FATAL: Shutdown failed:", err)
          process.exit(1)
        })
        break
      case "health_check":
        handleHealthCheck(ipc)
        break
      default:
        console.error(`[worker] Unknown message type: ${msg.type}`)
    }
  }

  // Signal ready to parent
  ipc.send({ type: "ready" })
  console.error("[worker] Ready and waiting for queries")

  // Keep process alive
  // The socket 'close' event will trigger exit
}

main().catch(err => {
  console.error("[worker] FATAL: Worker main() failed:", err)
  process.exit(1)
})
