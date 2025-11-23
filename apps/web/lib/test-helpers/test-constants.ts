/**
 * Test Constants
 *
 * Single source of truth for test configuration
 * NEVER hardcode these values in tests - always import from here
 */

import { environments } from "@webalive/shared/environments"

/**
 * API endpoints for testing
 * Automatically uses local or production based on BRIDGE_ENV
 */
const getApiUrl = (path: string): string => {
  const baseUrl =
    process.env.BRIDGE_ENV === "local"
      ? `http://localhost:${environments.production.port}`
      : `https://${environments.production.domain}`
  return `${baseUrl}${path}`
}

export const API_ENDPOINTS = {
  DEPLOY_SUBDOMAIN: getApiUrl("/api/deploy-subdomain"),
  LOGIN: getApiUrl("/api/login"),
  TOKENS: getApiUrl("/api/tokens"),
  VERIFY: getApiUrl("/api/verify"),
} as const

/**
 * Test user credentials
 * Used consistently across all tests
 */
export const TEST_CREDENTIALS = {
  PASSWORD: "test-password-123",
  CREDITS: 500,
} as const

/**
 * Session cookie configuration
 */
export const SESSION_COOKIE = {
  NAME: "auth_session",
  PATTERN: /auth_session=([^;]+)/,
} as const
