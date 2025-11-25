/**
 * OAuth Provider Constants (Client-Safe)
 *
 * This file contains ONLY static constants - no server-side imports.
 * Safe to import from both client and server components.
 *
 * SINGLE SOURCE OF TRUTH for OAuth routes and configuration.
 */

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
 * Provider-specific configuration
 */
export interface OAuthProviderConfig {
  /** Display name for UI */
  displayName: string
  /** Default scopes (comma-separated for Linear, space-separated for GitHub) */
  defaultScopes: string
  /** Environment variable prefix for credentials */
  envPrefix: string
}

/**
 * Configuration for each supported OAuth provider
 */
export const OAUTH_PROVIDER_CONFIG: Record<OAuthProvider, OAuthProviderConfig> = {
  linear: {
    displayName: "Linear",
    defaultScopes: "read,write,issues:create",
    envPrefix: "LINEAR",
  },
  github: {
    displayName: "GitHub",
    defaultScopes: "read:user user:email",
    envPrefix: "GITHUB",
  },
  stripe: {
    displayName: "Stripe",
    defaultScopes: "read_write",
    envPrefix: "STRIPE",
  },
} as const

/**
 * Supported OAuth providers
 * Single source of truth for which providers have OAuth implementations
 */
export const SUPPORTED_OAUTH_PROVIDERS = Object.keys(OAUTH_PROVIDER_CONFIG) as OAuthProvider[]

export type OAuthProvider = "linear" | "github" | "stripe"

/**
 * Check if a provider is supported
 */
export function isOAuthProviderSupported(provider: string): provider is OAuthProvider {
  return provider.toLowerCase() in OAUTH_PROVIDER_CONFIG
}
