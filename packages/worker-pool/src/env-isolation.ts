/**
 * Environment isolation for worker processes.
 *
 * Two layers of protection:
 *  1. SPAWN: createWorkerSpawnEnv() — allowlist of env vars passed to worker on spawn
 *  2. REQUEST: prepareRequestEnv() — per-request auth isolation within worker
 *
 * SECURITY CRITICAL: The parent process (Next.js) has secrets that must NEVER
 * leak to workspace users. Without the spawn allowlist, running `env` in Bash
 * exposes SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, JWT_SECRET, and ~30 more.
 *
 * OAuth token flow: docs/knowledge/ANTHROPIC_OAUTH_DO_NOT_DELETE.md § "Token Flow Through the System"
 */
import { RESERVED_USER_ENV_KEYS } from "@webalive/shared"

const RESERVED_USER_ENV_KEY_SET = new Set<string>(RESERVED_USER_ENV_KEYS)
const VALID_USER_ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/

/**
 * E2B infrastructure env keys — needed by the WORKER process (SandboxManager)
 * but must be STRIPPED from the SDK subprocess env.
 *
 * Single source of truth: used in WORKER_SPAWN_ALLOWED_ENV_KEYS (allow into
 * worker) and SDK_STRIP_KEYS in worker-entry.mjs (strip from subprocess).
 */
export const E2B_INFRASTRUCTURE_ENV_KEYS = [
  "E2B_API_KEY",
  "E2B_DOMAIN",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const

/**
 * Env vars safe to pass from the parent process to worker processes.
 *
 * ADDING TO THIS LIST? Ask: "Would it be a security incident if a user
 * ran `echo $THIS_VAR` in their workspace?" If yes, don't add it.
 */
const WORKER_SPAWN_ALLOWED_ENV_KEYS = [
  // System essentials — needed for binaries to run
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "NODE_ENV",

  // Temp directories — processes need a writable temp dir
  "TMPDIR",
  "TMP",
  "TEMP",

  // Bun runtime — needed for bun to find its install and modules
  "BUN_INSTALL",

  // Node module resolution — Docker uses NODE_PATH for worker-deps
  "NODE_PATH",

  // Claude SDK config — needed for SDK to find credentials/config
  "CLAUDE_CONFIG_DIR",
  "CLAUDECODE",

  // MCP tool API callbacks — tools call back to Alive via localhost
  "PORT",
  "BRIDGE_API_PORT",
  "INTERNAL_TOOLS_SECRET",

  // Workspace config — worker needs to know workspace boundaries
  "WORKSPACE_BASE",
  "STREAM_ENV",
  "SERVER_CONFIG_PATH",

  // E2B sandbox — needed by SandboxManager, stripped from SDK subprocess env.
  ...E2B_INFRASTRUCTURE_ENV_KEYS,
] as const

/**
 * Build a sandboxed env for worker subprocess spawn.
 *
 * Uses an ALLOWLIST — only explicitly listed vars pass through.
 * Everything else (database creds, API keys, OAuth secrets, JWT_SECRET,
 * SUPABASE_SERVICE_ROLE_KEY, etc.) is excluded.
 *
 * Called by WorkerPoolManager.spawnWorker().
 */
export function createWorkerSpawnEnv(extras: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}

  for (const key of WORKER_SPAWN_ALLOWED_ENV_KEYS) {
    const val = process.env[key]
    if (val !== undefined) {
      env[key] = val
    }
  }

  // Ensure temp dirs default to /tmp (safe, world-writable)
  env.TMPDIR ??= "/tmp"
  env.TMP ??= "/tmp"
  env.TEMP ??= "/tmp"

  // Test-only worker behavior flag for integration tests (not passed in production runs).
  if (process.env.VITEST === "true" && process.env.TEST_WORKER_MODE !== undefined) {
    env.TEST_WORKER_MODE = process.env.TEST_WORKER_MODE
  }

  // Merge caller-provided extras (worker-specific vars like TARGET_UID etc.)
  Object.assign(env, extras)

  return env
}

/** Subset of the IPC payload that affects process.env */
export interface EnvPayload {
  sessionCookie?: string
  oauthAccessToken: string
  userEnvKeys?: Record<string, string>
}

export interface EnvPrepResult {
  authSource: "oauth"
  userEnvKeyCount: number
}

/**
 * Prepare process.env for a new worker request.
 *
 * MUST be called before every `query()` invocation to prevent env leakage
 * between users sharing the same worker process.
 *
 * Invariants enforced:
 *  1. ALIVE_SESSION_COOKIE is always set (or cleared to "")
 *  2. Auth env is always explicit per request via oauthAccessToken,
 *     and auth-related fallback vars are cleared to avoid stale/leaked credentials.
 *  3. ANTHROPIC_API_KEY is always set to "" (not deleted)
 *     — prevents workspace .env files from overriding OAuth credentials
 *  4. All previous USER_* keys are deleted before new ones are applied
 *  5. USER_* key names are validated (uppercase alphanumeric + underscore)
 *  6. Reserved env keys (for example ASK_LARS_KEY) are never injected
 */
export function prepareRequestEnv(payload: EnvPayload): EnvPrepResult {
  // 1. Session cookie — always overwrite to prevent cross-user leakage
  process.env.ALIVE_SESSION_COOKIE = payload.sessionCookie || ""

  // 2. Clear alternate auth channels we don't use for worker auth.
  //    Worker auth must be explicit from payload, never implicit from process env.
  process.env.ANTHROPIC_AUTH_TOKEN = ""
  process.env.CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR = ""
  process.env.CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR = ""

  // 3. OAuth token auth only.
  //    IMPORTANT: Set ANTHROPIC_API_KEY to "" (not delete). Deleting allows the
  //    Claude CLI subprocess to pick up ANTHROPIC_API_KEY from workspace .env
  //    files, which would override OAuth with a potentially stale user key.
  //    An empty string is treated as unset by the CLI.
  process.env.ANTHROPIC_API_KEY = ""
  if (!payload.oauthAccessToken) {
    throw new Error("oauthAccessToken is required — OAuth is the sole auth channel")
  }
  process.env.CLAUDE_CODE_OAUTH_TOKEN = payload.oauthAccessToken

  // 4. Clear ALL previous USER_* env keys before setting new ones
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("USER_")) {
      delete process.env[key]
    }
  }

  // 5. Apply new user env keys (validated format only)
  const userEnvKeys = payload.userEnvKeys || {}
  let appliedCount = 0
  for (const [keyName, keyValue] of Object.entries(userEnvKeys)) {
    if (!VALID_USER_ENV_KEY_PATTERN.test(keyName)) continue
    if (RESERVED_USER_ENV_KEY_SET.has(keyName)) continue

    process.env[`USER_${keyName}`] = keyValue
    appliedCount++
  }

  return { authSource: "oauth", userEnvKeyCount: appliedCount }
}
