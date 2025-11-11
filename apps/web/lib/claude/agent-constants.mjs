import { toolsMcp, workspaceManagementMcp } from "@alive-brug/tools"

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

// MCP tools (handled by child process, no path validation needed in parent)
const BASE_MCP_TOOLS = [
  "mcp__workspace-management__restart_dev_server",
  "mcp__workspace-management__install_package",
  "mcp__tools__list_guides",
  "mcp__tools__get_guide",
  "mcp__tools__find_guide",
  "mcp__tools__batch_get_guides",
  "mcp__tools__get_alive_super_template",
  "mcp__tools__generate_persona",
  // "mcp__tools__search_tools", // Disabled
  "mcp__tools__debug_workspace",
  "mcp__tools__read_server_logs",
]

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
 * Get allowed tools based on workspace
 *
 * @param {string} workspacePath - Path to workspace
 * @returns {string[]} Allowed tools list
 */
export function getAllowedTools(workspacePath) {
  let mcpTools = [...BASE_MCP_TOOLS]

  // Extract domain from workspace path
  const domainMatch = workspacePath.match(/\/sites\/([^/]+)/)
  const domain = domainMatch ? domainMatch[1] : null

  // Add all Stripe MCP tools for riggedwheel.alive.best
  if (domain === "riggedwheel.alive.best") {
    mcpTools = [...mcpTools, ...STRIPE_MCP_TOOLS]
  }

  return [...ALLOWED_SDK_TOOLS, ...mcpTools]
}

// Legacy exports for backwards compatibility
export const ALLOWED_MCP_TOOLS = BASE_MCP_TOOLS
export const ALLOWED_TOOLS = getAllowedTools("")

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
 * Get MCP servers configuration based on workspace
 * Allows workspace-specific MCP server access control
 *
 * @param {string} workspacePath - Path to workspace (e.g., /srv/webalive/sites/larsvandeneeeden.com/user)
 * @returns {Object} MCP servers configuration
 */
export function getMcpServers(workspacePath) {
  const baseServers = {
    "workspace-management": workspaceManagementMcp,
    tools: toolsMcp,
  }

  // Extract domain from workspace path
  // Pattern: /srv/webalive/sites/{domain}/user or /root/webalive/sites/{domain}/user
  const domainMatch = workspacePath.match(/\/sites\/([^/]+)/)
  const domain = domainMatch ? domainMatch[1] : null

  // Stripe MCP: Only available for riggedwheel.alive.best
  if (domain === "riggedwheel.alive.best") {
    baseServers.stripe = {
      type: "http",
      url: "https://mcp.stripe.com",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_OAUTH_TOKEN || ""}`,
      },
    }
  }

  return baseServers
}

// Legacy export for backwards compatibility (uses empty workspace path)
export const MCP_SERVERS = getMcpServers("")

export const PERMISSION_MODE = "default"
/** @type {import('@anthropic-ai/claude-agent-sdk').SettingSource[]} */
export const SETTINGS_SOURCES = ["project"]
