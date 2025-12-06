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

// MCP servers
export { toolsInternalMcp, workspaceInternalMcp } from "./mcp-server.js"
export { getEnabledMcpToolNames } from "./tools/meta/search-tools.js"
export { SDK_TOOLS, type SDKTool } from "./tools/meta/tool-registry.js"

// Tool name constants
export { LINEAR, STRIPE, FILE_OPS, OTHER } from "./tool-names.js"
export type { LinearTool, StripeTool, FileOpTool, OtherTool, ToolName } from "./tool-names.js"

// Display configuration (non-React)
export {
  getDisplayConfig,
  shouldAutoExpand,
  isVisibleInNormalMode,
  getPreview,
  transformData,
  registerDisplayConfig,
  unwrapMcp,
  plural,
} from "./display-config.js"
export type { ToolDisplayConfig } from "./display-config.js"

// AI utilities
export { askAI, CLAUDE_MODELS, type AskAIOptions, type ClaudeModel } from "./lib/ask-ai.js"

// Full-featured AI (all Claude Code tools enabled)
// Note: CLAUDE_MODELS is already exported from ask-ai.ts above
export {
  askAIFull,
  ask,
  askBridge,
  PERMISSION_MODES,
  SETTINGS_SOURCES,
  type AskAIFullOptions,
  type AskAIFullResult,
  type PermissionMode,
  type SettingsSource,
} from "./lib/ask-ai-full.js"
