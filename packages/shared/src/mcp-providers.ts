/**
 * MCP Providers Registry
 *
 * Contains two types of MCP providers:
 *
 * 1. OAUTH_MCP_PROVIDERS - Require OAuth authentication per user
 *    - Token fetching in stream route
 *    - MCP server configuration with auth headers
 *    - Tool permission (mcp__<provider>__* tools auto-allowed when connected)
 *
 * 2. GLOBAL_MCP_PROVIDERS - Always available to all users, no auth required
 *    - MCP server configured in worker
 *    - Tools added to allowed list
 *
 * @example Adding a new OAuth provider:
 * ```typescript
 * export const OAUTH_MCP_PROVIDERS = {
 *   ...existing,
 *   github: { url: "https://mcp.github.com", oauthKey: "github", friendlyName: "GitHub" },
 * } as const satisfies OAuthMcpProviderRegistry
 * ```
 *
 * @example Adding a new global provider:
 * ```typescript
 * export const GLOBAL_MCP_PROVIDERS = {
 *   ...existing,
 *   newProvider: { url: "http://localhost:9000/mcp", friendlyName: "New Provider", knownTools: [...] },
 * } as const satisfies GlobalMcpProviderRegistry
 * ```
 */

/**
 * Configuration for an OAuth-authenticated MCP provider
 */
export interface OAuthMcpProviderConfig {
  /** MCP server URL */
  url: string
  /**
   * OAuth provider key - must match a provider in oauth-instances.ts
   * Used to fetch the user's access token
   */
  oauthKey: string
  /**
   * Human-readable name for display in UI (e.g., "Stripe", "Linear")
   */
  friendlyName: string
  /**
   * Default OAuth scopes to request
   * Format varies by provider (comma-separated for Linear, space-separated for others)
   */
  defaultScopes: string
  /**
   * Environment variable prefix for credentials (e.g., "LINEAR" for LINEAR_CLIENT_ID)
   */
  envPrefix: string
  /**
   * Known tools provided by this MCP server (for documentation)
   * Tools are auto-discovered at runtime, this is just for reference
   */
  knownTools?: readonly string[]
}

/**
 * Type for the provider registry
 */
export type OAuthMcpProviderRegistry = Record<string, OAuthMcpProviderConfig>

/**
 * Registry of OAuth-authenticated MCP providers
 *
 * To add a new provider:
 * 1. Add entry here with url and oauthKey
 * 2. Ensure OAuth provider exists in oauth-instances.ts
 * 3. That's it! Token fetching, MCP config, and tool permissions work automatically
 */
export const OAUTH_MCP_PROVIDERS = {
  stripe: {
    url: "https://mcp.stripe.com",
    oauthKey: "stripe",
    friendlyName: "Stripe",
    defaultScopes: "read_write",
    envPrefix: "STRIPE",
    knownTools: [
      // Account & Balance
      "mcp__stripe__get_stripe_account_info",
      "mcp__stripe__retrieve_balance",
      // Coupons
      "mcp__stripe__create_coupon",
      "mcp__stripe__list_coupons",
      // Customers
      "mcp__stripe__create_customer",
      "mcp__stripe__list_customers",
      // Disputes
      "mcp__stripe__list_disputes",
      "mcp__stripe__update_dispute",
      // Invoices
      "mcp__stripe__create_invoice",
      "mcp__stripe__create_invoice_item",
      "mcp__stripe__finalize_invoice",
      "mcp__stripe__list_invoices",
      // Payment Links
      "mcp__stripe__create_payment_link",
      // Payment Intents
      "mcp__stripe__list_payment_intents",
      // Prices
      "mcp__stripe__create_price",
      "mcp__stripe__list_prices",
      // Products
      "mcp__stripe__create_product",
      "mcp__stripe__list_products",
      // Refunds
      "mcp__stripe__create_refund",
      // Subscriptions
      "mcp__stripe__cancel_subscription",
      "mcp__stripe__list_subscriptions",
      "mcp__stripe__update_subscription",
      // Search & Fetch
      "mcp__stripe__search_stripe_resources",
      "mcp__stripe__fetch_stripe_resources",
      "mcp__stripe__search_stripe_documentation",
    ],
  },
  linear: {
    url: "https://mcp.linear.app/mcp",
    oauthKey: "linear",
    friendlyName: "Linear",
    defaultScopes: "read,write,issues:create",
    envPrefix: "LINEAR",
    knownTools: [
      // Comments
      "mcp__linear__list_comments",
      "mcp__linear__create_comment",
      // Cycles
      "mcp__linear__list_cycles",
      // Documents
      "mcp__linear__get_document",
      "mcp__linear__list_documents",
      // Issues
      "mcp__linear__get_issue",
      "mcp__linear__list_issues",
      "mcp__linear__create_issue",
      "mcp__linear__update_issue",
      // Issue Statuses & Labels
      "mcp__linear__list_issue_statuses",
      "mcp__linear__get_issue_status",
      "mcp__linear__list_issue_labels",
      "mcp__linear__create_issue_label",
      // Projects
      "mcp__linear__list_projects",
      "mcp__linear__get_project",
      "mcp__linear__create_project",
      "mcp__linear__update_project",
      "mcp__linear__list_project_labels",
      // Teams
      "mcp__linear__list_teams",
      "mcp__linear__get_team",
      // Users
      "mcp__linear__list_users",
      "mcp__linear__get_user",
      // Search
      "mcp__linear__search_documentation",
    ],
  },
} as const satisfies OAuthMcpProviderRegistry

/**
 * Type for provider keys (e.g., "stripe" | "linear")
 */
export type OAuthMcpProviderKey = keyof typeof OAUTH_MCP_PROVIDERS

/**
 * Map of provider keys to access tokens
 * Partial because users may not have all providers connected
 *
 * Note: This is different from oauth-core's OAuthTokens which represents
 * the full token structure (access_token, refresh_token, expires_in, etc.)
 */
export type ProviderTokenMap = Partial<Record<OAuthMcpProviderKey, string>>

/**
 * Get all provider keys
 */
export function getOAuthMcpProviderKeys(): OAuthMcpProviderKey[] {
  return Object.keys(OAUTH_MCP_PROVIDERS) as OAuthMcpProviderKey[]
}

/**
 * Type guard to check if a string is a valid OAuth MCP provider key
 *
 * @param key - The string to check
 * @returns true if key is a valid OAuthMcpProviderKey
 */
export function isValidOAuthMcpProviderKey(key: string): key is OAuthMcpProviderKey {
  return key in OAUTH_MCP_PROVIDERS
}

/**
 * Check if a tool name belongs to a connected OAuth MCP provider
 *
 * @param toolName - The tool name (e.g., "mcp__stripe__list_customers")
 * @param connectedProviders - Set or array of connected provider keys
 * @returns true if the tool belongs to a connected provider
 */
export function isOAuthMcpTool(toolName: string, connectedProviders: Set<string> | string[]): boolean {
  const providers = connectedProviders instanceof Set ? connectedProviders : new Set(connectedProviders)

  for (const providerKey of Object.keys(OAUTH_MCP_PROVIDERS)) {
    if (providers.has(providerKey) && toolName.startsWith(`mcp__${providerKey}__`)) {
      return true
    }
  }

  return false
}

/**
 * Get friendly name for an MCP tool
 *
 * @param toolName - The tool name (e.g., "mcp__stripe__list_customers")
 * @returns Object with provider friendly name and action, or null if not an MCP tool
 *
 * @example
 * getMcpToolFriendlyName("mcp__stripe__list_customers")
 * // Returns: { provider: "Stripe", action: "list_customers" }
 */
export function getMcpToolFriendlyName(toolName: string): { provider: string; action: string } | null {
  if (!toolName.startsWith("mcp__")) return null

  // Check OAuth providers first
  for (const [providerKey, config] of Object.entries(OAUTH_MCP_PROVIDERS)) {
    const prefix = `mcp__${providerKey}__`
    if (toolName.startsWith(prefix)) {
      const action = toolName.slice(prefix.length)
      return {
        provider: config.friendlyName,
        action: action.replace(/_/g, " "),
      }
    }
  }

  // Check global providers
  for (const [providerKey, config] of Object.entries(GLOBAL_MCP_PROVIDERS)) {
    const prefix = `mcp__${providerKey}__`
    if (toolName.startsWith(prefix)) {
      const action = toolName.slice(prefix.length)
      return {
        provider: config.friendlyName,
        action: action.replace(/-/g, " "),
      }
    }
  }

  // Unknown MCP provider - extract what we can
  const parts = toolName.split("__")
  if (parts.length >= 3) {
    return {
      provider: parts[1].charAt(0).toUpperCase() + parts[1].slice(1),
      action: parts.slice(2).join(" ").replace(/_/g, " "),
    }
  }

  return null
}

// =============================================================================
// Global MCP Providers (always available, no authentication required)
// =============================================================================

/**
 * Configuration for a global (unauthenticated) MCP provider
 */
export interface GlobalMcpProviderConfig {
  /** MCP server URL */
  url: string
  /** Human-readable name for display in UI */
  friendlyName: string
  /**
   * Known tools provided by this MCP server (for documentation)
   * Tools are auto-discovered at runtime, this is just for reference
   */
  knownTools: readonly string[]
}

/**
 * Type for the global provider registry
 */
export type GlobalMcpProviderRegistry = Record<string, GlobalMcpProviderConfig>

/**
 * Registry of global (always-available) MCP providers
 *
 * These servers are available to ALL users without authentication.
 * To add a new provider:
 * 1. Add entry here with url and knownTools
 * 2. Add tools to CONTEXT7_TOOLS in agent-constants.mjs
 * 3. Add server config in worker-entry.mjs
 */
export const GLOBAL_MCP_PROVIDERS = {
  context7: {
    url: "http://localhost:8082/mcp",
    friendlyName: "Context7",
    knownTools: ["mcp__context7__resolve-library-id", "mcp__context7__get-library-docs"] as const,
  },
  "google-scraper": {
    url: "http://localhost:8083/mcp",
    friendlyName: "Google Maps",
    knownTools: ["mcp__google-scraper__search_google_maps"] as const,
  },
} as const satisfies GlobalMcpProviderRegistry

/**
 * Type for global provider keys (e.g., "context7")
 */
export type GlobalMcpProviderKey = keyof typeof GLOBAL_MCP_PROVIDERS

/**
 * Get all global provider keys
 */
export function getGlobalMcpProviderKeys(): GlobalMcpProviderKey[] {
  return Object.keys(GLOBAL_MCP_PROVIDERS) as GlobalMcpProviderKey[]
}

/**
 * Get all tool names from global MCP providers
 */
export function getGlobalMcpToolNames(): string[] {
  const tools: string[] = []
  for (const config of Object.values(GLOBAL_MCP_PROVIDERS)) {
    tools.push(...config.knownTools)
  }
  return tools
}
