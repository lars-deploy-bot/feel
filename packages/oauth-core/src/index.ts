/**
 * OAuth Core - Secure Multi-Tenant OAuth System
 *
 * Main entry point and public API
 */

import { LockboxAdapter } from './storage.js';
import { getProvider } from './providers/index.js';
import type { OAuthTokens, ProviderConfig } from './types.js';

export class OAuthManager {
  private storage: LockboxAdapter;

  constructor() {
    this.storage = new LockboxAdapter();
  }

  // ------------------------------------------------------------------
  // TENANT CONFIGURATION (Provider Credentials)
  // ------------------------------------------------------------------

  /**
   * Stores OAuth app credentials for a tenant
   *
   * @param tenantUserId - Tenant owner's user ID
   * @param provider - Provider name (e.g., "github")
   * @param config - Client ID, secret, and optional redirect URI
   *
   * @example
   * await oauth.setProviderConfig('tenant-123', 'github', {
   *   client_id: 'Iv1.abc123',
   *   client_secret: 'secret_xyz',
   *   redirect_uri: 'https://myapp.com/auth/callback'
   * });
   */
  async setProviderConfig(
    tenantUserId: string,
    provider: string,
    config: ProviderConfig
  ): Promise<void> {
    // Verify provider exists
    getProvider(provider);

    await this.storage.save(
      tenantUserId,
      'provider_config',
      `${provider}_client_id`,
      config.client_id
    );

    await this.storage.save(
      tenantUserId,
      'provider_config',
      `${provider}_client_secret`,
      config.client_secret
    );

    if (config.redirect_uri) {
      await this.storage.save(
        tenantUserId,
        'provider_config',
        `${provider}_redirect_uri`,
        config.redirect_uri
      );
    }
  }

  /**
   * Retrieves OAuth app credentials for a tenant
   *
   * @param tenantUserId - Tenant owner's user ID
   * @param provider - Provider name
   * @returns Provider config or null if not configured
   */
  async getProviderConfig(
    tenantUserId: string,
    provider: string
  ): Promise<ProviderConfig | null> {
    const [clientId, clientSecret, redirectUri] = await Promise.all([
      this.storage.get(tenantUserId, 'provider_config', `${provider}_client_id`),
      this.storage.get(
        tenantUserId,
        'provider_config',
        `${provider}_client_secret`
      ),
      this.storage.get(
        tenantUserId,
        'provider_config',
        `${provider}_redirect_uri`
      ),
    ]);

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri || undefined,
    };
  }

  /**
   * Deletes OAuth app credentials for a tenant
   *
   * @param tenantUserId - Tenant owner's user ID
   * @param provider - Provider name
   */
  async deleteProviderConfig(tenantUserId: string, provider: string): Promise<void> {
    const names = [
      `${provider}_client_id`,
      `${provider}_client_secret`,
      `${provider}_redirect_uri`,
    ];

    await Promise.all(
      names.map((name) =>
        this.storage.delete(tenantUserId, 'provider_config', name)
      )
    );
  }

  // ------------------------------------------------------------------
  // USER AUTHENTICATION FLOW
  // ------------------------------------------------------------------

  /**
   * Handles OAuth callback - exchanges code for tokens and stores them
   *
   * @param tenantUserId - Tenant owner (who owns the OAuth app)
   * @param authenticatingUserId - End user who is authenticating
   * @param provider - Provider name (e.g., "github")
   * @param code - Authorization code from OAuth callback
   * @returns Result with success status and token scopes
   *
   * @example
   * // In your /auth/callback route
   * const result = await oauth.handleCallback(
   *   'tenant-123',
   *   'user-456',
   *   'github',
   *   req.query.code
   * );
   */
  async handleCallback(
    tenantUserId: string,
    authenticatingUserId: string,
    provider: string,
    code: string
  ): Promise<{ success: boolean; scopes?: string }> {
    // 1. Get tenant's OAuth app credentials
    const config = await this.getProviderConfig(tenantUserId, provider);
    if (!config) {
      throw new Error(
        `Tenant ${tenantUserId} has not configured OAuth for '${provider}'`
      );
    }

    // 2. Get provider instance and exchange code for tokens
    const oauthProvider = getProvider(provider);
    const tokens = await oauthProvider.exchangeCode(
      code,
      config.client_id,
      config.client_secret,
      config.redirect_uri
    );

    // 3. Store tokens for the authenticating user
    await this.saveTokens(authenticatingUserId, provider, tokens);

    return { success: true, scopes: tokens.scope };
  }

  /**
   * Gets a user's access token for a provider
   *
   * @param userId - User ID
   * @param provider - Provider name
   * @returns Access token
   * @throws Error if user not connected to provider
   *
   * @example
   * const token = await oauth.getAccessToken('user-456', 'github');
   * // Use with GitHub API
   * fetch('https://api.github.com/user', {
   *   headers: { Authorization: `Bearer ${token}` }
   * });
   */
  async getAccessToken(userId: string, provider: string): Promise<string> {
    const token = await this.storage.get(
      userId,
      'oauth_tokens',
      `${provider}_access_token`
    );

    if (!token) {
      throw new Error(`User ${userId} is not connected to '${provider}'`);
    }

    return token;
  }

  /**
   * Saves OAuth tokens for a user
   *
   * @param userId - User ID
   * @param provider - Provider name
   * @param tokens - OAuth tokens to store
   */
  async saveTokens(
    userId: string,
    provider: string,
    tokens: OAuthTokens
  ): Promise<void> {
    await this.storage.save(
      userId,
      'oauth_tokens',
      `${provider}_access_token`,
      tokens.access_token
    );

    if (tokens.refresh_token) {
      await this.storage.save(
        userId,
        'oauth_tokens',
        `${provider}_refresh_token`,
        tokens.refresh_token
      );
    }

    if (tokens.expires_in) {
      const expiresAt = new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString();
      await this.storage.save(
        userId,
        'oauth_tokens',
        `${provider}_expires_at`,
        expiresAt
      );
    }
  }

  /**
   * Gets refresh token for a user (if available)
   *
   * @param userId - User ID
   * @param provider - Provider name
   * @returns Refresh token or null
   */
  async getRefreshToken(userId: string, provider: string): Promise<string | null> {
    return this.storage.get(userId, 'oauth_tokens', `${provider}_refresh_token`);
  }

  /**
   * Checks if a user is connected to a provider
   *
   * @param userId - User ID
   * @param provider - Provider name
   * @returns true if user has an access token
   */
  async isConnected(userId: string, provider: string): Promise<boolean> {
    return this.storage.exists(userId, 'oauth_tokens', `${provider}_access_token`);
  }

  /**
   * Disconnects a user from a provider (removes all tokens)
   *
   * @param userId - User ID
   * @param provider - Provider name
   *
   * @example
   * await oauth.disconnect('user-456', 'github');
   */
  async disconnect(userId: string, provider: string): Promise<void> {
    const names = [
      `${provider}_access_token`,
      `${provider}_refresh_token`,
      `${provider}_expires_at`,
    ];

    await Promise.all(
      names.map((name) => this.storage.delete(userId, 'oauth_tokens', name))
    );
  }

  /**
   * Revokes a user's access token with the provider
   * (Also removes from local storage)
   *
   * @param tenantUserId - Tenant owner (for OAuth app credentials)
   * @param userId - User ID
   * @param provider - Provider name
   */
  async revoke(
    tenantUserId: string,
    userId: string,
    provider: string
  ): Promise<void> {
    // Get provider config and user token
    const [config, token] = await Promise.all([
      this.getProviderConfig(tenantUserId, provider),
      this.getAccessToken(userId, provider),
    ]);

    if (!config) {
      throw new Error(`Tenant not configured for '${provider}'`);
    }

    // Revoke with provider (if supported)
    const oauthProvider = getProvider(provider);
    if (oauthProvider.revokeToken) {
      await oauthProvider.revokeToken(token, config.client_id, config.client_secret);
    }

    // Remove from local storage
    await this.disconnect(userId, provider);
  }

  // ------------------------------------------------------------------
  // UTILITIES
  // ------------------------------------------------------------------

  /**
   * Gets the authorization URL to redirect users to
   *
   * @param tenantUserId - Tenant owner
   * @param provider - Provider name
   * @param scope - Space-separated scopes
   * @param state - CSRF protection state
   * @returns Authorization URL
   *
   * @example
   * const authUrl = await oauth.getAuthUrl(
   *   'tenant-123',
   *   'github',
   *   'repo user',
   *   'random-state-123'
   * );
   * // Redirect user to authUrl
   */
  async getAuthUrl(
    tenantUserId: string,
    provider: string,
    scope: string,
    state?: string
  ): Promise<string> {
    const config = await this.getProviderConfig(tenantUserId, provider);
    if (!config) {
      throw new Error(`Tenant not configured for '${provider}'`);
    }

    const oauthProvider = getProvider(provider);
    if (!oauthProvider.getAuthUrl) {
      throw new Error(`Provider '${provider}' does not support getAuthUrl`);
    }

    return oauthProvider.getAuthUrl(
      config.client_id,
      config.redirect_uri || '',
      scope,
      state
    );
  }
}

// Singleton instance for convenience
export const oauth = new OAuthManager();

// Re-export types and utilities
export type {
  OAuthTokens,
  ProviderConfig,
  SecretNamespace,
  EncryptedPayload,
  UserSecret,
} from './types.js';

export { Security } from './security.js';
export { LockboxAdapter } from './storage.js';
export { getProvider, registerProvider, listProviders, hasProvider } from './providers/index.js';
export type { OAuthProvider } from './providers/base.js';
export { GitHubProvider } from './providers/github.js';
