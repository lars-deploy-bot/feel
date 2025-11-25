/**
 * Base OAuth Provider Interfaces
 *
 * Split interfaces for better interface segregation
 */

import type { OAuthTokens } from "../types"

/**
 * Core OAuth functionality that ALL providers must implement
 */
export interface OAuthProviderCore {
  /** Provider name (e.g., "github", "google") */
  name: string

  /**
   * Exchanges an authorization code for access tokens
   *
   * @param code - Authorization code from OAuth callback
   * @param clientId - OAuth app client ID
   * @param clientSecret - OAuth app client secret
   * @param redirectUri - Optional redirect URI (must match OAuth app config)
   * @returns OAuth tokens (access_token, refresh_token, etc.)
   */
  exchangeCode(code: string, clientId: string, clientSecret: string, redirectUri?: string): Promise<OAuthTokens>

  /**
   * Gets the authorization URL for the OAuth flow
   *
   * @param clientId - OAuth app client ID
   * @param redirectUri - Redirect URI
   * @param scope - Space-separated scopes
   * @param state - CSRF protection state parameter
   * @returns Full authorization URL
   */
  getAuthUrl(clientId: string, redirectUri: string, scope: string, state?: string): string
}

/**
 * Token refresh capability (not all providers support this)
 */
export interface OAuthRefreshable {
  /**
   * Refreshes an expired access token using a refresh token
   *
   * @param refreshToken - Valid refresh token
   * @param clientId - OAuth app client ID
   * @param clientSecret - OAuth app client secret
   * @returns New OAuth tokens
   */
  refreshToken(refreshToken: string, clientId: string, clientSecret: string): Promise<OAuthTokens>
}

/**
 * Token revocation capability (not all providers support this)
 */
export interface OAuthRevocable {
  /**
   * Revokes an access token (logout)
   *
   * @param token - Access token to revoke
   * @param clientId - OAuth app client ID
   * @param clientSecret - OAuth app client secret
   */
  revokeToken(token: string, clientId: string, clientSecret: string): Promise<void>
}

/**
 * Complete OAuth provider with all capabilities
 * (Maintained for backward compatibility checking)
 */
export type OAuthProvider = OAuthProviderCore & Partial<OAuthRefreshable & OAuthRevocable>

/**
 * Type guards to check provider capabilities at runtime
 */
export function isRefreshable(provider: OAuthProviderCore): provider is OAuthProviderCore & OAuthRefreshable {
  return "refreshToken" in provider && typeof provider.refreshToken === "function"
}

export function isRevocable(provider: OAuthProviderCore): provider is OAuthProviderCore & OAuthRevocable {
  return "revokeToken" in provider && typeof provider.revokeToken === "function"
}
