/**
 * OAuth Core - Secure Multi-Tenant OAuth System
 *
 * Main entry point and public API
 */

import { oauthAudit } from "./audit"
import {
  buildStoredOAuthConnection,
  mergeProviderMetadata,
  parseStoredOAuthConnection,
  type StoredOAuthConnection,
} from "./oauth-connection"
import { isRefreshable, isRevocable, isUserInfoProvider } from "./providers/base"
import { getProvider } from "./providers/index"
import { createRefreshLockManager, type IRefreshLockManager } from "./refresh-lock"
import {
  environmentScope,
  GLOBAL_SCOPE,
  LockboxAdapter,
  type LockboxAdapterConfig,
  type LockboxScope,
  workspaceEnvironmentScope,
  workspaceScope,
} from "./storage"
import {
  OAUTH_TOKENS_NAMESPACE,
  type OAuthManagerConfig,
  type OAuthTokens,
  type ProviderConfig,
  type SaveTokensContext,
  USER_ENV_KEYS_NAMESPACE,
} from "./types"

function normalizeScopes(scopeString: string | undefined): Set<string> {
  if (!scopeString) {
    return new Set()
  }

  const scopes = scopeString
    .split(/[,\s]+/)
    .map(scope => scope.trim().toLowerCase())
    .filter(Boolean)

  return new Set(scopes)
}

const providerCredentialAliases: Record<string, string> = {
  google_calendar: "google",
  google_search_console: "google",
}

function resolveCredentialProvider(provider: string): string {
  const normalizedProvider = provider.toLowerCase()
  return providerCredentialAliases[normalizedProvider] ?? normalizedProvider
}

export class OAuthMissingRequiredScopesError extends Error {
  readonly code = "MISSING_REQUIRED_SCOPES" as const
  readonly missingScopes: string[]

  constructor(missingScopes: string[]) {
    super(`Missing required OAuth scopes: ${missingScopes.join(", ")}`)
    this.name = "OAuthMissingRequiredScopesError"
    this.missingScopes = missingScopes
  }
}

/** Parse a scope value from storage (may be string JSON or object) */
function parseEnvKeyScope(scope: unknown): LockboxScope {
  if (typeof scope === "string") return JSON.parse(scope)
  if (scope && typeof scope === "object") return scope as LockboxScope
  return GLOBAL_SCOPE
}

/** Build a lockbox scope from optional workspace + environment */
function buildEnvKeyScope(workspace?: string, environment?: string): LockboxScope {
  const w = workspace?.trim().toLowerCase()
  const e = environment?.trim()
  if (w && e) return workspaceEnvironmentScope(w, e)
  if (w) return workspaceScope(w)
  if (e) return environmentScope(e)
  return GLOBAL_SCOPE
}

export class OAuthManager {
  private storage: LockboxAdapter
  private config: OAuthManagerConfig
  private lockManager: IRefreshLockManager

  // Token expiry buffer to prevent edge cases where token expires during request
  private static readonly TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5 minutes

  constructor(config?: OAuthManagerConfig) {
    if (config) {
      this.config = config
    } else {
      const environment = process.env.ALIVE_ENV
      if (!environment) throw new Error("ALIVE_ENV is required when OAuthManager is used without explicit config")
      this.config = {
        provider: "default",
        instanceId: "default",
        namespace: OAUTH_TOKENS_NAMESPACE,
        environment,
        defaultTtlSeconds: undefined,
      }
    }

    // Create storage adapter with instance configuration
    const storageConfig: LockboxAdapterConfig = {
      instanceId: this.config.instanceId,
      defaultTtlSeconds: this.config.defaultTtlSeconds,
    }
    this.storage = new LockboxAdapter(storageConfig)

    // Use injected lock manager or create one from config/defaults
    this.lockManager = this.config.lockManager || createRefreshLockManager(this.config.lockManagerConfig)
  }

  /**
   * Get the lock manager instance (useful for testing/monitoring)
   * @returns The refresh lock manager instance
   */
  getLockManager(): IRefreshLockManager {
    return this.lockManager
  }

  /**
   * Get the current instance configuration
   * @returns The OAuth manager configuration
   */
  getConfig(): OAuthManagerConfig {
    return this.config
  }

  /**
   * Get the instance ID for this OAuth manager
   * @returns The instance identifier
   */
  getInstanceId(): string {
    return this.config.instanceId
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
  async setProviderConfig(tenantUserId: string, provider: string, config: ProviderConfig): Promise<void> {
    // Verify provider exists
    getProvider(provider)

    await this.storage.save(tenantUserId, "provider_config", `${provider}_client_id`, config.client_id)

    await this.storage.save(tenantUserId, "provider_config", `${provider}_client_secret`, config.client_secret)

    if (config.redirect_uri) {
      await this.storage.save(tenantUserId, "provider_config", `${provider}_redirect_uri`, config.redirect_uri)
    }
  }

  /**
   * Retrieves OAuth app credentials for a tenant
   *
   * @param tenantUserId - Tenant owner's user ID
   * @param provider - Provider name
   * @returns Provider config or null if not configured
   */
  async getProviderConfig(tenantUserId: string, provider: string): Promise<ProviderConfig | null> {
    const config = await this.readProviderConfig(tenantUserId, provider)
    if (config) {
      return config
    }

    const credentialProvider = resolveCredentialProvider(provider)
    if (credentialProvider !== provider) {
      return this.readProviderConfig(tenantUserId, credentialProvider)
    }

    return null
  }

  private async readProviderConfig(tenantUserId: string, provider: string): Promise<ProviderConfig | null> {
    const [clientId, clientSecret, redirectUri] = await Promise.all([
      this.storage.get(tenantUserId, "provider_config", `${provider}_client_id`),
      this.storage.get(tenantUserId, "provider_config", `${provider}_client_secret`),
      this.storage.get(tenantUserId, "provider_config", `${provider}_redirect_uri`),
    ])

    if (!clientId || !clientSecret) {
      return null
    }

    return {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri || undefined,
    }
  }

  /**
   * Deletes OAuth app credentials for a tenant
   *
   * @param tenantUserId - Tenant owner's user ID
   * @param provider - Provider name
   */
  async deleteProviderConfig(tenantUserId: string, provider: string): Promise<void> {
    const names = [`${provider}_client_id`, `${provider}_client_secret`, `${provider}_redirect_uri`]

    await Promise.all(names.map(name => this.storage.delete(tenantUserId, "provider_config", name)))
  }

  private async resolveProviderConfig(
    provider: string,
    tenantUserId?: string | null,
    credentialProviderOverride?: string,
    redirectUriOverride?: string,
  ): Promise<ProviderConfig | null> {
    let config: ProviderConfig | null = null

    if (typeof tenantUserId === "string" && tenantUserId.length > 0) {
      config = await this.getProviderConfig(tenantUserId, provider)
    }

    const credentialProvider =
      typeof credentialProviderOverride === "string" && credentialProviderOverride.length > 0
        ? credentialProviderOverride
        : resolveCredentialProvider(provider)

    if (!config) {
      const envClientId = process.env[`${credentialProvider.toUpperCase()}_CLIENT_ID`]
      const envClientSecret = process.env[`${credentialProvider.toUpperCase()}_CLIENT_SECRET`]
      const envRedirectUri = process.env[`${credentialProvider.toUpperCase()}_REDIRECT_URI`]

      if (envClientId && envClientSecret) {
        config = {
          client_id: envClientId,
          client_secret: envClientSecret,
          redirect_uri: typeof envRedirectUri === "string" && envRedirectUri.length > 0 ? envRedirectUri : undefined,
        }
      }
    }

    if (config && typeof redirectUriOverride === "string" && redirectUriOverride.length > 0) {
      config.redirect_uri = redirectUriOverride
    }

    return config
  }

  private parseStoredConnection(tokenBlob: string, provider: string): StoredOAuthConnection {
    let tokenData: unknown

    try {
      tokenData = JSON.parse(tokenBlob)
    } catch (error) {
      throw new Error(
        `Failed to parse token data for '${provider}': ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }

    try {
      return parseStoredOAuthConnection(tokenData, {
        provider,
        fallbackCredentialProvider: resolveCredentialProvider(provider),
      })
    } catch (error) {
      throw new Error(
        `Failed to parse token data for '${provider}': ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  private async readStoredConnection(userId: string, provider: string): Promise<StoredOAuthConnection | null> {
    const tokenBlob = await this.storage.get(userId, OAUTH_TOKENS_NAMESPACE, provider)

    if (!tokenBlob) {
      return null
    }

    return this.parseStoredConnection(tokenBlob, provider)
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
    code: string,
    /** Override redirect URI - MUST match the URI used during authorization */
    redirectUriOverride?: string,
    /** PKCE code_verifier - required if PKCE was used during authorization */
    codeVerifier?: string,
    /** Required scopes that must be present in granted token scopes */
    requiredScopes?: string[],
  ): Promise<{ success: boolean; scopes?: string }> {
    // Start audit trail
    const correlationId = oauthAudit.authInitiated(provider, authenticatingUserId, tenantUserId)

    try {
      const credentialProvider = resolveCredentialProvider(provider)
      const config = await this.resolveProviderConfig(provider, tenantUserId, credentialProvider, redirectUriOverride)

      if (!config) {
        const error = `OAuth not configured for '${provider}'. Set environment variables or configure in database.`
        oauthAudit.authFailed(provider, error, { userId: authenticatingUserId, tenantId: tenantUserId, correlationId })
        throw new Error(error)
      }

      // 2. Get provider instance and exchange code for tokens
      const oauthProvider = getProvider(provider)
      const tokens = await oauthProvider.exchangeCode(
        code,
        config.client_id,
        config.client_secret,
        config.redirect_uri,
        {
          code_verifier: codeVerifier,
        },
      )

      // 3. Validate required scopes before persisting tokens
      if (requiredScopes && requiredScopes.length > 0) {
        const grantedScopes = normalizeScopes(tokens.scope)
        const normalizedRequiredScopes = requiredScopes.map(scope => scope.trim().toLowerCase()).filter(Boolean)
        const missingScopes = normalizedRequiredScopes.filter(scope => !grantedScopes.has(scope))

        if (missingScopes.length > 0) {
          oauthAudit.log("auth_failed", provider, {
            userId: authenticatingUserId,
            tenantId: tenantUserId,
            correlationId,
            success: false,
            error: "Missing required OAuth scopes",
            metadata: {
              missingScopes: missingScopes.join(","),
              grantedScopes: tokens.scope || "",
            },
          })
          throw new OAuthMissingRequiredScopesError(missingScopes)
        }
      }

      // 4. Try to get user email for debugging (any provider with getUserInfo)
      let userEmail: string | undefined
      if (isUserInfoProvider(oauthProvider)) {
        try {
          const userInfo = await oauthProvider.getUserInfo(tokens.access_token)
          userEmail = userInfo?.email ?? userInfo?.mail ?? undefined
        } catch (e) {
          // Non-critical, just log
          console.warn(`[OAuth] Failed to fetch user email for ${provider}:`, e)
        }
      }

      // 5. Store tokens for the authenticating user (with email if available)
      await this.saveTokens(authenticatingUserId, provider, tokens, {
        email: userEmail,
        tenantUserId,
        credentialProvider,
        redirectUri: config.redirect_uri,
      })

      // Audit: auth completed
      oauthAudit.authCompleted(provider, authenticatingUserId, {
        tenantId: tenantUserId,
        correlationId,
        hasRefreshToken: !!tokens.refresh_token,
      })

      return { success: true, scopes: tokens.scope }
    } catch (error) {
      // Audit: auth failed (if not already logged above)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes("OAuth not configured")) {
        oauthAudit.authFailed(provider, errorMessage, {
          userId: authenticatingUserId,
          tenantId: tenantUserId,
          correlationId,
        })
      }
      throw error
    }
  }

  /**
   * Gets a user's access token for a provider (with transparent auto-refresh)
   *
   * @param userId - User ID
   * @param provider - Provider name
   * @returns Valid access token
   * @throws Error if user not connected to provider or refresh fails
   *
   * @example
   * const token = await oauth.getAccessToken('user-456', 'linear');
   * // Use with Linear API
   * fetch('https://api.linear.app/graphql', {
   *   headers: { Authorization: `Bearer ${token}` }
   * });
   */
  async getAccessToken(userId: string, provider: string): Promise<string> {
    const storedConnection = await this.readStoredConnection(userId, provider)

    if (!storedConnection) {
      throw new Error(`User ${userId} is not connected to '${provider}'`)
    }

    // Reject disabled connections — user must re-authenticate
    if (storedConnection.disabled_at) {
      throw new Error(
        `Connection to '${provider}' is disabled (reason: ${storedConnection.disabled_reason ?? "unknown"}, since: ${storedConnection.disabled_at}). User must re-authenticate.`,
      )
    }

    // Check if token needs refresh
    // Note: expires_at now stores "should refresh at" time (already includes buffer)
    const now = Date.now()

    if (storedConnection.expires_at) {
      const shouldRefreshAt = new Date(storedConnection.expires_at).getTime()

      if (now >= shouldRefreshAt) {
        // Token expired or expiring soon - attempt refresh
        if (!storedConnection.refresh_token) {
          throw new Error(
            `Access token for '${provider}' has expired and no refresh token is available. User must re-authenticate.`,
          )
        }

        const refreshToken = storedConnection.refresh_token

        // Get provider instance to refresh token
        const oauthProvider = getProvider(provider)

        // Use type guard to check refresh capability
        if (!isRefreshable(oauthProvider)) {
          throw new Error(`Provider '${provider}' does not support token refresh. User must re-authenticate.`)
        }

        const config = await this.resolveProviderConfig(
          provider,
          storedConnection.tenant_user_id,
          storedConnection.credential_provider,
        )

        if (!config) {
          const credentialPrefix = storedConnection.credential_provider.toUpperCase()
          throw new Error(
            `Missing OAuth credentials for '${provider}'. Set ${credentialPrefix}_CLIENT_ID and ${credentialPrefix}_CLIENT_SECRET.`,
          )
        }

        const clientId = config.client_id
        const clientSecret = config.client_secret

        // Use lock manager to prevent concurrent refresh attempts
        const lockKey = `${userId}:${provider}`

        // Audit: token refresh started
        const correlationId = oauthAudit.tokenRefreshStarted(provider, userId)

        try {
          const newAccessToken = await this.lockManager.withLock(lockKey, async () => {
            // Double-check if token is still expired (another request might have refreshed it)
            const recentTokenBlob = await this.storage.get(userId, OAUTH_TOKENS_NAMESPACE, provider)
            if (recentTokenBlob) {
              try {
                const recentTokenData = this.parseStoredConnection(recentTokenBlob, provider)
                if (recentTokenData.expires_at) {
                  const shouldRefreshAt = new Date(recentTokenData.expires_at).getTime()
                  if (Date.now() < shouldRefreshAt) {
                    // Token was refreshed by another request, use it
                    return recentTokenData.access_token
                  }
                }
              } catch {
                // Corrupted token blob - ignore and proceed with refresh
              }
            }

            // Proceed with refresh (we already checked it's refreshable above)
            const newTokens = await oauthProvider.refreshToken(refreshToken, clientId, clientSecret)

            // CRITICAL: Preserve the original refresh token if provider doesn't return a new one
            // Google OAuth does NOT return a new refresh_token on refresh - we must keep the original
            const refreshTokenToStore = newTokens.refresh_token !== undefined ? newTokens.refresh_token : refreshToken
            const providerMetadata = mergeProviderMetadata(
              storedConnection.provider_metadata,
              newTokens.provider_metadata,
            )

            // Save the new tokens atomically, preserving refresh token
            await this.saveTokens(
              userId,
              provider,
              {
                ...newTokens,
                refresh_token: refreshTokenToStore,
                provider_metadata: providerMetadata,
              },
              {
                email: storedConnection.cached_email ?? undefined,
                tenantUserId: storedConnection.tenant_user_id ?? undefined,
                credentialProvider: storedConnection.credential_provider,
                redirectUri: storedConnection.redirect_uri ?? undefined,
              },
            )

            // Return the new access token
            return newTokens.access_token
          })

          // Audit: token refresh completed
          oauthAudit.tokenRefreshCompleted(provider, userId, correlationId)

          return newAccessToken
        } catch (error) {
          // Audit: token refresh failed
          const errorMessage = error instanceof Error ? error.message : String(error)
          oauthAudit.tokenRefreshFailed(provider, userId, errorMessage, correlationId)

          // Auto-disable on unrecoverable refresh errors
          const isUnrecoverable =
            errorMessage.includes("invalid_grant") ||
            errorMessage.includes("revoked") ||
            errorMessage.includes("expired")
          if (isUnrecoverable) {
            try {
              await this.disableConnection(userId, provider, "refresh_failed")
            } catch {
              // Best-effort — don't mask the original error
            }
          }

          throw new Error(`Token refresh failed for '${provider}': ${errorMessage}. User may need to re-authenticate.`)
        }
      }
    }

    // Token is still valid, return it
    return storedConnection.access_token
  }

  /**
   * Calculates safe expiry timestamp with buffer
   * Pattern from OpenClaw: subtract buffer and ensure minimum floor
   */
  private static coerceExpiresAt(expiresInSeconds: number, now: number = Date.now()): number {
    // Subtract 5-minute buffer to refresh before actual expiry
    const value = now + Math.max(0, Math.floor(expiresInSeconds)) * 1000 - OAuthManager.TOKEN_EXPIRY_BUFFER_MS
    // Ensure at least 30 seconds from now (safety floor)
    return Math.max(value, now + 30_000)
  }

  /**
   * Saves OAuth tokens for a user (Atomic JSON Blob Pattern)
   *
   * @param userId - User ID
   * @param provider - Provider name
   * @param tokens - OAuth tokens to store
   * @param email - Optional user email for debugging
   */
  async saveTokens(
    userId: string,
    provider: string,
    tokens: OAuthTokens,
    emailOrContext?: string | SaveTokensContext,
  ): Promise<void> {
    const now = Date.now()
    const context: SaveTokensContext = {}

    if (typeof emailOrContext === "string") {
      context.email = emailOrContext
    } else if (emailOrContext) {
      if (emailOrContext.email !== undefined) {
        context.email = emailOrContext.email
      }
      if (emailOrContext.tenantUserId !== undefined) {
        context.tenantUserId = emailOrContext.tenantUserId
      }
      if (emailOrContext.credentialProvider !== undefined) {
        context.credentialProvider = emailOrContext.credentialProvider
      }
      if (emailOrContext.redirectUri !== undefined) {
        context.redirectUri = emailOrContext.redirectUri
      }
      if (emailOrContext.providerMetadata !== undefined) {
        context.providerMetadata = emailOrContext.providerMetadata
      }
    }

    // Calculate expiry timestamp with buffer (OpenClaw pattern)
    // This stores the time when we SHOULD refresh, not when token actually expires
    const expiresAt = tokens.expires_in
      ? new Date(OAuthManager.coerceExpiresAt(tokens.expires_in, now)).toISOString()
      : null

    const credentialProvider =
      typeof context.credentialProvider === "string" && context.credentialProvider.length > 0
        ? context.credentialProvider
        : resolveCredentialProvider(provider)
    const tokenData = buildStoredOAuthConnection({
      provider,
      credentialProvider,
      tenantUserId: context.tenantUserId,
      redirectUri: context.redirectUri,
      email: context.email,
      providerMetadata: context.providerMetadata,
      expiresAt,
      now,
      tokens,
    })

    // Save as single encrypted JSON blob
    await this.storage.save(
      userId,
      OAUTH_TOKENS_NAMESPACE,
      provider, // Use provider name directly (e.g., 'linear', 'github')
      JSON.stringify(tokenData),
    )
  }

  /**
   * Gets refresh token for a user (if available)
   *
   * @param userId - User ID
   * @param provider - Provider name
   * @returns Refresh token or null
   */
  async getRefreshToken(userId: string, provider: string): Promise<string | null> {
    try {
      const storedConnection = await this.readStoredConnection(userId, provider)
      if (!storedConnection) {
        return null
      }

      return storedConnection.refresh_token
    } catch {
      return null
    }
  }

  /**
   * Checks if a user is connected to a provider
   *
   * @param userId - User ID
   * @param provider - Provider name
   * @returns true if user has an access token
   */
  async isConnected(userId: string, provider: string): Promise<boolean> {
    return this.storage.exists(userId, OAUTH_TOKENS_NAMESPACE, provider)
  }

  /**
   * Disconnects a user from a provider (removes all tokens)
   *
   * @param userId - User ID
   * @param provider - Provider name
   *
   * @example
   * await oauth.disconnect('user-456', 'linear');
   */
  async disconnect(userId: string, provider: string): Promise<void> {
    await this.storage.delete(userId, OAUTH_TOKENS_NAMESPACE, provider)
  }

  /**
   * Marks a connection as disabled without deleting it.
   * Disabled connections are rejected by getAccessToken() — user must re-authenticate.
   *
   * @param userId - User ID
   * @param provider - Provider name
   * @param reason - Why it was disabled (e.g., "refresh_failed", "token_revoked", "user_revoked")
   */
  async disableConnection(userId: string, provider: string, reason: string): Promise<void> {
    const stored = await this.readStoredConnection(userId, provider)
    if (!stored) {
      throw new Error(`User ${userId} is not connected to '${provider}'`)
    }

    const updated: StoredOAuthConnection = {
      ...stored,
      version: 2,
      disabled_at: new Date().toISOString(),
      disabled_reason: reason,
    }

    await this.storage.save(userId, OAUTH_TOKENS_NAMESPACE, provider, JSON.stringify(updated))
  }

  /**
   * Revokes a user's access token with the provider
   * (Also removes from local storage)
   *
   * @param tenantUserId - Tenant owner (for OAuth app credentials)
   * @param userId - User ID
   * @param provider - Provider name
   */
  async revoke(tenantUserId: string, userId: string, provider: string): Promise<void> {
    const storedConnection = await this.readStoredConnection(userId, provider)
    const configTenantUserId = storedConnection?.tenant_user_id ?? tenantUserId
    const credentialProvider = storedConnection?.credential_provider
    const config = await this.resolveProviderConfig(provider, configTenantUserId, credentialProvider)

    if (!config) {
      throw new Error(`OAuth not configured for '${provider}'. Set environment variables or configure in database.`)
    }

    // 2. Get user's access token
    const token = await this.getAccessToken(userId, provider)

    // 3. Revoke with provider (if supported)
    const oauthProvider = getProvider(provider)
    if (isRevocable(oauthProvider)) {
      await oauthProvider.revokeToken(
        token,
        config.client_id,
        config.client_secret,
        storedConnection?.provider_metadata,
      )
    }

    // 4. Remove from local storage
    await this.disconnect(userId, provider)

    // Audit: token revoked
    oauthAudit.tokenRevoked(provider, userId, { tenantId: configTenantUserId })
  }

  // ------------------------------------------------------------------
  // USER ENVIRONMENT KEYS
  // Scope convention:
  //   {} = global (all workspaces, all environments)
  //   { environment: "prod" } = environment-only
  //   { workspace: "example.alive.best" } = workspace-only
  //   { environment: "prod", workspace: "example.alive.best" } = both
  // ------------------------------------------------------------------

  /**
   * Saves a custom environment key for a user
   * These keys can be used by MCP servers for user-provided API keys
   *
   * @param userId - User ID
   * @param keyName - Key name (e.g., "OPENAI_API_KEY", "MY_SERVICE_TOKEN")
   * @param keyValue - The secret value to store
   *
   * @example
   * await oauth.setUserEnvKey('user-123', 'OPENAI_API_KEY', 'sk-...');
   */
  async setUserEnvKey(
    userId: string,
    keyName: string,
    keyValue: string,
    opts?: { workspace?: string; environment?: string },
  ): Promise<void> {
    // Validate key name format (alphanumeric + underscores, must start with letter)
    if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(keyName)) {
      throw new Error(
        `Invalid key name '${keyName}'. Must be uppercase, start with a letter, contain only letters, numbers, and underscores, and be at most 128 characters.`,
      )
    }

    const scope = buildEnvKeyScope(opts?.workspace, opts?.environment)
    await this.storage.save(userId, USER_ENV_KEYS_NAMESPACE, keyName, keyValue, scope)
  }

  /**
   * Gets a specific environment key for a user
   *
   * @param userId - User ID
   * @param keyName - Key name (e.g., "OPENAI_API_KEY")
   * @returns The key value or null if not found
   */
  async getUserEnvKey(
    userId: string,
    keyName: string,
    opts?: { workspace?: string; environment?: string },
  ): Promise<string | null> {
    const scope = buildEnvKeyScope(opts?.workspace, opts?.environment)
    return this.storage.get(userId, USER_ENV_KEYS_NAMESPACE, keyName, scope)
  }

  /**
   * Gets all environment keys for a user (values decrypted)
   *
   * @param userId - User ID
   * @returns Map of key names to values
   */
  /**
   * Gets all environment keys for a user, merged by precedence.
   * Precedence (highest wins): workspace+environment > workspace-only > environment-only > global.
   */
  async getAllUserEnvKeys(
    userId: string,
    opts?: { workspace?: string; environment?: string },
  ): Promise<Record<string, string>> {
    const { workspace, environment } = opts ?? {}

    // Build list of scopes to fetch, in precedence order (lowest first)
    const scopes: LockboxScope[] = [GLOBAL_SCOPE]
    if (environment) scopes.push(environmentScope(environment))
    if (workspace) scopes.push(workspaceScope(workspace))
    if (workspace && environment) scopes.push(workspaceEnvironmentScope(workspace, environment))

    // Fetch all scopes in parallel
    const scopeSecrets = await Promise.all(
      scopes.map(scope => this.storage.list(userId, USER_ENV_KEYS_NAMESPACE, scope)),
    )

    const result: Record<string, string> = {}

    // Merge in precedence order — later scopes overwrite earlier
    for (let i = 0; i < scopes.length; i++) {
      const scope = scopes[i]
      for (const secret of scopeSecrets[i]) {
        const value = await this.storage.get(userId, USER_ENV_KEYS_NAMESPACE, secret.name, scope)
        if (value !== null) result[secret.name] = value
      }
    }

    return result
  }

  /**
   * Lists environment key names for a user (without values)
   *
   * @param userId - User ID
   * @returns Array of key names
   */
  /**
   * Lists environment key metadata for a user (without values).
   * Returns all keys across all scopes so the UI can display scope badges.
   */
  async listUserEnvKeys(userId: string): Promise<Array<{ name: string; workspace: string; environment: string }>> {
    const secrets = await this.storage.list(userId, USER_ENV_KEYS_NAMESPACE)
    return secrets.map(s => {
      const scope = parseEnvKeyScope(s.scope)
      return {
        name: s.name,
        workspace: scope?.workspace ?? "",
        environment: scope?.environment ?? "",
      }
    })
  }

  /** @deprecated Use listUserEnvKeys() instead — returns scope info */
  async listUserEnvKeyNames(userId: string): Promise<string[]> {
    const secrets = await this.storage.list(userId, USER_ENV_KEYS_NAMESPACE)
    return Array.from(new Set(secrets.map(s => s.name)))
  }

  /**
   * Deletes an environment key for a user
   *
   * @param userId - User ID
   * @param keyName - Key name to delete
   */
  async deleteUserEnvKey(
    userId: string,
    keyName: string,
    opts?: { workspace?: string; environment?: string },
  ): Promise<void> {
    const scope = buildEnvKeyScope(opts?.workspace, opts?.environment)
    await this.storage.delete(userId, USER_ENV_KEYS_NAMESPACE, keyName, scope)
  }

  /**
   * Creates env key rows for multiple environments at once.
   * Empty environments array = single global row.
   */
  async setUserEnvKeyMultiEnv(
    userId: string,
    keyName: string,
    keyValue: string,
    opts: { workspace?: string; environments: string[] },
  ): Promise<void> {
    if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(keyName)) {
      throw new Error(
        `Invalid key name '${keyName}'. Must be uppercase, start with a letter, contain only letters, numbers, and underscores, and be at most 128 characters.`,
      )
    }

    const { workspace, environments } = opts

    if (environments.length === 0) {
      // Global (or workspace-only)
      const scope = workspace ? workspaceScope(workspace) : GLOBAL_SCOPE
      await this.storage.save(userId, USER_ENV_KEYS_NAMESPACE, keyName, keyValue, scope)
    } else {
      // One row per environment
      await Promise.all(
        environments.map(env => {
          const scope = buildEnvKeyScope(workspace, env)
          return this.storage.save(userId, USER_ENV_KEYS_NAMESPACE, keyName, keyValue, scope)
        }),
      )
    }
  }

  /**
   * Syncs which environments a key is available in.
   * Reads the existing value from any row, diffs environments, creates/deletes as needed.
   */
  async syncUserEnvKeyEnvironments(
    userId: string,
    keyName: string,
    opts: { workspace?: string; environments: string[] },
  ): Promise<void> {
    const { workspace, environments: desired } = opts

    // List all current rows for this key
    const allKeys = await this.storage.list(userId, USER_ENV_KEYS_NAMESPACE)
    const currentRows = allKeys.filter(s => {
      if (s.name !== keyName) return false
      const scope = parseEnvKeyScope(s.scope)
      return (scope?.workspace ?? "") === (workspace ?? "")
    })

    if (currentRows.length === 0) {
      throw new Error(`Key '${keyName}' not found`)
    }

    // Read the decrypted value from the first available row
    const firstRow = currentRows[0]
    const firstScope = parseEnvKeyScope(firstRow.scope)
    const value = await this.storage.get(
      userId,
      USER_ENV_KEYS_NAMESPACE,
      keyName,
      buildEnvKeyScope(firstScope?.workspace, firstScope?.environment),
    )
    if (!value) {
      throw new Error(`Could not decrypt value for key '${keyName}'`)
    }

    // Determine current environments
    const currentEnvs = new Set(
      currentRows.map(s => {
        const scope = parseEnvKeyScope(s.scope)
        return String(scope?.environment ?? "")
      }),
    )
    const desiredEnvs = new Set(desired)

    // If desired is empty, that means "global" — represented as single row with no environment
    if (desiredEnvs.size === 0) desiredEnvs.add("")

    // Similarly normalize current: if it had no environment entries, it's [""]
    if (currentEnvs.size === 0) currentEnvs.add("")

    // Delete rows for removed environments
    for (const env of currentEnvs) {
      if (!desiredEnvs.has(env)) {
        const scope = buildEnvKeyScope(workspace, env || undefined)
        await this.storage.delete(userId, USER_ENV_KEYS_NAMESPACE, keyName, scope)
      }
    }

    // Create rows for added environments
    for (const env of desiredEnvs) {
      if (!currentEnvs.has(env)) {
        const scope = buildEnvKeyScope(workspace, env || undefined)
        await this.storage.save(userId, USER_ENV_KEYS_NAMESPACE, keyName, value, scope)
      }
    }
  }

  /**
   * Deletes all environment rows for a key + workspace combination.
   */
  async deleteAllUserEnvKeyScopes(userId: string, keyName: string, workspace?: string): Promise<void> {
    const allKeys = await this.storage.list(userId, USER_ENV_KEYS_NAMESPACE)
    const toDelete = allKeys.filter(s => {
      if (s.name !== keyName) return false
      const scope = parseEnvKeyScope(s.scope)
      return (scope?.workspace ?? "") === (workspace ?? "")
    })

    await Promise.all(
      toDelete.map(s => {
        const scope = parseEnvKeyScope(s.scope)
        return this.storage.delete(
          userId,
          USER_ENV_KEYS_NAMESPACE,
          keyName,
          buildEnvKeyScope(scope?.workspace, scope?.environment),
        )
      }),
    )
  }

  /**
   * Checks if a user has a specific environment key
   *
   * @param userId - User ID
   * @param keyName - Key name
   * @returns true if the key exists
   */
  async hasUserEnvKey(
    userId: string,
    keyName: string,
    opts?: { workspace?: string; environment?: string },
  ): Promise<boolean> {
    const scope = buildEnvKeyScope(opts?.workspace, opts?.environment)
    return this.storage.exists(userId, USER_ENV_KEYS_NAMESPACE, keyName, scope)
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
  async getAuthUrl(tenantUserId: string, provider: string, scope: string, state?: string): Promise<string> {
    const config = await this.resolveProviderConfig(provider, tenantUserId)

    if (!config) {
      throw new Error(`OAuth not configured for '${provider}'. Set environment variables or configure in database.`)
    }

    const oauthProvider = getProvider(provider)
    // getAuthUrl is now required in OAuthProviderCore, no need to check
    return oauthProvider.getAuthUrl(config.client_id, config.redirect_uri || "", scope, state)
  }
}

// Factory function for creating OAuth instances with proper configuration
export function createOAuthManager(config: OAuthManagerConfig): OAuthManager {
  return new OAuthManager(config)
}

// Helper to build instance ID for different scenarios
export function buildInstanceId(
  provider: string,
  environment: string,
  tenantId?: string,
  runId?: string,
  workerIndex?: number,
): string {
  const parts = [provider, environment]

  if (tenantId) {
    parts.push(tenantId)
  }

  if (runId) {
    parts.push(runId)
  }

  if (workerIndex !== undefined) {
    parts.push(`w${workerIndex}`)
  }

  return parts.join(":")
}

let oauthSingleton: OAuthManager | null = null

function getOAuthSingleton(): OAuthManager {
  if (!oauthSingleton) {
    oauthSingleton = new OAuthManager()
  }
  return oauthSingleton
}

// Singleton for backwards compatibility, but initialized lazily to avoid import-time side effects.
// DEPRECATED: Use createOAuthManager() or new OAuthManager() with explicit config instead.
export const oauth: OAuthManager = new Proxy({} as OAuthManager, {
  get(_target, prop) {
    const instance = getOAuthSingleton()
    const value = Reflect.get(instance, prop)
    return typeof value === "function" ? value.bind(instance) : value
  },
  set(_target, prop, value) {
    const instance = getOAuthSingleton()
    return Reflect.set(instance, prop, value)
  },
})

export {
  ConsoleAuditLogger,
  NoopAuditLogger,
  type OAuthAuditEvent,
  type OAuthAuditEventType,
  type OAuthAuditLogger,
  oauthAudit,
} from "./audit"
// Dynamic Client Registration (RFC 7591)
export {
  type AuthorizationServerMetadata,
  AuthorizationServerMetadataSchema,
  type ClientRegistrationResponse,
  ClientRegistrationResponseSchema,
  discoverAuthorizationServer,
  type OAuth2GrantType,
  registerClient,
  selectBestAuthMethod,
  type TokenEndpointAuthMethod,
} from "./dynamic-client-registration"
export { FetchRetryError, type FetchWithRetryOptions, fetchWithRetry } from "./fetch-with-retry"
export {
  CURRENT_KEY_VERSION,
  deriveKey,
  type EncryptionMetadata,
  getKeyForVersion,
  type KeyDerivationContext,
  type KeyVersion,
  parseMetadata,
  serializeMetadata,
} from "./key-derivation"
// PKCE support (learned from n8n)
export { generatePKCEChallenge, type PKCEChallenge, verifyPKCEChallenge } from "./pkce"
// Extended provider options
export type {
  ExternalIdentityProvider,
  OAuthProvider,
  OAuthProviderCore,
  OAuthRefreshable,
  OAuthRevocable,
  PKCEOptions,
  TokenExchangeOptions,
} from "./providers/base"
export {
  isExternalIdentityProvider,
  isRefreshable,
  isRevocable,
  isUserInfoProvider,
  type UserInfoProvider,
} from "./providers/base"
export { GitHubProvider } from "./providers/github"
export { type GoogleAuthOptions, GoogleProvider, type GoogleUserInfo } from "./providers/google"
export { getProvider, hasProvider, listProviders, registerProvider } from "./providers/index"
export { LINEAR_SCOPES, LinearProvider } from "./providers/linear"
export { MicrosoftProvider, type MicrosoftUserInfo } from "./providers/microsoft"
export { STRIPE_SCOPES, StripeProvider, type StripeTokenResponse } from "./providers/stripe"
export {
  createRefreshLockManager,
  InMemoryRefreshLockManager,
  type IRefreshLockManager,
  type LockStrategy,
  RedisRefreshLockManager,
} from "./refresh-lock"
export type { EncryptedPayloadV2 } from "./security"
export { Security } from "./security"
export {
  environmentScope,
  GLOBAL_SCOPE,
  LockboxAdapter,
  type LockboxAdapterConfig,
  type LockboxScope,
  workspaceEnvironmentScope,
  workspaceScope,
} from "./storage"
// Re-export types and utilities
// Extended types
export type {
  EncryptedPayload,
  LockManagerConfig,
  OAuthManagerConfig,
  OAuthProviderMetadata,
  OAuthProviderMetadataValue,
  OAuthTokens,
  OAuthTokensWithMetadata,
  ProviderConfig,
  SaveTokensContext,
  SecretNamespace,
  TokenRotationResult,
  UserSecret,
} from "./types"
export { OAUTH_TOKENS_NAMESPACE, USER_ENV_KEYS_NAMESPACE } from "./types"
