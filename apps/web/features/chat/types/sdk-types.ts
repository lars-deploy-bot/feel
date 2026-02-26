import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKTaskNotificationMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk"

/**
 * Re-export SDK message types for use across the app.
 *
 * Key field on all message types: `parent_tool_use_id: string | null`
 * - `null` → message from the main agent
 * - `"toolu_..."` → message from a subagent spawned by that Task tool_use
 *
 * Only the **Task** tool spawns subagents. AgentDefinition in the SDK:
 *   "Definition for a custom subagent that can be invoked via the Task tool."
 * So parent_tool_use_id is always the id of a Task tool_use block.
 *
 * This field is NOT optional — always present on:
 *   SDKAssistantMessage, SDKUserMessage, SDKPartialAssistantMessage, tool_progress
 *
 * SDK source: node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts
 *   grep "parent_tool_use_id" → ~1197, 1481, 1674, 1691, 1701
 *   grep "AgentDefinition" → ~31 (doc comment), ~494 (agents config)
 */
export type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKTaskNotificationMessage,
  SDKUserMessage,
}

// Re-export guards and helpers from new location
export {
  extractSessionId,
  getMessageStreamData,
  isErrorResultMessage,
  isSDKAssistantMessage,
  isSDKResultMessage,
  isSDKSystemMessage,
  isSDKUserMessage,
} from "@/features/chat/types/sdk"
