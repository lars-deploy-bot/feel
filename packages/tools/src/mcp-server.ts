import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"
// Debug tools
import { readConsoleLogsTool } from "./tools/debug/read-console-logs.js"
import { readNetworkRequestsTool } from "./tools/debug/read-network-requests.js"
import { sandboxScreenshotTool } from "./tools/debug/sandbox-screenshot.js"
// Guide tools
import { getGuideTool } from "./tools/guides/get-guide.js"
import { listGuidesTool } from "./tools/guides/list-guides.js"

/**
 * Alive Tools MCP Server
 *
 * Comprehensive tool suite for Claude Bridge development platform.
 *
 * Available tools:
 *
 * **Guides & Documentation:**
 * - list_guides: Discover available guides across different categories
 * - get_guide: Retrieve specific guide content by category and topic
 *
 * **Debugging & Diagnostics:**
 * - read_console_logs: Capture browser console output (logs, errors, warnings)
 * - read_network_requests: Capture all network activity (API calls, responses, timing)
 * - sandbox_screenshot: Take screenshots of deployed websites
 *
 * Usage in Claude Bridge:
 * - Tool names: mcp__tools__<tool_name> (e.g., mcp__tools__read_console_logs)
 * - Register in mcpServers config
 * - Add to allowedTools whitelist
 */
export const toolsMcp = createSdkMcpServer({
  name: "tools",
  version: "1.0.0",
  tools: [
    // Guides
    listGuidesTool,
    getGuideTool,
    // Debug
    readConsoleLogsTool,
    readNetworkRequestsTool,
    sandboxScreenshotTool,
  ],
})

// Export legacy name for backward compatibility
export const guidesMcp = toolsMcp
