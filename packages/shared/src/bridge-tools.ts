/**
 * Bridge Tools Configuration
 *
 * SOURCE OF TRUTH for SDK tool permissions and Bridge agent configuration.
 *
 * This file defines:
 * - Which SDK tools are allowed/disallowed in Bridge mode
 * - Helper functions for building tool lists and MCP servers
 *
 * Used by:
 * - apps/web/lib/claude/agent-constants.mjs (runtime)
 * - apps/web/lib/claude/sdk-tools-sync.ts (type validation)
 * - packages/tools/src/lib/ask-ai-full.ts (askAIFull Bridge mode)
 */

import { PATHS } from "./config.js"
import { OAUTH_MCP_PROVIDERS, GLOBAL_MCP_PROVIDERS, isOAuthMcpTool } from "./mcp-providers.js"

// =============================================================================
// SDK TOOL DEFINITIONS
// =============================================================================

/**
 * SDK built-in tools we ALLOW in the Bridge.
 *
 * Categories:
 * - File operations: Read, Write, Edit, Glob, Grep (workspace-scoped)
 * - Planning/workflow: ExitPlanMode, TodoWrite
 * - MCP integration: ListMcpResources, Mcp, ReadMcpResource
 * - Other safe: NotebookEdit, WebFetch, AskUserQuestion
 */
// Use regular arrays (not as const) for compatibility with SDK types that expect string[]
export const BRIDGE_ALLOWED_SDK_TOOLS: string[] = [
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

export type BridgeAllowedSDKTool =
  | "Read"
  | "Write"
  | "Edit"
  | "Glob"
  | "Grep"
  | "ExitPlanMode"
  | "TodoWrite"
  | "ListMcpResources"
  | "Mcp"
  | "ReadMcpResource"
  | "NotebookEdit"
  | "WebFetch"
  | "AskUserQuestion"

/**
 * Admin-only SDK tools.
 *
 * These tools are dangerous but useful for admins:
 * - Bash: Shell command execution
 * - BashOutput: Read output from background shell
 * - KillShell: Kill a background shell process
 */
export const BRIDGE_ADMIN_ONLY_SDK_TOOLS = ["Bash", "BashOutput", "KillShell"] as const
export type BridgeAdminOnlySDKTool = (typeof BRIDGE_ADMIN_ONLY_SDK_TOOLS)[number]

/**
 * SDK tools we ALWAYS DISALLOW in the Bridge (even for admins).
 *
 * Why disallowed:
 * - Task: Subagent spawning - not supported in Bridge architecture
 * - WebSearch: External web access - not needed, cost concerns
 *
 * Note: Superadmins get ALL tools including these.
 */
export const BRIDGE_ALWAYS_DISALLOWED_SDK_TOOLS = ["Task", "WebSearch"] as const
export type BridgeAlwaysDisallowedSDKTool = (typeof BRIDGE_ALWAYS_DISALLOWED_SDK_TOOLS)[number]

/**
 * Get disallowed SDK tools based on admin/superadmin status.
 *
 * @param isAdmin - Whether the user is an admin
 * @param isSuperadmin - Whether the user is a superadmin (gets ALL tools)
 * @returns Array of disallowed tool names
 */
export function getBridgeDisallowedTools(isAdmin: boolean, isSuperadmin = false): string[] {
  // Superadmins have nothing blocked
  if (isSuperadmin) {
    return []
  }
  if (isAdmin) {
    // Admins only have Task and WebSearch blocked
    return [...BRIDGE_ALWAYS_DISALLOWED_SDK_TOOLS]
  }
  // Non-admins have Bash tools + always-disallowed blocked
  return [...BRIDGE_ADMIN_ONLY_SDK_TOOLS, ...BRIDGE_ALWAYS_DISALLOWED_SDK_TOOLS]
}

export type BridgeDisallowedSDKTool = BridgeAdminOnlySDKTool | BridgeAlwaysDisallowedSDKTool

/**
 * Default permission mode for Bridge
 */
export const BRIDGE_PERMISSION_MODE = "default" as const

/**
 * Default settings sources for Bridge
 */
export const BRIDGE_SETTINGS_SOURCES = ["project"] as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all allowed tools for Bridge mode (SDK + MCP tools).
 *
 * @param getEnabledMcpToolNames - Function to get enabled MCP tool names from @alive-brug/tools
 * @param isAdmin - Whether the user is an admin (enables Bash tools)
 * @param isSuperadmin - Whether the user is a superadmin (gets ALL tools)
 * @returns Array of allowed tool names
 */
export function getBridgeAllowedTools(
  getEnabledMcpToolNames: () => string[],
  isAdmin = false,
  isSuperadmin = false,
): string[] {
  const mcpTools = getEnabledMcpToolNames()
  const globalMcpTools = Object.values(GLOBAL_MCP_PROVIDERS).flatMap(p => [...p.knownTools])

  // Superadmins get ALL tools (including Task, WebSearch)
  if (isSuperadmin) {
    return [
      ...BRIDGE_ALLOWED_SDK_TOOLS,
      ...BRIDGE_ADMIN_ONLY_SDK_TOOLS,
      ...BRIDGE_ALWAYS_DISALLOWED_SDK_TOOLS, // Task, WebSearch enabled for superadmin
      ...mcpTools,
      ...globalMcpTools,
    ]
  }

  const adminTools = isAdmin ? [...BRIDGE_ADMIN_ONLY_SDK_TOOLS] : []
  return [...BRIDGE_ALLOWED_SDK_TOOLS, ...adminTools, ...mcpTools, ...globalMcpTools]
}

/**
 * MCP server configuration type (simplified for serialization)
 */
export interface BridgeMcpServerConfig {
  type: "http" | "sdk"
  url?: string
  headers?: Record<string, string>
}

/**
 * Get MCP servers configuration for Bridge mode.
 *
 * @param internalMcpServers - Internal MCP servers from @alive-brug/tools
 * @param oauthTokens - OAuth tokens keyed by provider
 * @returns MCP servers configuration
 */
export function getBridgeMcpServers<T>(
  internalMcpServers: { "alive-workspace": T; "alive-tools": T },
  oauthTokens: Record<string, string> = {},
): Record<string, T | BridgeMcpServerConfig> {
  const servers: Record<string, T | BridgeMcpServerConfig> = {
    "alive-workspace": internalMcpServers["alive-workspace"],
    "alive-tools": internalMcpServers["alive-tools"],
  }

  // Add OAuth MCP servers for connected providers
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

  // Add global MCP servers (always available, no auth required)
  for (const [providerKey, config] of Object.entries(GLOBAL_MCP_PROVIDERS)) {
    servers[providerKey] = {
      type: "http",
      url: config.url,
    }
  }

  return servers
}

/**
 * Create canUseTool handler for Bridge mode.
 *
 * @param baseAllowedTools - Base allowed tools array
 * @param connectedProviders - Array of connected OAuth provider keys
 * @param isAdmin - Whether the user is an admin (enables Bash tools)
 * @returns Permission handler function
 */
export function createBridgeCanUseTool(
  baseAllowedTools: string[],
  connectedProviders: string[],
  isAdmin = false,
): (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<{
  behavior: "allow" | "deny"
  message?: string
  updatedInput?: Record<string, unknown>
  updatedPermissions?: unknown[]
}> {
  // Get disallowed tools based on admin status
  const disallowedTools = getBridgeDisallowedTools(isAdmin)

  return async (toolName, input) => {
    // Explicit deny list takes precedence (respects admin status)
    if (disallowedTools.includes(toolName)) {
      return {
        behavior: "deny",
        message: `Tool "${toolName}" is not available in site builder mode.`,
      }
    }

    // Check base allowed tools (SDK + internal MCP tools + admin tools if applicable)
    if (baseAllowedTools.includes(toolName)) {
      return {
        behavior: "allow",
        updatedInput: input,
        updatedPermissions: [],
      }
    }

    // Check OAuth MCP tools - auto-allowed if user has that provider connected
    if (isOAuthMcpTool(toolName, connectedProviders)) {
      return {
        behavior: "allow",
        updatedInput: input,
        updatedPermissions: [],
      }
    }

    // Tool not in any allowed list
    return {
      behavior: "deny",
      message: `Tool "${toolName}" is not permitted. Connect the required integration in Settings to use this tool.`,
    }
  }
}

/**
 * Get workspace path for a domain.
 *
 * @param domain - Domain name (e.g., "example.com")
 * @returns Full workspace path
 */
export function getWorkspacePath(domain: string): string {
  return `${PATHS.SITES_ROOT}/${domain}/user`
}
