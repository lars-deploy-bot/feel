import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"
import { batchGetGuidesTool } from "./tools/batch/batch-get-guides.js"
import { debugWorkspaceTool } from "./tools/composite/debug-workspace.js"
import { findGuideTool } from "./tools/composite/find-guide.js"
import { readServerLogsTool } from "./tools/debug/read-server-logs.js"
import { getGuideTool } from "./tools/guides/get-guide.js"
import { listGuidesTool } from "./tools/guides/list-guides.js"
import { searchToolsTool } from "./tools/meta/search-tools.js"
import { generatePersonaTool } from "./tools/personas/generate-persona.js"
import { installPackageTool } from "./tools/workspace/install-package.js"
import { restartServerTool } from "./tools/workspace/restart-server.js"

/**
 * Alive Tools MCP Server
 *
 * Comprehensive tool suite for Claude Bridge development platform.
 *
 * **Tool Discovery (Progressive Disclosure):**
 * - search_tools: Find tools by query/category with configurable detail levels (Anthropic best practice)
 *
 * **Composite Tools (Reduce Round Trips):**
 * - debug_workspace: Reads logs + analyzes + suggests fixes in one call
 * - find_guide: Searches + retrieves guides in one call
 *
 * **Batch Operations:**
 * - batch_get_guides: Retrieve multiple guides in one call (max 5)
 *
 * **Guides & Documentation:**
 * - list_guides: Discover available guides (context-efficient mode, result hints)
 * - get_guide: Retrieve specific guide content
 *
 * **Debugging & Diagnostics:**
 * - read_server_logs: Read systemd logs (summary mode, regex filtering, result hints)
 *
 * **Context Efficiency:**
 * All tools implement Anthropic's November 2024 MCP best practices:
 * - Progressive disclosure (load only what's needed)
 * - Context-efficient modes (summary/brief options)
 * - Result hints (suggest next actions)
 * - Batch operations (reduce round trips)
 * - Tool composition (higher-level operations)
 * - Aggressive filtering (regex support)
 *
 * Tool names follow MCP pattern: mcp__tools__<tool_name>
 */
export const toolsMcp = createSdkMcpServer({
  name: "tools",
  version: "1.0.0",
  tools: [
    searchToolsTool,
    debugWorkspaceTool,
    findGuideTool,
    batchGetGuidesTool,
    listGuidesTool,
    getGuideTool,
    readServerLogsTool,
    generatePersonaTool,
  ],
})

/**
 * Workspace Management MCP Server
 *
 * Tools for managing workspace dev servers.
 *
 * **Workspace Management:**
 * - restart_dev_server: Restart the systemd dev server for a workspace
 * - install_package: Install a package in the user's workspace using bun
 *
 * Tool names follow MCP pattern: mcp__workspace-management__<tool_name>
 */
export const workspaceManagementMcp = createSdkMcpServer({
  name: "workspace-management",
  version: "1.0.0",
  tools: [restartServerTool, installPackageTool],
})

export const guidesMcp = toolsMcp
