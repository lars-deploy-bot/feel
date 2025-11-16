import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"
import { debugWorkspaceTool } from "./tools/composite/debug-workspace.js"
import { readServerLogsTool } from "./tools/debug/read-server-logs.js"
import { getWorkflowTool } from "./tools/meta/get-workflow.js"
import { listWorkflowsTool } from "./tools/meta/list-workflows.js"
import { searchToolsTool } from "./tools/meta/search-tools.js"
import { generatePersonaTool } from "./tools/personas/generate-persona.js"
import { getAliveSuperTemplateTool } from "./tools/templates/get-template.js"
import { checkCodebaseTool } from "./tools/workspace/check-codebase.js"
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
 *
 * **Templates:**
 * - get_alive_super_template: Retrieve Alive Super Template content
 *
 * **Debugging & Diagnostics:**
 * - read_server_logs: Read systemd logs (summary mode, regex filtering, result hints)
 *
 * **Context Efficiency:**
 * All tools implement Anthropic's November 2024 MCP best practices:
 * - Progressive disclosure (load only what's needed)
 * - Context-efficient modes (summary/brief options)
 * - Result hints (suggest next actions)
 * - Aggressive filtering (regex support)
 *
 * Tool names follow MCP pattern: mcp__alive-tools__<tool_name>
 */
export const toolsInternalMcp = createSdkMcpServer({
  name: "alive-tools",
  version: "1.0.0",
  tools: [
    searchToolsTool,
    getWorkflowTool,
    listWorkflowsTool,
    debugWorkspaceTool,
    getAliveSuperTemplateTool,
    readServerLogsTool,
    generatePersonaTool,
  ],
})

/**
 * Alive Workspace MCP Server
 *
 * Tools for managing workspace dev servers.
 *
 * **Workspace Management:**
 * - restart_dev_server: Restart the systemd dev server for a workspace
 * - install_package: Install a package in the user's workspace using bun
 * - check_codebase: Run TypeScript and ESLint checks on the codebase
 *
 * Tool names follow MCP pattern: mcp__alive-workspace__<tool_name>
 */
export const workspaceInternalMcp = createSdkMcpServer({
  name: "alive-workspace",
  version: "1.0.0",
  tools: [restartServerTool, installPackageTool, checkCodebaseTool],
})
