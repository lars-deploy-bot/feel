/**
 * @alive-brug/tools
 *
 * Comprehensive MCP tool suite for Claude Bridge development platform.
 * Provides guides, debugging tools, and diagnostic capabilities.
 *
 * This package exports an MCP server that can be imported and registered in the
 * Claude Bridge web application to provide Claude with access to:
 * - Development guides and best practices
 * - Browser console log capture
 * - Network request monitoring
 * - Screenshot capabilities
 *
 * @example
 * ```typescript
 * import { toolsMcp } from "@alive-brug/tools"
 *
 * const claudeOptions = {
 *   mcpServers: {
 *     "tools": toolsMcp
 *   },
 *   allowedTools: [
 *     // Guides
 *     "mcp__tools__list_guides",
 *     "mcp__tools__get_guide",
 *     // Debug
 *     "mcp__tools__read_console_logs",
 *     "mcp__tools__read_network_requests",
 *     "mcp__tools__sandbox_screenshot"
 *   ]
 * }
 * ```
 */

// Shared utilities
export { browserManager } from "./lib/browser-manager.js"
// MCP Server
export { guidesMcp, toolsMcp } from "./mcp-server.js"
// Debug Tools
export { readConsoleLogsTool } from "./tools/debug/read-console-logs.js"
export { readNetworkRequestsTool } from "./tools/debug/read-network-requests.js"
export { sandboxScreenshotTool } from "./tools/debug/sandbox-screenshot.js"
// Guide Tools
export { getGuideTool } from "./tools/guides/get-guide.js"
export { listGuidesTool } from "./tools/guides/list-guides.js"
