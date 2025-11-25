/**
 * OAuth Instance Factory
 *
 * Provides properly configured OAuth manager instances for different providers
 * and environments, replacing the singleton pattern with explicit instances.
 */

import { createOAuthManager, buildInstanceId, type OAuthManagerConfig } from "@webalive/oauth-core"

/**
 * Get the current environment from environment variables
 */
function getCurrentEnvironment(): string {
  const env = process.env.BRIDGE_ENV || process.env.NODE_ENV || "production"

  // Normalize environment names
  switch (env) {
    case "development":
      return "dev"
    case "test":
      return "test"
    case "staging":
      return "staging"
    case "production":
    case "prod":
      return "prod"
    case "local":
      return "local"
    default:
      console.warn(`Unknown environment: ${env}, defaulting to dev`)
      return "dev"
  }
}

/**
 * Get TTL based on environment
 */
function getDefaultTtl(environment: string): number | undefined {
  switch (environment) {
    case "test":
      return 600 // 10 minutes for tests
    case "local":
    case "dev":
      return 3600 // 1 hour for development
    case "staging":
      return 86400 // 24 hours for staging
    case "prod":
      return undefined // No TTL in production
    default:
      return 3600 // Default to 1 hour
  }
}

/**
 * Create a Linear OAuth manager instance
 */
export function createLinearOAuthManager(): ReturnType<typeof createOAuthManager> {
  const environment = getCurrentEnvironment()
  const instanceId = buildInstanceId("linear", environment)

  const config: OAuthManagerConfig = {
    provider: "linear",
    instanceId,
    namespace: "oauth_connections",
    environment,
    defaultTtlSeconds: getDefaultTtl(environment),
  }

  return createOAuthManager(config)
}

/**
 * Create a GitHub OAuth manager instance
 */
export function createGitHubOAuthManager(): ReturnType<typeof createOAuthManager> {
  const environment = getCurrentEnvironment()
  const instanceId = buildInstanceId("github", environment)

  const config: OAuthManagerConfig = {
    provider: "github",
    instanceId,
    namespace: "oauth_connections",
    environment,
    defaultTtlSeconds: getDefaultTtl(environment),
  }

  return createOAuthManager(config)
}

/**
 * Create a Stripe OAuth manager instance
 */
export function createStripeOAuthManager(): ReturnType<typeof createOAuthManager> {
  const environment = getCurrentEnvironment()
  const instanceId = buildInstanceId("stripe", environment)

  const config: OAuthManagerConfig = {
    provider: "stripe",
    instanceId,
    namespace: "oauth_connections",
    environment,
    defaultTtlSeconds: getDefaultTtl(environment),
  }

  return createOAuthManager(config)
}

/**
 * Create an OAuth manager for E2E tests
 */
export function createE2EOAuthManager(
  provider: string,
  runId: string,
  workerIndex: number,
): ReturnType<typeof createOAuthManager> {
  const instanceId = buildInstanceId(provider, "test", undefined, runId, workerIndex)

  const config: OAuthManagerConfig = {
    provider,
    instanceId,
    namespace: "oauth_connections",
    environment: "test",
    defaultTtlSeconds: 300, // 5 minutes for E2E tests
  }

  return createOAuthManager(config)
}

/**
 * Create a multi-tenant OAuth manager
 */
export function createTenantOAuthManager(provider: string, tenantId: string): ReturnType<typeof createOAuthManager> {
  const environment = getCurrentEnvironment()
  const instanceId = buildInstanceId(provider, environment, tenantId)

  const config: OAuthManagerConfig = {
    provider,
    instanceId,
    namespace: "oauth_connections",
    environment,
    defaultTtlSeconds: getDefaultTtl(environment),
  }

  return createOAuthManager(config)
}

// Singleton instances for backward compatibility
// These are created once and reused throughout the application
let linearInstance: ReturnType<typeof createOAuthManager> | null = null
let githubInstance: ReturnType<typeof createOAuthManager> | null = null
let stripeInstance: ReturnType<typeof createOAuthManager> | null = null

/**
 * Get the Linear OAuth manager instance (singleton within the app)
 */
export function getLinearOAuth(): ReturnType<typeof createOAuthManager> {
  if (!linearInstance) {
    linearInstance = createLinearOAuthManager()
  }
  return linearInstance
}

/**
 * Get the GitHub OAuth manager instance (singleton within the app)
 */
export function getGitHubOAuth(): ReturnType<typeof createOAuthManager> {
  if (!githubInstance) {
    githubInstance = createGitHubOAuthManager()
  }
  return githubInstance
}

/**
 * Get the Stripe OAuth manager instance (singleton within the app)
 */
export function getStripeOAuth(): ReturnType<typeof createOAuthManager> {
  if (!stripeInstance) {
    stripeInstance = createStripeOAuthManager()
  }
  return stripeInstance
}

// Re-export client-safe provider constants
export { SUPPORTED_OAUTH_PROVIDERS, isOAuthProviderSupported } from "./providers"
export type { OAuthProvider } from "./providers"

/**
 * Get OAuth manager instance for any provider (generic factory)
 *
 * @param provider - Provider key (e.g., 'linear', 'github')
 * @returns OAuth manager instance
 * @throws Error if provider is not supported
 */
export function getOAuthInstance(provider: string): ReturnType<typeof createOAuthManager> {
  switch (provider.toLowerCase()) {
    case "linear":
      return getLinearOAuth()
    case "github":
      return getGitHubOAuth()
    case "stripe":
      return getStripeOAuth()
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`)
  }
}

// Export environment helper for debugging
export { getCurrentEnvironment }
