import { getEnabledMcpToolNames, toolsInternalMcp, workspaceInternalMcp } from "@alive-brug/tools"
import {
  OAUTH_MCP_PROVIDERS,
  getGlobalMcpToolNames,
  BRIDGE_STREAM_TYPES,
  BRIDGE_SYNTHETIC_MESSAGE_TYPES,
  BRIDGE_INTERRUPT_SOURCES,
} from "@webalive/shared"

// Re-export from canonical source (@webalive/shared)
export { BRIDGE_STREAM_TYPES, BRIDGE_SYNTHETIC_MESSAGE_TYPES, BRIDGE_INTERRUPT_SOURCES }

/**
 * SDK built-in tools we ALLOW in the Bridge.
 *
 * SOURCE OF TRUTH: sdk-tools-sync.ts (ALLOWED_SDK_TOOLS)
 * Keep this array in sync with the TypeScript definition for type safety.
 *
 * Categories:
 * - File operations: Read, Write, Edit, Glob, Grep (workspace-scoped)
 * - Planning/workflow: ExitPlanMode, TodoWrite
 * - MCP integration: ListMcpResources, Mcp, ReadMcpResource
 * - Other safe: NotebookEdit, WebFetch, AskUserQuestion
 */
export const ALLOWED_SDK_TOOLS = [
  // File operations (workspace-scoped)
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  // Planning & workflow
  "ExitPlanMode",
  "TodoWrite",
  // MCP integration
  "ListMcpResources",
  "Mcp",
  "ReadMcpResource",
  // Other safe tools
  "NotebookEdit",
  "WebFetch",
  "AskUserQuestion",
]

// MCP tools (auto-generated from TOOL_REGISTRY in packages/tools/src/tools/meta/tool-registry.ts)
// To enable/disable tools, set enabled=true/false in TOOL_REGISTRY - this list updates automatically
const BASE_MCP_TOOLS = getEnabledMcpToolNames()

// Global MCP tools (from GLOBAL_MCP_PROVIDERS in @webalive/shared)
// These are always available to all users without authentication
const GLOBAL_MCP_TOOLS = getGlobalMcpToolNames()

// Export for use in tool-permissions.ts
export const ALLOWED_MCP_TOOLS = [...BASE_MCP_TOOLS, ...GLOBAL_MCP_TOOLS]

/**
 * Get base allowed tools (SDK tools + internal MCP tools)
 *
 * Note: OAuth MCP tools (stripe, linear, etc.) are handled dynamically in run-agent.mjs
 * based on connected providers. Tools matching mcp__<provider>__* are auto-allowed
 * when the user has that provider connected.
 *
 * @param {string} workspacePath - Path to workspace
 * @returns {string[]} Base allowed tools list
 */
export function getAllowedTools(_workspacePath) {
  // Base tools: SDK built-ins + all MCP tools (internal + global)
  // OAuth MCP tools are allowed dynamically in canUseTool based on connected providers
  return [...ALLOWED_SDK_TOOLS, ...ALLOWED_MCP_TOOLS]
}

/**
 * Disallowed SDK tools.
 *
 * SOURCE OF TRUTH: sdk-tools-sync.ts (DISALLOWED_SDK_TOOLS)
 * Keep this array in sync with the TypeScript definition for type safety.
 *
 * These are the actual tool names from the Claude Agent SDK (sdk-tools.d.ts v0.1.53).
 * The SDK uses PascalCase tool names (e.g., "Bash" not "bash").
 *
 * Why disallowed:
 * - Bash/BashOutput/KillShell: Shell access - security risk, could escape workspace
 * - Task: Subagent spawning - not supported in Bridge architecture
 * - WebSearch: External web access - not needed, cost concerns
 *
 * Note: Delete/Remove are NOT SDK tools. File deletion is handled via
 * MCP tool mcp__alive-workspace__delete_file with full security protections.
 */
export const DISALLOWED_TOOLS = [
  // Shell access - dangerous, could escape workspace sandbox
  "Bash",
  "BashOutput",
  "KillShell",
  // Subagent spawning - not supported in Bridge
  "Task",
  // Web access - not needed, cost concerns
  "WebSearch",
]

/**
 * Get MCP servers configuration based on workspace and user access
 * Allows per-user MCP server access control
 *
 * Uses OAUTH_MCP_PROVIDERS registry from @webalive/shared as the single source of truth.
 * To add a new OAuth MCP provider, add it to the registry - no changes needed here.
 *
 * @param {string} workspacePath - Path to workspace (e.g., /srv/webalive/sites/example.com/user)
 * @param {Object} options - Additional options
 * @param {Record<string, string>} [options.oauthTokens] - OAuth tokens keyed by provider (e.g., { stripe: "sk_...", linear: "lin_..." })
 * @returns {Object} MCP servers configuration
 */
export function getMcpServers(_workspacePath, options = {}) {
  const servers = {
    "alive-workspace": workspaceInternalMcp,
    "alive-tools": toolsInternalMcp,
  }

  // Add OAuth MCP servers for connected providers
  // Uses registry from @webalive/shared - add new providers there, not here
  const { oauthTokens = {} } = options
  for (const [providerKey, config] of Object.entries(OAUTH_MCP_PROVIDERS)) {
    const token = oauthTokens[providerKey]
    if (token) {
      servers[providerKey] = {
        type: "http",
        url: config.url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    }
  }

  return servers
}

/**
 * Get ONLY the OAuth MCP servers (HTTP-based, serializable via JSON).
 *
 * Used by the worker pool: internal MCP servers (alive-workspace, alive-tools) are
 * created locally in the worker because createSdkMcpServer returns function objects
 * that cannot be serialized via IPC.
 *
 * @param {Record<string, string>} [oauthTokens] - OAuth tokens keyed by provider
 * @returns {Object} OAuth MCP servers configuration (serializable)
 */
export function getOAuthMcpServers(oauthTokens = {}) {
  const servers = {}

  for (const [providerKey, config] of Object.entries(OAUTH_MCP_PROVIDERS)) {
    const token = oauthTokens[providerKey]
    if (token) {
      servers[providerKey] = {
        type: "http",
        url: config.url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    }
  }

  return servers
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
