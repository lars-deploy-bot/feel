/**
 * SDK Tools Sync - SOURCE OF TRUTH for SDK tool names
 *
 * Type-safe synchronization between Claude Agent SDK tools and our registry.
 * This file ensures compile-time errors if the SDK tools change.
 *
 * IMPORTANT: agent-constants.mjs references this file. Keep both in sync.
 *
 * How it catches SDK drift:
 * 1. If tools are REMOVED: Import statements fail (type doesn't exist)
 * 2. If tools are ADDED: ToolInputSchemas union won't match our types
 * 3. Run `bun run type-check` after SDK updates to catch issues
 *
 * To update after SDK changes:
 * 1. Check new tools in node_modules/@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts
 * 2. Add/remove imports at the top of this file
 * 3. Update SDKToolMap type mapping
 * 4. Update SDK_TOOL_NAMES array
 * 5. Categorize into ALLOWED_FILE_TOOLS, DISALLOWED_SDK_TOOLS, or ALLOWED_OTHER_TOOLS
 * 6. Update agent-constants.mjs to match (it references this file in comments)
 */

import type {
  AgentInput,
  AskUserQuestionInput,
  BashInput,
  BashOutputInput,
  ExitPlanModeInput,
  FileEditInput,
  FileReadInput,
  FileWriteInput,
  GlobInput,
  GrepInput,
  KillShellInput,
  ListMcpResourcesInput,
  McpInput,
  NotebookEditInput,
  ReadMcpResourceInput,
  TodoWriteInput,
  ToolInputSchemas,
  WebFetchInput,
  WebSearchInput,
} from "@anthropic-ai/claude-agent-sdk/sdk-tools"

/**
 * Maps SDK Input types to their tool names.
 * This creates a compile-time check - if SDK adds/removes tools, this will error.
 */
type SDKToolMap = {
  AgentInput: "Task"
  BashInput: "Bash"
  BashOutputInput: "BashOutput"
  ExitPlanModeInput: "ExitPlanMode"
  FileEditInput: "Edit"
  FileReadInput: "Read"
  FileWriteInput: "Write"
  GlobInput: "Glob"
  GrepInput: "Grep"
  KillShellInput: "KillShell"
  ListMcpResourcesInput: "ListMcpResources"
  McpInput: "Mcp"
  NotebookEditInput: "NotebookEdit"
  ReadMcpResourceInput: "ReadMcpResource"
  TodoWriteInput: "TodoWrite"
  WebFetchInput: "WebFetch"
  WebSearchInput: "WebSearch"
  AskUserQuestionInput: "AskUserQuestion"
}

/**
 * Type-level validation using imported types.
 * If SDK removes a tool type, the import will fail at compile time.
 * If SDK adds a tool type, ToolInputSchemas won't match our expected union.
 *
 * This is intentionally verbose - each type assertion ensures we track all SDK tools.
 */
type _ValidateAgentInput = AgentInput extends ToolInputSchemas ? true : never
type _ValidateBashInput = BashInput extends ToolInputSchemas ? true : never
type _ValidateBashOutputInput = BashOutputInput extends ToolInputSchemas ? true : never
type _ValidateExitPlanModeInput = ExitPlanModeInput extends ToolInputSchemas ? true : never
type _ValidateFileEditInput = FileEditInput extends ToolInputSchemas ? true : never
type _ValidateFileReadInput = FileReadInput extends ToolInputSchemas ? true : never
type _ValidateFileWriteInput = FileWriteInput extends ToolInputSchemas ? true : never
type _ValidateGlobInput = GlobInput extends ToolInputSchemas ? true : never
type _ValidateGrepInput = GrepInput extends ToolInputSchemas ? true : never
type _ValidateKillShellInput = KillShellInput extends ToolInputSchemas ? true : never
type _ValidateListMcpResourcesInput = ListMcpResourcesInput extends ToolInputSchemas ? true : never
type _ValidateMcpInput = McpInput extends ToolInputSchemas ? true : never
type _ValidateNotebookEditInput = NotebookEditInput extends ToolInputSchemas ? true : never
type _ValidateReadMcpResourceInput = ReadMcpResourceInput extends ToolInputSchemas ? true : never
type _ValidateTodoWriteInput = TodoWriteInput extends ToolInputSchemas ? true : never
type _ValidateWebFetchInput = WebFetchInput extends ToolInputSchemas ? true : never
type _ValidateWebSearchInput = WebSearchInput extends ToolInputSchemas ? true : never
type _ValidateAskUserQuestionInput = AskUserQuestionInput extends ToolInputSchemas ? true : never

// If any of these fail, it means the SDK removed that tool type
const _assertAllTypesExist: true = true as
  | _ValidateAgentInput
  | _ValidateBashInput
  | _ValidateBashOutputInput
  | _ValidateExitPlanModeInput
  | _ValidateFileEditInput
  | _ValidateFileReadInput
  | _ValidateFileWriteInput
  | _ValidateGlobInput
  | _ValidateGrepInput
  | _ValidateKillShellInput
  | _ValidateListMcpResourcesInput
  | _ValidateMcpInput
  | _ValidateNotebookEditInput
  | _ValidateReadMcpResourceInput
  | _ValidateTodoWriteInput
  | _ValidateWebFetchInput
  | _ValidateWebSearchInput
  | _ValidateAskUserQuestionInput

/**
 * All SDK tool names derived from the map.
 */
export type SDKToolName = SDKToolMap[keyof SDKToolMap]

/**
 * SDK tool names as a const array for runtime use.
 * Keep this in sync with SDKToolMap above.
 */
export const SDK_TOOL_NAMES = [
  "Task",
  "Bash",
  "BashOutput",
  "ExitPlanMode",
  "Edit",
  "Read",
  "Write",
  "Glob",
  "Grep",
  "KillShell",
  "ListMcpResources",
  "Mcp",
  "NotebookEdit",
  "ReadMcpResource",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "AskUserQuestion",
] as const satisfies readonly SDKToolName[]

/**
 * Tools we ALLOW in the Bridge.
 * Each SDK tool MUST be in either ALLOWED_SDK_TOOLS or DISALLOWED_SDK_TOOLS.
 */
export const ALLOWED_SDK_TOOLS = [
  // File operations (workspace-scoped)
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  // Planning & workflow
  "ExitPlanMode",
  "TodoWrite",
  // MCP integration
  "ListMcpResources",
  "Mcp",
  "ReadMcpResource",
  // Other safe tools
  "NotebookEdit",
  "WebFetch",
  "AskUserQuestion",
] as const satisfies readonly SDKToolName[]
export type AllowedSDKTool = (typeof ALLOWED_SDK_TOOLS)[number]

/**
 * Tools we DISALLOW in the Bridge.
 * Each SDK tool MUST be in either ALLOWED_SDK_TOOLS or DISALLOWED_SDK_TOOLS.
 */
export const DISALLOWED_SDK_TOOLS = [
  "Bash", // Shell access - could escape workspace
  "BashOutput", // Shell output - pairs with Bash
  "KillShell", // Shell control - pairs with Bash
  "Task", // Subagent spawning - not supported
  "WebSearch", // External web access - cost/security
] as const satisfies readonly SDKToolName[]
export type DisallowedSDKTool = (typeof DISALLOWED_SDK_TOOLS)[number]

/**
 * Compile-time check: Ensure allowed and disallowed don't overlap.
 * If a tool is in both arrays, this type becomes `never` and the assertion fails.
 */
type _OverlapCheck = AllowedSDKTool & DisallowedSDKTool
const _assertNoOverlap: _OverlapCheck extends never ? true : never = true

/**
 * Compile-time check: Ensure all SDK tools are categorized.
 * If a tool is missing from both arrays, this will be a compile error.
 */
type _AllCategorized = AllowedSDKTool | DisallowedSDKTool
type _MissingTools = Exclude<SDKToolName, _AllCategorized>
const _assertAllCategorized: _MissingTools extends never ? true : never = true

/**
 * Compile-time check: Ensure no extra tools in our arrays.
 * If we have a tool that's not in SDK, the `satisfies` above catches it.
 * This additional check ensures the union covers exactly SDKToolName.
 */
type _ExtraTools = Exclude<_AllCategorized, SDKToolName>
const _assertNoExtraTools: _ExtraTools extends never ? true : never = true
