/**
 * Shared Constants - Single Source of Truth
 *
 * These constants are used across all packages in the monorepo.
 * DO NOT duplicate these values anywhere else.
 */

/**
 * Cookie Names
 *
 * Used for session management across the application.
 * Both frontend (apps/web) and backend tools (packages/tools) use these.
 */
export const COOKIE_NAMES = {
  SESSION: "auth_session",
  MANAGER_SESSION: "manager_session",
} as const

/**
 * Session Configuration
 */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

/**
 * Environment Variable Names
 *
 * Used for passing configuration to child processes and MCP tools.
 */
export const ENV_VARS = {
  BRIDGE_SESSION_COOKIE: "BRIDGE_SESSION_COOKIE",
  BRIDGE_SESSION_COOKIE_NAME: "BRIDGE_SESSION_COOKIE_NAME",
  INTERNAL_TOOLS_SECRET: "INTERNAL_TOOLS_SECRET",
} as const

/**
 * Test Configuration
 *
 * Constants for E2E test isolation and worker management.
 */
export const TEST_CONFIG = {
  PORT: 9547,
  BASE_URL: "http://localhost:9547",
  EMAIL_DOMAIN: "bridge.local",
  DEFAULT_CREDITS: 1000,
  WORKER_EMAIL_PREFIX: "e2e_w", // e2e_w0@bridge.local
  WORKSPACE_PREFIX: "e2e-w", // e2e-w0.bridge.local
  TEST_PASSWORD: "test-password-123", // Password for all E2E test users

  // Worker port configuration (single source of truth)
  // Allow env override for CI environments with port conflicts
  WORKER_PORT_BASE: Number(process.env.TEST_WORKER_PORT_BASE) || 9100, // Base port for virtual worker domains
  MAX_WORKERS: 20, // Maximum parallel Playwright workers
} as const
