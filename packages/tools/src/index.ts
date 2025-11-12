/**
 * @alive-brug/tools
 *
 * Comprehensive MCP tool suite for Claude Bridge development platform.
 * Provides guides, debugging tools, and diagnostic capabilities.
 *
 * @example
 * ```typescript
 * import { toolsInternalMcp, workspaceInternalMcp } from "@alive-brug/tools"
 *
 * const claudeOptions = {
 *   mcpServers: {
 *     "alive-tools": toolsInternalMcp,
 *     "alive-workspace": workspaceInternalMcp
 *   },
 *   allowedTools: [
 *     "mcp__alive-tools__search_tools",
 *     "mcp__alive-tools__read_server_logs"
 *   ]
 * }
 * ```
 */

export { toolsInternalMcp, workspaceInternalMcp } from "./mcp-server.js"
export { getEnabledMcpToolNames } from "./tools/meta/search-tools.js"
export { SDK_TOOLS, type SDKTool } from "./tools/meta/tool-registry.js"
