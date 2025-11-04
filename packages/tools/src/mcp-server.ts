import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"
import { readServerLogsTool } from "./tools/debug/read-server-logs.js"
import { getGuideTool } from "./tools/guides/get-guide.js"
import { listGuidesTool } from "./tools/guides/list-guides.js"
import { generatePersonaTool } from "./tools/personas/generate-persona.js"
import { restartServerTool } from "./tools/workspace/restart-server.js"

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
  tools: [listGuidesTool, getGuideTool, readServerLogsTool, generatePersonaTool],
})

/**
 * Workspace Management MCP Server
 *
 * Tools for managing workspace dev servers.
 *
 * **Workspace Management:**
 * - restart_dev_server: Restart the systemd dev server for a workspace
 *
 * Tool names follow MCP pattern: mcp__workspace-management__<tool_name>
 */
export const workspaceManagementMcp = createSdkMcpServer({
  name: "workspace-management",
  version: "1.0.0",
  tools: [restartServerTool],
})

export const guidesMcp = toolsMcp
