import { getEnabledMcpToolNames, toolsInternalMcp, workspaceInternalMcp } from "@alive-brug/tools"

export const BRIDGE_STREAM_TYPES = {
  START: "bridge_start",
  SESSION: "bridge_session",
  MESSAGE: "bridge_message",
  COMPLETE: "bridge_complete",
  ERROR: "bridge_error",
  PING: "bridge_ping",
  DONE: "bridge_done",
  INTERRUPT: "bridge_interrupt",
}

export const BRIDGE_SYNTHETIC_MESSAGE_TYPES = {
  WARNING: "bridge_warning",
}

export const BRIDGE_INTERRUPT_SOURCES = {
  HTTP_ABORT: "bridge_http_abort",
  CLIENT_CANCEL: "bridge_client_cancel",
}

// SDK built-in tools (file operations with workspace path validation)
export const ALLOWED_SDK_TOOLS = ["Write", "Edit", "Read", "Glob", "Grep"]

// MCP tools (auto-generated from TOOL_REGISTRY in packages/tools/src/tools/meta/tool-registry.ts)
// To enable/disable tools, set enabled=true/false in TOOL_REGISTRY - this list updates automatically
const BASE_MCP_TOOLS = getEnabledMcpToolNames()

// Export for use in tool-permissions.ts
export const ALLOWED_MCP_TOOLS = BASE_MCP_TOOLS

// Stripe MCP tools (only for riggedwheel.alive.best)
const STRIPE_MCP_TOOLS = [
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
]

/**
 * Get allowed tools based on workspace and user access
 *
 * @param {string} workspacePath - Path to workspace
 * @param {Object} options - Additional options
 * @param {boolean} [options.hasStripeConnection] - Whether user has connected Stripe OAuth
 * @returns {string[]} Allowed tools list
 */
export function getAllowedTools(_workspacePath, options = {}) {
  let mcpTools = [...BASE_MCP_TOOLS]

  // Add all Stripe MCP tools if user has connected Stripe
  if (options.hasStripeConnection) {
    mcpTools = [...mcpTools, ...STRIPE_MCP_TOOLS]
  }

  return [...ALLOWED_SDK_TOOLS, ...mcpTools]
}

export const DISALLOWED_TOOLS = [
  "Bash",
  "bash",
  "Shell",
  "shell",
  "Exec",
  "exec",
  "Delete",
  "delete",
  "Rm",
  "rm",
  "Remove",
  "remove",
  "Task",
  "task",
  "WebSearch",
  "websearch",
]

/**
 * Get MCP servers configuration based on workspace and user access
 * Allows per-user MCP server access control
 *
 * @param {string} workspacePath - Path to workspace (e.g., /srv/webalive/sites/example.com/user)
 * @param {Object} options - Additional options
 * @param {string} [options.stripeAccessToken] - User's Stripe OAuth access token (if connected)
 * @returns {Object} MCP servers configuration
 */
export function getMcpServers(_workspacePath, options = {}) {
  const baseServers = {
    "alive-workspace": workspaceInternalMcp,
    "alive-tools": toolsInternalMcp,
  }

  // Stripe MCP: Include if user has connected their Stripe account
  // Token is fetched asynchronously in the stream route and passed here
  if (options.stripeAccessToken) {
    baseServers.stripe = {
      type: "http",
      url: "https://mcp.stripe.com",
      headers: {
        Authorization: `Bearer ${options.stripeAccessToken}`,
      },
    }
  }

  return baseServers
}

/**
 * Check if Stripe MCP is available for a user
 * DEPRECATED: This function was workspace-based. Now use user-based checks via OAuth.
 *
 * @param {string} _workspacePath - Ignored (kept for backwards compatibility)
 * @param {boolean} hasStripeConnection - Whether user has connected Stripe OAuth
 * @returns {boolean} True if user has Stripe MCP access
 */
export function hasStripeMcpAccess(_workspacePath, hasStripeConnection = false) {
  // Now based on user's OAuth connection, not workspace
  return hasStripeConnection
}

export const PERMISSION_MODE = "default"
/** @type {import('@anthropic-ai/claude-agent-sdk').SettingSource[]} */
export const SETTINGS_SOURCES = ["project"]
