/**
 * Server-side environment validation
 *
 * This file can safely use Node.js built-ins (fs, path, etc.)
 * Only import this in server components, API routes, or server actions.
 *
 * @example
 * ```typescript
 * // In API route or server component
 * import { env, loadEnvFile } from "@webalive/env/server"
 *
 * // Optional: explicitly load .env file (call once at app entry)
 * loadEnvFile("production")
 *
 * // Use validated env vars
 * const apiKey = env.ANTH_API_SECRET
 * ```
 */

import { existsSync } from "node:fs"
import { join } from "node:path"
import { createEnv } from "@t3-oss/env-nextjs"
import { config as loadDotenv } from "dotenv"
import { clientSchema, runtimeEnv, serverSchema } from "./schema"

/**
 * Explicitly load environment file
 *
 * Call this at your app's entry point if you need dotenv loading.
 * This is NOT called automatically on import (no side effects).
 *
 * @param nodeEnv - Environment name. Required — callers must pass explicitly or read from their own env.
 * @returns true if file was loaded, false if not found
 */
export function loadEnvFile(nodeEnv: string): boolean {
  const envName = nodeEnv
  const envFile = join(process.cwd(), `.env.${envName}`)

  if (existsSync(envFile)) {
    loadDotenv({ path: envFile, override: true })
    return true
  }

  return false
}

// Guard: never allow skipping validation in production/staging
if (process.env.SKIP_ENV_VALIDATION) {
  const aliveEnv = process.env.ALIVE_ENV
  if (aliveEnv === "production" || aliveEnv === "staging") {
    throw new Error("SKIP_ENV_VALIDATION must not be set in production/staging environments")
  }
  console.warn("⚠️  SKIP_ENV_VALIDATION is set — environment validation disabled")
}

/**
 * Server-side validated environment variables
 *
 * Includes both server and client schemas for SSR compatibility.
 * Validation runs on first access.
 */
export const env = createEnv({
  server: serverSchema,
  client: clientSchema,
  runtimeEnv,

  /**
   * Skip validation in certain environments
   */
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint" ||
    process.env.npm_lifecycle_event === "format",

  /**
   * Custom error handling
   */
  onValidationError: issues => {
    console.error("❌ Invalid environment variables:")
    console.error(issues)
    throw new Error("Invalid environment variables")
  },

  emptyStringAsUndefined: true,
})

/**
 * Get Anthropic API key with fallback logic
 *
 * Priority order:
 * 1. ANTHROPIC_API_KEY env var (explicit API key)
 * 2. ANTH_API_SECRET env var (legacy .env)
 * 3. OAuth token from ~/.claude/.credentials.json (auto-refreshed)
 * 4. Mock key for local development
 *
 * In local dev mode (ALIVE_ENV=local or standalone), allows a mock key for testing.
 */
export function getAnthropicApiKey(): string {
  const apiKey = env.ANTHROPIC_API_KEY || env.ANTH_API_SECRET
  const isLocalDev = env.ALIVE_ENV === "local" || env.ALIVE_ENV === "standalone"

  if (apiKey) {
    return apiKey
  }

  if (!isLocalDev) {
    throw new Error("ANTHROPIC_API_KEY or ANTH_API_SECRET is required (or set ALIVE_ENV=local for development)")
  }

  return "sk-ant-mock-key-for-local-development"
}

/**
 * Get Redis URL. REDIS_URL must be set in the environment.
 * Returns null only in standalone mode (ALIVE_ENV=standalone).
 */
export function getRedisUrl(): string | null {
  if (env.ALIVE_ENV === "standalone") {
    return null
  }

  const redisUrl = env.REDIS_URL
  if (!redisUrl) {
    throw new Error("REDIS_URL is required. Set it in your .env file.")
  }

  return redisUrl
}

/**
 * Get validated E2B domain.
 *
 * Required whenever E2B-backed workspace execution is enabled.
 */
export function getE2bDomain(): string {
  const domain = env.E2B_DOMAIN

  if (!domain) {
    throw new Error("E2B_DOMAIN is required. Set the E2B_DOMAIN environment variable.")
  }

  return domain
}

/**
 * Get superadmin emails with environment-aware validation
 *
 * - Production/Staging: SUPERADMIN_EMAILS is REQUIRED (throws if missing)
 * - Local dev (ALIVE_ENV=local): Returns empty array (all users are effectively superadmin)
 *
 * This prevents the "no superadmin" scenario in production.
 */
export function getSuperadminEmails(): readonly string[] {
  const emailsEnv = env.SUPERADMIN_EMAILS
  const isLocalDev = env.ALIVE_ENV === "local" || env.ALIVE_ENV === "standalone"

  if (!emailsEnv && !isLocalDev) {
    throw new Error(
      "SUPERADMIN_EMAILS is required in production/staging. " +
        "Set SUPERADMIN_EMAILS environment variable (comma-separated emails) or use ALIVE_ENV=local for development.",
    )
  }

  if (!emailsEnv) {
    return []
  }

  return emailsEnv
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Get Flowglad secret key with environment-aware validation
 *
 * - Production/Staging: FLOWGLAD_SECRET_KEY is REQUIRED (throws if missing)
 * - Local dev (ALIVE_ENV=local): Returns undefined (billing features disabled)
 *
 * This ensures billing integration works in deployed environments while
 * allowing local development without Flowglad credentials.
 */
export function getFlowgladSecretKey(): string | undefined {
  const secretKey = env.FLOWGLAD_SECRET_KEY
  const isLocalDev = env.ALIVE_ENV === "local" || env.ALIVE_ENV === "standalone"

  if (!secretKey && !isLocalDev) {
    throw new Error(
      "FLOWGLAD_SECRET_KEY is required in production/staging. " +
        "Set FLOWGLAD_SECRET_KEY environment variable (sk_test_* or sk_live_*) or use ALIVE_ENV=local for development.",
    )
  }

  return secretKey
}

/**
 * Get E2B API key.
 *
 * This remains fail-fast once an E2B-backed code path is actually used, but the
 * env var is optional at process startup because the default execution mode is
 * still systemd.
 *
 * @throws Error if E2B_API_KEY is not set
 */
export function getE2bApiKey(): string {
  const key = env.E2B_API_KEY

  if (!key) {
    throw new Error("E2B_API_KEY is required. Set the E2B_API_KEY environment variable (e2b_*).")
  }

  return key
}

// Re-export schema types for convenience
export type { clientSchema, serverSchema } from "./schema"
