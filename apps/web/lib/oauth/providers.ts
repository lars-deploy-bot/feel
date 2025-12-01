/**
 * OAuth Provider Constants (Client-Safe)
 *
 * This file derives OAuth configuration from the shared MCP providers registry.
 * Safe to import from both client and server components.
 *
 * SINGLE SOURCE OF TRUTH: packages/shared/src/mcp-providers.ts
 */

import { OAUTH_MCP_PROVIDERS, type OAuthMcpProviderKey } from "@webalive/shared"

/**
 * Supported OAuth providers - derived from shared registry
 */
export type OAuthProvider = OAuthMcpProviderKey

/**
 * The base path for all OAuth routes
 * Route handler is at: /api/auth/[provider]/route.ts
 */
export const OAUTH_ROUTE_BASE = "/api/auth" as const

/**
 * Build the OAuth route path for a provider
 * This matches the Next.js route at /api/auth/[provider]/route.ts
 */
export function getOAuthRoutePath(provider: OAuthProvider): string {
  return `${OAUTH_ROUTE_BASE}/${provider}`
}

/**
 * Build the full redirect URI for OAuth callbacks
 * @param baseUrl - The base URL (e.g., https://dev.terminal.goalive.nl)
 * @param provider - The OAuth provider
 * @returns Full redirect URI (e.g., https://dev.terminal.goalive.nl/api/auth/linear)
 */
export function buildOAuthRedirectUri(baseUrl: string, provider: OAuthProvider): string {
  // Remove trailing slash from baseUrl if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, "")
  return `${cleanBaseUrl}${getOAuthRoutePath(provider)}`
}

/**
 * Re-export the shared config for backward compatibility
 * Use OAUTH_MCP_PROVIDERS directly for new code
 */
export const OAUTH_PROVIDER_CONFIG = OAUTH_MCP_PROVIDERS

/**
 * List of supported OAuth providers - derived from shared registry
 */
export const SUPPORTED_OAUTH_PROVIDERS = Object.keys(OAUTH_MCP_PROVIDERS) as OAuthProvider[]

/**
 * Check if a provider is supported
 */
export function isOAuthProviderSupported(provider: string): provider is OAuthProvider {
  return provider.toLowerCase() in OAUTH_MCP_PROVIDERS
}
