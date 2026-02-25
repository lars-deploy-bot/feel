/**
 * Anthropic OAuth Token Refresh
 *
 * READ FIRST: docs/knowledge/ANTHROPIC_OAUTH_DO_NOT_DELETE.md
 *
 * This file refreshes expired OAuth tokens for Claude Pro/Max subscriptions.
 * It coordinates with Claude Code CLI via a shared directory lock on ~/.claude.
 * The lock target, retry parameters, and double-check pattern are all derived
 * from reverse-engineering the CLI binary — see the knowledge doc for details.
 *
 * DO NOT change the lock target, retry config, or refresh flow without reading
 * and updating the knowledge doc first.
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import * as Sentry from "@sentry/nextjs"
import { retryAsync } from "@webalive/shared"
import lockfile, { type LockOptions } from "proper-lockfile"

// Anthropic OAuth constants (same as Claude Code / OpenClaw)
const ANTHROPIC_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token"
const ANTHROPIC_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"

// Refresh 5 minutes before actual expiry to prevent edge cases
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000
// Proactive refresh: maintain at least 2h validity to avoid hard refresh windows.
const PROACTIVE_REFRESH_MIN_VALIDITY_MS = 2 * 60 * 60 * 1000
const PROACTIVE_REFRESH_CHECK_INTERVAL_MS = 15 * 60 * 1000
const INVALID_GRANT_ESCALATION_THRESHOLD = 3
const INVALID_GRANT_SUPPRESSION_LOG_INTERVAL_MS = 60 * 60 * 1000

// Path to Claude Code credentials
const CLAUDE_DIR = path.join(os.homedir(), ".claude")
const CLAUDE_CREDENTIALS_PATH = path.join(CLAUDE_DIR, ".credentials.json")
// 0o711 means:
// - owner (current process user) gets rwx and can create lock files + write credentials
// - group/others get --x for traversal only (needed in UID-drop worker paths)
// We set this explicitly to avoid umask-dependent directory modes.
const CLAUDE_DIR_MODE = 0o711

// Lock the DIRECTORY (~/.claude), not the credentials file.
// Claude Code CLI locks the same directory. See: docs/knowledge/ANTHROPIC_OAUTH_DO_NOT_DELETE.md § "The Lock Contract"
const LOCK_OPTIONS: LockOptions = {
  retries: {
    retries: 5,
    factor: 1,
    minTimeout: 1000,
    maxTimeout: 2_000,
    randomize: true,
  },
  stale: 10_000, // Match CLI's stale timeout
}

export interface ClaudeOAuthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scopes?: string[]
  subscriptionType?: string
  rateLimitTier?: string
}

interface ClaudeCredentialsFile {
  claudeAiOauth?: ClaudeOAuthCredentials
}

interface TokenRefreshResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

interface AccessTokenOptions {
  minimumValidityMs?: number
}

let proactiveRefreshTimer: NodeJS.Timeout | null = null
let proactiveRefreshRunning = false
let invalidGrantState: {
  refreshToken: string | null
  consecutiveFailures: number
  escalated: boolean
  lastSuppressionLogAt: number
} = {
  refreshToken: null,
  consecutiveFailures: 0,
  escalated: false,
  lastSuppressionLogAt: 0,
}

/**
 * Ensure ~/.claude exists with deterministic permissions and is writable.
 * We lock this directory and write credentials under it, so write+execute are required.
 */
function ensureClaudeDirForWrites(): void {
  // Create directory with explicit mode so behavior is deterministic across services/umasks.
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true, mode: CLAUDE_DIR_MODE })
  }

  try {
    // W_OK + X_OK is required here:
    // - proper-lockfile needs to create/remove lock artifacts under the directory
    // - credential refresh needs to overwrite .credentials.json
    fs.accessSync(CLAUDE_DIR, fs.constants.W_OK | fs.constants.X_OK)
  } catch (error) {
    throw new Error(
      `[anthropic-oauth] CLAUDE_DIR is not writable/executable: ${CLAUDE_DIR}. Check directory permissions.`,
      { cause: error },
    )
  }
}

/**
 * Read Claude OAuth credentials from ~/.claude/.credentials.json
 */
export function readClaudeCredentials(): ClaudeOAuthCredentials | null {
  try {
    if (!fs.existsSync(CLAUDE_CREDENTIALS_PATH)) {
      return null
    }

    const content = fs.readFileSync(CLAUDE_CREDENTIALS_PATH, "utf-8")
    const data: ClaudeCredentialsFile = JSON.parse(content)

    if (!data.claudeAiOauth) {
      return null
    }

    const { accessToken, refreshToken, expiresAt } = data.claudeAiOauth

    if (!accessToken || !refreshToken || !expiresAt) {
      return null
    }

    return data.claudeAiOauth
  } catch (error) {
    console.error("[anthropic-oauth] Failed to read credentials:", error)
    Sentry.captureException(error)
    return null
  }
}

/**
 * Check if token is expired (with buffer)
 */
export function isTokenExpired(expiresAt: number): boolean {
  return shouldRefreshToken(expiresAt, TOKEN_EXPIRY_BUFFER_MS)
}

function shouldRefreshToken(expiresAt: number, minimumValidityMs: number): boolean {
  return Date.now() >= expiresAt - minimumValidityMs
}

function normalizeMinimumValidityMs(minimumValidityMs?: number): number {
  if (typeof minimumValidityMs !== "number" || !Number.isFinite(minimumValidityMs) || minimumValidityMs < 0) {
    return TOKEN_EXPIRY_BUFFER_MS
  }
  return minimumValidityMs
}

function isInvalidGrantRefreshError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("invalid_grant")
}

function resetInvalidGrantState(): void {
  invalidGrantState = {
    refreshToken: null,
    consecutiveFailures: 0,
    escalated: false,
    lastSuppressionLogAt: 0,
  }
}

/**
 * Check if an error is retryable (network errors, 5xx, rate limits)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes("fetch failed") || error.message.includes("ECONNRESET")) {
      return true
    }
    // Rate limiting or server errors
    if (error.message.includes("429") || error.message.includes("5")) {
      const statusMatch = error.message.match(/\((\d{3})\)/)
      if (statusMatch) {
        const status = parseInt(statusMatch[1], 10)
        return status === 429 || status >= 500
      }
    }
  }
  return false
}

/**
 * Refresh an expired Anthropic OAuth token with retry logic
 */
async function refreshTokenInternal(refreshToken: string): Promise<ClaudeOAuthCredentials> {
  console.log("[anthropic-oauth] Refreshing expired token...")

  return retryAsync(
    async () => {
      const response = await fetch(ANTHROPIC_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: ANTHROPIC_CLIENT_ID,
          refresh_token: refreshToken,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Anthropic token refresh failed (${response.status}): ${errorText}`)
      }

      const data: TokenRefreshResponse = await response.json()

      const newCredentials: ClaudeOAuthCredentials = {
        accessToken: data.access_token,
        // Match CLI defensive behavior: if refresh_token is omitted, retain existing token.
        // This is rare, but dropping the token here would permanently break future refreshes.
        refreshToken: data.refresh_token ?? refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      }

      console.log("[anthropic-oauth] Token refreshed, expires at:", new Date(newCredentials.expiresAt).toISOString())

      return newCredentials
    },
    {
      attempts: 3,
      minDelayMs: 500,
      maxDelayMs: 5000,
      jitter: 0.2,
      shouldRetry: isRetryableError,
      onRetry: ({ attempt, delayMs, err }) => {
        console.log(`[anthropic-oauth] Retry ${attempt}/3 in ${delayMs}ms:`, err instanceof Error ? err.message : err)
      },
    },
  )
}

/**
 * Save refreshed credentials back to ~/.claude/.credentials.json
 */
function saveCredentials(credentials: ClaudeOAuthCredentials): void {
  let existingData: ClaudeCredentialsFile = {}

  if (fs.existsSync(CLAUDE_CREDENTIALS_PATH)) {
    try {
      // Preserve any non-OAuth top-level fields in the credentials file.
      const content = fs.readFileSync(CLAUDE_CREDENTIALS_PATH, "utf-8")
      existingData = JSON.parse(content)
    } catch (error) {
      // Preserve availability: malformed JSON should not block saving a newly-refreshed token set.
      // We continue with an empty object and rewrite a clean claudeAiOauth payload.
      console.warn("[anthropic-oauth] Existing credentials JSON is invalid; overwriting with refreshed credentials")
      Sentry.captureException(error)
    }
  }

  try {
    existingData.claudeAiOauth = {
      ...existingData.claudeAiOauth,
      ...credentials,
    }

    // Ensure ~/.claude exists and is writable for lock and credential writes.
    ensureClaudeDirForWrites()

    // Write with 644 — workers need read access after UID drop.
    // CLI writes 600, but our systemd path unit or this code must ensure 644.
    // See: docs/knowledge/ANTHROPIC_OAUTH_DO_NOT_DELETE.md § "Permission requirements"
    fs.writeFileSync(CLAUDE_CREDENTIALS_PATH, JSON.stringify(existingData), { mode: 0o644 })
    // writeFileSync mode only applies on file creation. If the CLI wrote the file with 0o600,
    // permissions remain unchanged. Explicit chmod ensures workers can read after UID drop.
    fs.chmodSync(CLAUDE_CREDENTIALS_PATH, 0o644)

    console.log("[anthropic-oauth] Saved refreshed credentials to disk")
  } catch (error) {
    console.error("[anthropic-oauth] Failed to save credentials:", error)
    Sentry.captureException(error)
    // IMPORTANT: this must throw.
    // Anthropic uses rotating refresh tokens, so a successful refresh response means the previous
    // refresh token is now dead. If we fail to persist the new token and still return success,
    // the system is effectively locked out until manual re-auth (/login).
    throw error
  }
}

/**
 * Refresh token with file-based locking.
 * Prevents race conditions when multiple processes try to refresh simultaneously.
 */
async function refreshTokenWithLock(
  minimumValidityMs = TOKEN_EXPIRY_BUFFER_MS,
): Promise<ClaudeOAuthCredentials | null> {
  // Fast exit: if credentials file doesn't exist, do not create ~/.claude solely for locking.
  // This keeps this function side-effect free when OAuth is not configured.
  if (!fs.existsSync(CLAUDE_CREDENTIALS_PATH)) {
    return null
  }

  // Ensure lock target directory exists and is writable for lockfile creation.
  ensureClaudeDirForWrites()

  let release: (() => Promise<void>) | undefined

  try {
    console.log("[anthropic-oauth] Acquiring directory lock on ~/.claude ...")
    release = await lockfile.lock(CLAUDE_DIR, LOCK_OPTIONS)
    console.log("[anthropic-oauth] Lock acquired")

    // Critical race-avoidance step:
    // Re-read credentials after acquiring lock because another process may have refreshed
    // (and rotated the refresh token) while we were waiting.
    const credentials = readClaudeCredentials()
    if (!credentials) {
      return null
    }

    // If token is no longer expired after lock, another process already completed refresh.
    // Return the latest disk value without making another refresh call.
    if (!shouldRefreshToken(credentials.expiresAt, minimumValidityMs)) {
      console.log("[anthropic-oauth] Token was refreshed by another process")
      return credentials
    }

    // Perform the actual refresh
    const newCredentials = await refreshTokenInternal(credentials.refreshToken)
    saveCredentials(newCredentials)
    return newCredentials
  } finally {
    if (release) {
      try {
        await release()
        console.log("[anthropic-oauth] Lock released")
      } catch {
        // Ignore unlock errors (lock may have been released already)
      }
    }
  }
}

/**
 * Get a valid access token, refreshing if necessary.
 * Uses file-based locking (proper-lockfile) to prevent race conditions
 * when multiple processes try to refresh the same token simultaneously.
 */
export async function getValidAccessToken(options?: AccessTokenOptions): Promise<{
  accessToken: string
  refreshed: boolean
} | null> {
  const minimumValidityMs = normalizeMinimumValidityMs(options?.minimumValidityMs)
  const credentials = readClaudeCredentials()

  if (!credentials) {
    return null
  }

  // Token still valid - no refresh needed
  if (!shouldRefreshToken(credentials.expiresAt, minimumValidityMs)) {
    return {
      accessToken: credentials.accessToken,
      refreshed: false,
    }
  }

  // Token expired/expiring soon - refresh with file lock
  console.log("[anthropic-oauth] Token expired or nearing expiry, refreshing...")

  try {
    const refreshed = await refreshTokenWithLock(minimumValidityMs)
    if (!refreshed) {
      return null
    }
    return {
      accessToken: refreshed.accessToken,
      refreshed: true,
    }
  } catch (error) {
    console.error("[anthropic-oauth] Token refresh failed:", error)
    Sentry.captureException(error)
    throw error
  }
}

async function runProactiveRefreshTick(reason: "startup" | "interval"): Promise<void> {
  if (proactiveRefreshRunning) {
    return
  }
  proactiveRefreshRunning = true
  let attemptedRefreshToken: string | null = null

  try {
    const credentials = readClaudeCredentials()
    if (!credentials) {
      return
    }
    const currentRefreshToken = credentials.refreshToken

    // Reset dead-chain state when credentials rotate (e.g. after /login).
    if (invalidGrantState.refreshToken && invalidGrantState.refreshToken !== currentRefreshToken) {
      console.log("[anthropic-oauth] Detected refresh token change, clearing invalid_grant state")
      resetInvalidGrantState()
    }

    // Avoid retrying a known-dead chain forever. Wait for a new login/token write.
    if (invalidGrantState.refreshToken === currentRefreshToken && invalidGrantState.consecutiveFailures > 0) {
      const now = Date.now()
      if (now - invalidGrantState.lastSuppressionLogAt >= INVALID_GRANT_SUPPRESSION_LOG_INTERVAL_MS) {
        invalidGrantState.lastSuppressionLogAt = now
        console.error(
          "[anthropic-oauth] Proactive refresh suppressed: refresh token chain is marked invalid_grant. Run /login to recover.",
        )
      }
      return
    }

    if (!shouldRefreshToken(credentials.expiresAt, PROACTIVE_REFRESH_MIN_VALIDITY_MS)) {
      return
    }

    const minutesLeft = Math.max(0, Math.round((credentials.expiresAt - Date.now()) / 60_000))
    console.log(`[anthropic-oauth] Proactive refresh check (${reason}), token expires in ${minutesLeft} minute(s)`)

    attemptedRefreshToken = currentRefreshToken
    const result = await getValidAccessToken({ minimumValidityMs: PROACTIVE_REFRESH_MIN_VALIDITY_MS })
    if (!result) {
      console.warn("[anthropic-oauth] Proactive refresh skipped: credentials unavailable")
      return
    }

    if (result.refreshed) {
      resetInvalidGrantState()
    }
    console.log(`[anthropic-oauth] Proactive refresh done (refreshed: ${result.refreshed})`)
  } catch (error) {
    if (attemptedRefreshToken && isInvalidGrantRefreshError(error)) {
      if (invalidGrantState.refreshToken === attemptedRefreshToken) {
        invalidGrantState.consecutiveFailures += 1
      } else {
        invalidGrantState = {
          refreshToken: attemptedRefreshToken,
          consecutiveFailures: 1,
          escalated: false,
          lastSuppressionLogAt: 0,
        }
      }

      const guidance = "Run /login in Claude Code CLI to re-authenticate."
      console.error(
        `[anthropic-oauth] CRITICAL: OAuth refresh failed with invalid_grant (failure #${invalidGrantState.consecutiveFailures}). ${guidance}`,
      )

      if (invalidGrantState.consecutiveFailures >= INVALID_GRANT_ESCALATION_THRESHOLD && !invalidGrantState.escalated) {
        invalidGrantState.escalated = true
        Sentry.captureMessage(
          `[anthropic-oauth] Persistent invalid_grant on shared OAuth credentials after ${invalidGrantState.consecutiveFailures} attempts. ${guidance}`,
          "error",
        )
      } else {
        Sentry.captureException(error)
      }
      return
    }

    console.error("[anthropic-oauth] Proactive refresh failed:", error)
    Sentry.captureException(error)
  } finally {
    proactiveRefreshRunning = false
  }
}

/**
 * Start periodic token refresh checks to keep OAuth credentials ahead of expiry.
 * Safe to call multiple times; only one heartbeat is started per process.
 */
export function startOAuthRefreshHeartbeat(): void {
  if (process.env.NODE_ENV === "test") {
    return
  }
  if (proactiveRefreshTimer) {
    return
  }

  console.log("[anthropic-oauth] Starting proactive OAuth refresh heartbeat")
  void runProactiveRefreshTick("startup")

  proactiveRefreshTimer = setInterval(() => {
    void runProactiveRefreshTick("interval")
  }, PROACTIVE_REFRESH_CHECK_INTERVAL_MS)
  proactiveRefreshTimer.unref?.()
}

/**
 * Check if OAuth credentials are available and valid (or can be refreshed)
 */
export function hasOAuthCredentials(): boolean {
  const credentials = readClaudeCredentials()
  return credentials !== null && !!credentials.refreshToken
}

/**
 * Get access token WITHOUT refreshing. Returns null if expired.
 * Use this in production to avoid competing with CLI for token refresh.
 * If token is expired, user should run /login in CLI.
 */
export function getAccessTokenReadOnly(): {
  accessToken: string
  expiresAt: number
  isExpired: boolean
} | null {
  const credentials = readClaudeCredentials()
  if (!credentials) {
    return null
  }

  return {
    accessToken: credentials.accessToken,
    expiresAt: credentials.expiresAt,
    isExpired: isTokenExpired(credentials.expiresAt),
  }
}
