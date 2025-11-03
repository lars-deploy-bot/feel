/**
 * @alive-brug/tools
 *
 * Comprehensive MCP tool suite for Claude Bridge development platform.
 * Provides guides, debugging tools, and diagnostic capabilities.
 *
 * @example
 * ```typescript
 * import { toolsMcp } from "@alive-brug/tools"
 *
 * const claudeOptions = {
 *   mcpServers: { tools: toolsMcp },
 *   allowedTools: [
 *     "mcp__tools__list_guides",
 *     "mcp__tools__get_guide",
 *     "mcp__tools__read_server_logs"
 *   ]
 * }
 * ```
 */

export { guidesMcp, toolsMcp } from "./mcp-server.js"
export { readServerLogsTool } from "./tools/debug/read-server-logs.js"
export { getGuideTool } from "./tools/guides/get-guide.js"
export { listGuidesTool } from "./tools/guides/list-guides.js"
