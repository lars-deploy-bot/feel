/**
 * OAuth Token Fetcher
 *
 * Fetches all OAuth tokens for MCP providers in parallel.
 * Uses the registry from @webalive/shared as the single source of truth.
 *
 * Includes a negative cache: revoked/expired tokens are not re-attempted
 * for 5 minutes per user+provider, avoiding wasted round-trips to Google OAuth
 * servers on every chat request.
 */

import {
  formatProviderName,
  OAUTH_MCP_PROVIDERS,
  type OAuthFetchResult,
  type OAuthMcpProviderKey,
  type OAuthWarning,
  type ProviderTokenMap,
} from "@webalive/shared"
import { getOAuthInstance } from "./oauth-instances"

interface Logger {
  log: (message: string) => void
}

/**
 * Negative cache for failed OAuth token refreshes.
 * Key: `${userId}:${providerKey}`, Value: { expiresAt, warning }
 *
 * Prevents retrying revoked tokens on every request.
 * Cache clears when user re-authenticates (different code path).
 */
interface NegativeCacheEntry {
  expiresAt: number
  warning: OAuthWarning
}

const oauthNegativeCache = new Map<string, NegativeCacheEntry>()
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const NEGATIVE_CACHE_MAX_SIZE = 200

function getNegativeCacheKey(userId: string, providerKey: string): string {
  return `${userId}:${providerKey}`
}

/**
 * Clear the negative cache for a specific user+provider.
 * Call this when a user successfully re-authenticates a provider.
 */
export function clearOAuthNegativeCache(userId: string, providerKey?: string): void {
  if (providerKey) {
    oauthNegativeCache.delete(getNegativeCacheKey(userId, providerKey))
  } else {
    // Clear all entries for this user
    for (const key of oauthNegativeCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        oauthNegativeCache.delete(key)
      }
    }
  }
}

/** Evict expired entries when cache exceeds max size. */
function pruneNegativeCache(now: number): void {
  if (oauthNegativeCache.size <= NEGATIVE_CACHE_MAX_SIZE) return
  for (const [key, entry] of oauthNegativeCache) {
    if (entry.expiresAt <= now) oauthNegativeCache.delete(key)
  }
  while (oauthNegativeCache.size > NEGATIVE_CACHE_MAX_SIZE) {
    const firstKey = oauthNegativeCache.keys().next().value
    if (firstKey !== undefined) oauthNegativeCache.delete(firstKey)
  }
}

/**
 * Fetches OAuth tokens for all registered MCP providers.
 * Only returns tokens for providers where the user has an active connection.
 * Also returns warnings for providers that need reconnection.
 *
 * Revoked/expired tokens are cached negatively for 5 minutes to avoid
 * retrying round-trips to OAuth servers on every request.
 *
 * @param userId - The user ID to fetch tokens for
 * @param logger - Optional logger for debugging
 * @returns Object with tokens and warnings
 */
export async function fetchOAuthTokens(userId: string, logger?: Logger): Promise<OAuthFetchResult> {
  const tokens: ProviderTokenMap = {}
  const warnings: OAuthWarning[] = []
  const now = Date.now()

  // Fetch all tokens in parallel for performance
  const results = await Promise.allSettled(
    Object.entries(OAUTH_MCP_PROVIDERS).map(async ([key, config]) => {
      const providerKey = key as OAuthMcpProviderKey

      // Check negative cache first — skip providers with known-bad tokens
      const cacheKey = getNegativeCacheKey(userId, providerKey)
      const cached = oauthNegativeCache.get(cacheKey)
      if (cached) {
        if (cached.expiresAt > now) {
          // Still in negative cache — return cached warning without network call
          return { providerKey, token: null, warning: cached.warning }
        }
        // Cache expired — remove and retry
        oauthNegativeCache.delete(cacheKey)
      }

      try {
        const oauth = getOAuthInstance(config.oauthKey)
        const token = await oauth.getAccessToken(userId, config.oauthKey)
        if (token) {
          return { providerKey, token, warning: null }
        }
        return { providerKey, token: null, warning: null }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        // Distinguish between expected "not connected" vs actionable errors
        if (errorMessage.includes("not connected to")) {
          // User simply hasn't connected this provider - this is normal
          return { providerKey, token: null, warning: null }
        }

        // Token refresh failures and other errors should be logged and warned
        // These indicate the user WAS connected but something went wrong
        let warning: OAuthWarning | null = null

        const displayName = formatProviderName(providerKey)

        if (
          errorMessage.includes("is disabled") ||
          errorMessage.includes("revoked") ||
          errorMessage.includes("invalid_grant")
        ) {
          logger?.log(`⚠️ ${providerKey} OAuth error: ${errorMessage}`)
          logger?.log(`   User needs to reconnect ${providerKey} in Settings > Integrations`)
          warning = {
            provider: providerKey,
            message: `Your ${displayName} connection has expired. Please reconnect in Settings > Integrations.`,
            needsReauth: true,
          }
        } else if (errorMessage.includes("refresh") || errorMessage.includes("expired")) {
          logger?.log(`⚠️ ${providerKey} OAuth error: ${errorMessage}`)
          warning = {
            provider: providerKey,
            message: `Your ${displayName} token refresh failed. Please reconnect in Settings > Integrations.`,
            needsReauth: true,
          }
        } else {
          // Log unexpected errors for debugging
          logger?.log(`${providerKey} OAuth fetch failed: ${errorMessage}`)
        }

        // Cache the failure so we don't retry on the next request
        if (warning?.needsReauth) {
          pruneNegativeCache(now)
          oauthNegativeCache.set(cacheKey, {
            expiresAt: now + NEGATIVE_CACHE_TTL_MS,
            warning,
          })
        }

        return { providerKey, token: null, warning }
      }
    }),
  )

  // Collect successful token fetches and warnings
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      const { providerKey, token, warning } = result.value
      if (token) {
        tokens[providerKey] = token
        logger?.log(`User has ${providerKey} OAuth connection`)
      }
      if (warning) {
        warnings.push(warning)
      }
    }
  }

  return { tokens, warnings }
}

/**
 * Get the set of connected provider keys from tokens object
 *
 * @param tokens - Provider token map
 * @returns Set of connected provider keys
 */
export function getConnectedProviders(tokens: ProviderTokenMap): Set<OAuthMcpProviderKey> {
  return new Set(
    Object.entries(tokens)
      .filter(([, token]) => !!token)
      .map(([key]) => key as OAuthMcpProviderKey),
  )
}

// Re-export types for convenience
export type { OAuthFetchResult, OAuthMcpProviderKey, OAuthWarning, ProviderTokenMap }
