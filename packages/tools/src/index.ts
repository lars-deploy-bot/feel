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

export { guidesMcp, toolsMcp, workspaceManagementMcp } from "./mcp-server.js"
export { batchGetGuidesTool } from "./tools/batch/batch-get-guides.js"
export { debugWorkspaceTool } from "./tools/composite/debug-workspace.js"
export { debugFindGuide, findGuideTool } from "./tools/composite/find-guide.js"
export { readServerLogsTool } from "./tools/debug/read-server-logs.js"
export { getGuideTool } from "./tools/guides/get-guide.js"
export { listGuidesTool } from "./tools/guides/list-guides.js"
export { searchToolsTool } from "./tools/meta/search-tools.js"
export { generatePersonaTool } from "./tools/personas/generate-persona.js"
export { getTemplateTool } from "./tools/templates/get-template.js"
export { installPackageTool } from "./tools/workspace/install-package.js"
export { restartServerTool } from "./tools/workspace/restart-server.js"
