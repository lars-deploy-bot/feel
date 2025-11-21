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
  BRIDGE_API_URL: "BRIDGE_API_URL",
  BRIDGE_API_PORT: "BRIDGE_API_PORT",
  INTERNAL_TOOLS_SECRET: "INTERNAL_TOOLS_SECRET",
} as const
