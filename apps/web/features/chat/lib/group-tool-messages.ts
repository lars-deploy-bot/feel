/**
 * Group consecutive exploration tool results into collapsible sections.
 *
 * When Claude explores a codebase (Read, Glob, Grep), the chat fills with
 * dozens of individual tool result rows. This utility groups consecutive
 * exploration tool results so the renderer can collapse them into a single
 * "Explored N files" line.
 *
 * If a Task tool result immediately follows the group (e.g. "completed"),
 * it is absorbed into the group as a trailing status indicator.
 */

import { SDK_TOOL } from "@webalive/shared"
import type { SDKUserMessage } from "@/features/chat/types/sdk-types"
import { COMPONENT_TYPE, getMessageComponentType, type UIMessage } from "./message-parser"

/** Minimal shape of a tool_result content block with our augmented tool_name */
interface ToolResultBlock {
  type: "tool_result"
  tool_use_id: string
  tool_name?: string
  content?: string
}

function isToolResultBlock(item: unknown): item is ToolResultBlock {
  return typeof item === "object" && item !== null && (item as ToolResultBlock).type === "tool_result"
}

/** Tools considered "exploration" — read-only codebase analysis */
const EXPLORATION_TOOLS: Set<string> = new Set([SDK_TOOL.READ, SDK_TOOL.GLOB, SDK_TOOL.GREP])

/** Minimum consecutive exploration tool results to form a group */
const MIN_GROUP_SIZE = 3

export type RenderItem =
  | { type: "single"; message: UIMessage; index: number }
  | {
      type: "group"
      messages: UIMessage[]
      startIndex: number
      trailingTaskResult: UIMessage | null
      /** Subagent assistant text absorbed between group and Task result (e.g. "I've read all 17 files...") */
      subagentSummary: UIMessage | null
    }

/**
 * Extract tool names from a TOOL_RESULT UIMessage.
 * Returns empty array if not a tool result message.
 */
export function getToolNames(message: UIMessage): string[] {
  const componentType = getMessageComponentType(message)
  if (componentType !== COMPONENT_TYPE.TOOL_RESULT) return []

  const content = message.content as SDKUserMessage
  if (!content?.message?.content || !Array.isArray(content.message.content)) return []

  const names: string[] = []
  for (const item of content.message.content) {
    if (isToolResultBlock(item) && item.tool_name) {
      names.push(item.tool_name)
    }
  }
  return names
}

/**
 * Check if a message is an exploration-only tool result
 * (all tool results in the message are Read/Glob/Grep).
 */
function isExplorationToolResult(message: UIMessage): boolean {
  const toolNames = getToolNames(message)
  if (toolNames.length === 0) return false
  return toolNames.every(name => EXPLORATION_TOOLS.has(name))
}

/**
 * Check if a message is a Task tool result (subagent completion).
 */
function isTaskToolResult(message: UIMessage): boolean {
  const toolNames = getToolNames(message)
  return toolNames.length === 1 && toolNames[0] === SDK_TOOL.TASK
}

/**
 * Check if a message is a subagent assistant message with text content.
 * These appear when a Task subagent finishes — it emits a final text summary
 * before the Task tool_result is sent back to the main agent.
 */
function isSubagentAssistantText(message: UIMessage): boolean {
  if (getMessageComponentType(message) !== COMPONENT_TYPE.ASSISTANT) return false
  const content = message.content as Record<string, unknown>
  if (!content.parent_tool_use_id) return false
  const msg = content.message as Record<string, unknown> | undefined
  const items = msg?.content as Array<Record<string, unknown>> | undefined
  if (!items) return false
  return items.some(
    item => item.type === "text" && typeof item.text === "string" && (item.text as string).trim().length > 0,
  )
}

/**
 * Group consecutive exploration tool result messages into collapsible sections.
 * Non-exploration messages pass through as singles.
 *
 * After forming a group, looks ahead past subagent assistant text messages
 * (which the subagent emits as its final summary) to find the Task tool_result.
 * Both are absorbed into the group:
 *   - subagentSummary: the assistant text ("I've read all 17 files...")
 *   - trailingTaskResult: the Task tool_result ("completed")
 */
export function groupToolMessages(messages: UIMessage[]): RenderItem[] {
  const items: RenderItem[] = []
  let i = 0

  while (i < messages.length) {
    if (isExplorationToolResult(messages[i])) {
      const groupStart = i
      const groupMessages: UIMessage[] = []

      while (i < messages.length && isExplorationToolResult(messages[i])) {
        groupMessages.push(messages[i])
        i++
      }

      if (groupMessages.length >= MIN_GROUP_SIZE) {
        let subagentSummary: UIMessage | null = null
        let trailingTaskResult: UIMessage | null = null

        // Look ahead: skip subagent assistant text to find Task result
        // Pattern: [exploration group] → [subagent text?] → [Task result?]
        if (i < messages.length && isSubagentAssistantText(messages[i])) {
          subagentSummary = messages[i]
          i++
        }
        if (i < messages.length && isTaskToolResult(messages[i])) {
          trailingTaskResult = messages[i]
          i++
        }

        items.push({
          type: "group",
          messages: groupMessages,
          startIndex: groupStart,
          trailingTaskResult,
          subagentSummary,
        })
      } else {
        // Not enough to group — emit as singles
        groupMessages.forEach((msg, offset) => {
          items.push({ type: "single", message: msg, index: groupStart + offset })
        })
      }
    } else {
      items.push({ type: "single", message: messages[i], index: i })
      i++
    }
  }

  return items
}

/**
 * Build a summary for a group of exploration tool messages.
 * Returns total count and per-tool breakdown.
 */
export function getGroupSummary(messages: UIMessage[]): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {}
  let total = 0

  for (const message of messages) {
    for (const name of getToolNames(message)) {
      breakdown[name] = (breakdown[name] || 0) + 1
      total++
    }
  }

  return { total, breakdown }
}
