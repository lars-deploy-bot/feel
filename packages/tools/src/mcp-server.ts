import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"
import { readServerLogsTool } from "./tools/debug/read-server-logs.js"
import { getGuideTool } from "./tools/guides/get-guide.js"
import { listGuidesTool } from "./tools/guides/list-guides.js"

/**
 * Alive Tools MCP Server
 *
 * Comprehensive tool suite for Claude Bridge development platform.
 *
 * **Guides & Documentation:**
 * - list_guides: Discover available guides across different categories
 * - get_guide: Retrieve specific guide content by category and topic
 *
 * **Debugging & Diagnostics:**
 * - read_server_logs: Read systemd journal logs from workspace dev servers (Vite build errors, server crashes, etc.)
 *
 * Tool names follow MCP pattern: mcp__tools__<tool_name>
 */
export const toolsMcp = createSdkMcpServer({
	name: "tools",
	version: "1.0.0",
	tools: [listGuidesTool, getGuideTool, readServerLogsTool],
})

export const guidesMcp = toolsMcp
