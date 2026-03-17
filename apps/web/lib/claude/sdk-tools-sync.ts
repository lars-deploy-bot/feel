/**
 * SDK Tools Sync - Type validation against Claude Agent SDK
 *
 * Validates that our Stream tool registry in @webalive/shared is aligned with
 * SDK tool names/types. This module also derives runtime allow/deny snapshots
 * for tests from the centralized stream policy registry.
 */

import type {
  AgentInput,
  AskUserQuestionInput,
  BashInput,
  ExitPlanModeInput,
  FileEditInput,
  FileReadInput,
  FileWriteInput,
  GlobInput,
  GrepInput,
  ListMcpResourcesInput,
  McpInput,
  NotebookEditInput,
  ReadMcpResourceInput,
  TaskStopInput,
  TodoWriteInput,
  ToolInputSchemas,
  WebFetchInput,
  WebSearchInput,
} from "@anthropic-ai/claude-agent-sdk/sdk-tools"

import {
  createStreamToolContext,
  getStreamToolDecision,
  isUserApprovalTool,
  SDK_TOOL,
  STREAM_SDK_TOOL_NAMES,
  type StreamSdkToolName,
} from "@webalive/shared"

// -----------------------------------------------------------------------------
// Runtime snapshots derived from central policy
// -----------------------------------------------------------------------------

const memberContext = createStreamToolContext({
  isAdmin: false,
  isSuperadmin: false,
  isSuperadminWorkspace: false,
  executionMode: "systemd",
  mode: "default",
})

const adminContext = createStreamToolContext({
  isAdmin: true,
  isSuperadmin: false,
  isSuperadminWorkspace: false,
  executionMode: "systemd",
  mode: "default",
})

const superadminContext = createStreamToolContext({
  isAdmin: true,
  isSuperadmin: true,
  isSuperadminWorkspace: false,
  executionMode: "systemd",
  mode: "default",
})

export const ALLOWED_SDK_TOOLS = STREAM_SDK_TOOL_NAMES.filter(
  tool => getStreamToolDecision(tool, memberContext).executable || isUserApprovalTool(tool),
)
export const DISALLOWED_SDK_TOOLS = STREAM_SDK_TOOL_NAMES.filter(
  tool => !getStreamToolDecision(tool, memberContext).executable && !isUserApprovalTool(tool),
)

export const ADMIN_ONLY_SDK_TOOLS = STREAM_SDK_TOOL_NAMES.filter(
  tool =>
    getStreamToolDecision(tool, adminContext).executable && !getStreamToolDecision(tool, memberContext).executable,
)

export const ALWAYS_DISALLOWED_SDK_TOOLS = STREAM_SDK_TOOL_NAMES.filter(
  tool =>
    !getStreamToolDecision(tool, memberContext).executable &&
    !getStreamToolDecision(tool, adminContext).executable &&
    !getStreamToolDecision(tool, superadminContext).executable,
)

export type AllowedSDKTool = (typeof ALLOWED_SDK_TOOLS)[number]
export type DisallowedSDKTool = (typeof DISALLOWED_SDK_TOOLS)[number]

/**
 * Maps SDK Input types to their tool names.
 * Uses SDK_TOOL constants — if a constant is renamed/removed, this breaks at compile time.
 */
type SDKToolMap = {
  AgentInput: typeof SDK_TOOL.TASK
  BashInput: typeof SDK_TOOL.BASH
  TaskOutputInput: typeof SDK_TOOL.TASK_OUTPUT
  ExitPlanModeInput: typeof SDK_TOOL.EXIT_PLAN_MODE
  FileEditInput: typeof SDK_TOOL.EDIT
  FileReadInput: typeof SDK_TOOL.READ
  FileWriteInput: typeof SDK_TOOL.WRITE
  GlobInput: typeof SDK_TOOL.GLOB
  GrepInput: typeof SDK_TOOL.GREP
  TaskStopInput: typeof SDK_TOOL.TASK_STOP
  ListMcpResourcesInput: typeof SDK_TOOL.LIST_MCP_RESOURCES
  McpInput: typeof SDK_TOOL.MCP
  NotebookEditInput: typeof SDK_TOOL.NOTEBOOK_EDIT
  ReadMcpResourceInput: typeof SDK_TOOL.READ_MCP_RESOURCE
  TodoWriteInput: typeof SDK_TOOL.TODO_WRITE
  WebFetchInput: typeof SDK_TOOL.WEB_FETCH
  WebSearchInput: typeof SDK_TOOL.WEB_SEARCH
  AskUserQuestionInput: typeof SDK_TOOL.ASK_USER_QUESTION
}

/**
 * Type-level validation using imported SDK input types.
 * If SDK removes a tool type, the import/check fails at compile time.
 */
type _ValidateAgentInput = AgentInput extends ToolInputSchemas ? true : never
type _ValidateBashInput = BashInput extends ToolInputSchemas ? true : never
type _ValidateExitPlanModeInput = ExitPlanModeInput extends ToolInputSchemas ? true : never
type _ValidateFileEditInput = FileEditInput extends ToolInputSchemas ? true : never
type _ValidateFileReadInput = FileReadInput extends ToolInputSchemas ? true : never
type _ValidateFileWriteInput = FileWriteInput extends ToolInputSchemas ? true : never
type _ValidateGlobInput = GlobInput extends ToolInputSchemas ? true : never
type _ValidateGrepInput = GrepInput extends ToolInputSchemas ? true : never
type _ValidateTaskStopInput = TaskStopInput extends ToolInputSchemas ? true : never
type _ValidateListMcpResourcesInput = ListMcpResourcesInput extends ToolInputSchemas ? true : never
type _ValidateMcpInput = McpInput extends ToolInputSchemas ? true : never
type _ValidateNotebookEditInput = NotebookEditInput extends ToolInputSchemas ? true : never
type _ValidateReadMcpResourceInput = ReadMcpResourceInput extends ToolInputSchemas ? true : never
type _ValidateTodoWriteInput = TodoWriteInput extends ToolInputSchemas ? true : never
type _ValidateWebFetchInput = WebFetchInput extends ToolInputSchemas ? true : never
type _ValidateWebSearchInput = WebSearchInput extends ToolInputSchemas ? true : never
type _ValidateAskUserQuestionInput = AskUserQuestionInput extends ToolInputSchemas ? true : never

const _assertAllTypesExist: true = true as
  | _ValidateAgentInput
  | _ValidateBashInput
  | _ValidateExitPlanModeInput
  | _ValidateFileEditInput
  | _ValidateFileReadInput
  | _ValidateFileWriteInput
  | _ValidateGlobInput
  | _ValidateGrepInput
  | _ValidateTaskStopInput
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
 */
export const SDK_TOOL_NAMES = [
  SDK_TOOL.TASK,
  SDK_TOOL.BASH,
  SDK_TOOL.TASK_OUTPUT,
  SDK_TOOL.EXIT_PLAN_MODE,
  SDK_TOOL.EDIT,
  SDK_TOOL.READ,
  SDK_TOOL.WRITE,
  SDK_TOOL.GLOB,
  SDK_TOOL.GREP,
  SDK_TOOL.TASK_STOP,
  SDK_TOOL.LIST_MCP_RESOURCES,
  SDK_TOOL.MCP,
  SDK_TOOL.NOTEBOOK_EDIT,
  SDK_TOOL.READ_MCP_RESOURCE,
  SDK_TOOL.TODO_WRITE,
  SDK_TOOL.WEB_FETCH,
  SDK_TOOL.WEB_SEARCH,
  SDK_TOOL.ASK_USER_QUESTION,
] as const satisfies readonly SDKToolName[]

/**
 * Compile-time checks for shared registry <-> SDK alignment.
 */
type _StreamOnlyTools = "Skill" | "BashOutput"
type _MissingInShared = Exclude<SDKToolName, StreamSdkToolName>
const _assertSharedCoversAllSdkTools: _MissingInShared extends never ? true : never = true

type _UnexpectedInShared = Exclude<StreamSdkToolName, SDKToolName | _StreamOnlyTools>
const _assertNoUnexpectedSharedSdkTools: _UnexpectedInShared extends never ? true : never = true
