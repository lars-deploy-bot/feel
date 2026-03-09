/**
 * E2E Test Environment Detection (PURE - no side effects)
 *
 * This module only READS and VALIDATES process.env.TEST_ENV.
 * Env loading happens in load-env.ts (imported first in playwright configs).
 *
 * Environment values:
 * - "local"   → Local app + isolated Supabase target
 * - "preview" → Remote preview deployment
 * - "staging" → Remote staging deployment (live lane only)
 */

export const VALID_ENVS = ["local", "preview", "staging"] as const
export const STANDARD_ENVS = ["local", "preview"] as const
export const LIVE_ENVS = ["preview", "staging"] as const

function isTestEnv(value: string): value is (typeof VALID_ENVS)[number] {
  return VALID_ENVS.some(env => env === value)
}

function isStandardEnv(value: (typeof VALID_ENVS)[number]): value is (typeof STANDARD_ENVS)[number] {
  return STANDARD_ENVS.some(env => env === value)
}

function isLiveEnv(value: (typeof VALID_ENVS)[number]): value is (typeof LIVE_ENVS)[number] {
  return LIVE_ENVS.some(env => env === value)
}

/** Validate and return TEST_ENV */
export function getTestEnv(): (typeof VALID_ENVS)[number] {
  const env = process.env.TEST_ENV

  if (!env) {
    throw new Error(
      "TEST_ENV not set. The .env file must contain TEST_ENV=local|preview|staging\n" +
        "Check that ENV_FILE points to a valid .env file.",
    )
  }

  if (!isTestEnv(env)) {
    throw new Error(`Invalid TEST_ENV="${env}". Valid: ${VALID_ENVS.join(", ")}`)
  }

  return env
}

export function assertStandardTestEnv(env: (typeof VALID_ENVS)[number]): asserts env is (typeof STANDARD_ENVS)[number] {
  if (!isStandardEnv(env)) {
    throw new Error(
      `Standard E2E rejects TEST_ENV="${env}". ` +
        `Use one of: ${STANDARD_ENVS.join(", ")}. ` +
        "Remote staging is live-only on purpose.",
    )
  }
}

export function assertLiveTestEnv(env: (typeof VALID_ENVS)[number]): asserts env is (typeof LIVE_ENVS)[number] {
  if (!isLiveEnv(env)) {
    throw new Error(`Live E2E rejects TEST_ENV="${env}". Use one of: ${LIVE_ENVS.join(", ")}.`)
  }
}

export function assertLocalTestEnv(env: (typeof VALID_ENVS)[number], laneName: string): void {
  if (env !== "local") {
    throw new Error(`${laneName} requires TEST_ENV=local. Loaded TEST_ENV="${env}".`)
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1"
}

function assertBaseUrlMatchesEnv(env: (typeof VALID_ENVS)[number], baseUrl: string): void {
  const url = new URL(baseUrl)

  if (env === "local") {
    if (url.protocol !== "http:" || !isLoopbackHostname(url.hostname)) {
      throw new Error(
        `TEST_ENV=local requires an HTTP loopback base URL. Got: ${baseUrl}. ` +
          "Use http://127.0.0.1:9547 or http://localhost:9547.",
      )
    }
    return
  }

  if (url.protocol !== "https:") {
    throw new Error(`TEST_ENV=${env} requires an HTTPS base URL. Got: ${baseUrl}.`)
  }
}

export function assertStandardE2ETarget(env: (typeof VALID_ENVS)[number], baseUrl: string): void {
  assertStandardTestEnv(env)
  assertBaseUrlMatchesEnv(env, baseUrl)
}

export function assertLiveE2ETarget(env: (typeof VALID_ENVS)[number], baseUrl: string): void {
  assertLiveTestEnv(env)
  assertBaseUrlMatchesEnv(env, baseUrl)
}

export const TEST_ENV = getTestEnv()

/**
 * Local test server lane.
 */
export const isLocalTestServer = TEST_ENV === "local"

/**
 * Remote environments (preview + staging).
 */
export const isRemoteEnv = TEST_ENV !== "local"

/**
 * Test timeouts based on environment.
 * Remote environments need longer timeouts due to network latency.
 */
export const TIMEOUTS = {
  /** Default test timeout */
  DEFAULT: 60_000,
  /** Long-running operations (deployments) */
  DEPLOYMENT: 180_000,
  /** Extended operations (concurrent deployments) */
  EXTENDED: 300_000,
} as const
