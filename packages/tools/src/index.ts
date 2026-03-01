/**
 * @webalive/tools
 *
 * Comprehensive MCP tool suite for Alive development platform.
 * Provides debugging, automation, and workspace capabilities.
 *
 * @example
 * ```typescript
 * import { toolsInternalMcp, workspaceInternalMcp } from "@webalive/tools"
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

// Display configuration (non-React)
export {
  getDisplayConfig,
  getPreview,
  isVisibleInNormalMode,
  plural,
  registerDisplayConfig,
  shouldAutoExpand,
  type ToolDisplayConfig,
  transformData,
  unwrapMcp,
} from "./display-config.js"
// AI utilities
export { type AskAIOptions, askAI, CLAUDE_MODELS, type ClaudeModel } from "./lib/ask-ai.js"
// Full-featured AI (all agent tools enabled)
// Note: CLAUDE_MODELS is already exported from ask-ai.ts above
export {
  type AskAIFullOptions,
  type AskAIFullResult,
  ask,
  askAIFull,
  askWorkspace,
  PERMISSION_MODES,
  type PermissionMode,
  SETTINGS_SOURCES,
  type SettingsSource,
} from "./lib/ask-ai-full.js"
export {
  type ParsedSkill,
  parseSkillContent,
  type SkillFrontmatter,
  skillIdToDisplayName,
  validateSkillContent,
} from "./lib/skill-frontmatter.js"
export {
  isTemplateEnabled,
  type PartialTemplateFrontmatter,
  parseFrontmatter,
  REQUIRED_FRONTMATTER_FIELDS,
  type TemplateFrontmatter,
  validateFrontmatter,
} from "./lib/template-frontmatter.js"
// MCP servers
export { emailInternalMcp, supabaseInternalMcp, toolsInternalMcp, workspaceInternalMcp } from "./mcp-server.js"
export type {
  AITool,
  AutomationTool,
  BrowserTool,
  EmailTool,
  FileOpTool,
  LinearTool,
  OtherTool,
  OutlookTool,
  StripeTool,
  ToolName,
} from "./tool-names.js"
// Tool name constants
export { AI, AUTOMATION, BROWSER, CALENDAR, EMAIL, FILE_OPS, LINEAR, OTHER, OUTLOOK, STRIPE } from "./tool-names.js"
export {
  getEnabledMcpToolNames,
  setSearchToolsConnectedProviders,
  withSearchToolsConnectedProviders,
} from "./tools/meta/search-tools.js"
export { SDK_TOOLS, type SDKTool } from "./tools/meta/tool-registry.js"
// Agent-to-Agent (A2A) Session Tools
export {
  type AgentToAgentPolicy,
  DEFAULT_A2A_POLICY,
  executeSessionsHistory,
  executeSessionsList,
  executeSessionsSend,
  isA2AAllowed,
  // Types
  type SessionInfo,
  type SessionMessage,
  type SessionSendResult,
  type SessionsHistoryContext,
  type SessionsHistoryParams,
  type SessionsHistoryResult,
  type SessionsListContext,
  type SessionsListParams,
  type SessionsListResult,
  type SessionsSendContext,
  type SessionsSendParams,
  // sessions_history
  sessionsHistorySchema,
  sessionsHistoryToolDefinition,
  // sessions_list
  sessionsListSchema,
  sessionsListToolDefinition,
  // sessions_send
  sessionsSendSchema,
  sessionsSendToolDefinition,
} from "./tools/sessions/index.js"
// Skill utilities
export {
  getSkillById,
  listProjectSkills,
  listSkillsFromDir,
  listSuperadminSkills,
  mergeSkills,
  type SkillListItem,
  type SkillSource,
} from "./tools/skills/list-skills.js"
// Template utilities
export {
  getTemplateById,
  getTemplatesByCategory,
  listTemplates,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type TemplateListItem,
} from "./tools/templates/list-templates.js"
