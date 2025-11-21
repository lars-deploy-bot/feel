/**
 * Base OAuth Provider Interface
 *
 * Defines the contract that all OAuth providers must implement
 */

import type { OAuthTokens } from '../types.js';

export interface OAuthProvider {
  /** Provider name (e.g., "github", "google") */
  name: string;

  /**
   * Exchanges an authorization code for access tokens
   *
   * @param code - Authorization code from OAuth callback
   * @param clientId - OAuth app client ID
   * @param clientSecret - OAuth app client secret
   * @param redirectUri - Optional redirect URI (must match OAuth app config)
   * @returns OAuth tokens (access_token, refresh_token, etc.)
   */
  exchangeCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri?: string
  ): Promise<OAuthTokens>;

  /**
   * Refreshes an expired access token using a refresh token
   *
   * @param refreshToken - Valid refresh token
   * @param clientId - OAuth app client ID
   * @param clientSecret - OAuth app client secret
   * @returns New OAuth tokens
   */
  refreshToken?(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<OAuthTokens>;

  /**
   * Revokes an access token (logout)
   *
   * @param token - Access token to revoke
   * @param clientId - OAuth app client ID
   * @param clientSecret - OAuth app client secret
   */
  revokeToken?(token: string, clientId: string, clientSecret: string): Promise<void>;

  /**
   * Gets the authorization URL for the OAuth flow
   *
   * @param clientId - OAuth app client ID
   * @param redirectUri - Redirect URI
   * @param scope - Space-separated scopes
   * @param state - CSRF protection state parameter
   * @returns Full authorization URL
   */
  getAuthUrl?(
    clientId: string,
    redirectUri: string,
    scope: string,
    state?: string
  ): string;
}
