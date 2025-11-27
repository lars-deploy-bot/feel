/**
 * Message Classifier
 *
 * Categorizes SDK messages for display purposes.
 * Used by ThinkingGroup to separate tool results from thinking content.
 */

import type { SDKResultMessage } from "@/features/chat/types/sdk-types"
import type { UIMessage } from "./message-parser"
import { COMPONENT_TYPE, getMessageComponentType } from "./message-parser"

/**
 * Message display categories
 */
export const MESSAGE_CATEGORY = {
  /** Renders directly with own expand/collapse */
  TOOL_RESULT: "tool_result",
  /** Goes in "thought" wrapper (may be debug-only) */
  THINKING: "thinking",
  /** Never shown */
  HIDDEN: "hidden",
} as const

export type MessageCategory = (typeof MESSAGE_CATEGORY)[keyof typeof MESSAGE_CATEGORY]

/**
 * Classify a message for display
 *
 * Categories:
 * - tool_result: Renders directly with own expand/collapse
 * - thinking: Goes in "thought" wrapper (may be debug-only)
 * - hidden: Never shown (e.g., complete messages)
 */
export function classifyMessage(message: UIMessage, isDebugMode: boolean): MessageCategory {
  const componentType = getMessageComponentType(message)

  // Tool results render directly (not in thought wrapper)
  if (componentType === COMPONENT_TYPE.TOOL_RESULT) {
    return MESSAGE_CATEGORY.TOOL_RESULT
  }

  // Complete messages never show
  if (componentType === COMPONENT_TYPE.COMPLETE) {
    return MESSAGE_CATEGORY.HIDDEN
  }

  // Result messages (SDK internal) - debug only unless error
  if (componentType === COMPONENT_TYPE.RESULT) {
    const content = message.content as SDKResultMessage
    if (content.is_error) {
      return MESSAGE_CATEGORY.TOOL_RESULT // Errors render directly, not hidden in accordion
    }
    return isDebugMode ? MESSAGE_CATEGORY.THINKING : MESSAGE_CATEGORY.HIDDEN
  }

  // Assistant messages (tool_use blocks) - debug only
  if (componentType === COMPONENT_TYPE.ASSISTANT) {
    return isDebugMode ? MESSAGE_CATEGORY.THINKING : MESSAGE_CATEGORY.HIDDEN
  }

  // System messages - debug only (SystemMessage component returns null in non-debug anyway)
  if (componentType === COMPONENT_TYPE.SYSTEM) {
    return isDebugMode ? MESSAGE_CATEGORY.THINKING : MESSAGE_CATEGORY.HIDDEN
  }

  // Everything else goes to thinking wrapper
  return MESSAGE_CATEGORY.THINKING
}

/**
 * Filter messages by category
 */
export function filterByCategory(messages: UIMessage[], category: MessageCategory, isDebugMode: boolean): UIMessage[] {
  return messages.filter(m => classifyMessage(m, isDebugMode) === category)
}

/**
 * Get tool results from messages (render directly)
 */
export function getToolResults(messages: UIMessage[]): UIMessage[] {
  return messages.filter(m => getMessageComponentType(m) === COMPONENT_TYPE.TOOL_RESULT)
}

/**
 * Get thinking content from messages (for thought wrapper)
 */
export function getThinkingContent(messages: UIMessage[], isDebugMode: boolean): UIMessage[] {
  return filterByCategory(messages, MESSAGE_CATEGORY.THINKING, isDebugMode)
}

/**
 * Check if any messages will be visible
 */
export function hasVisibleMessages(messages: UIMessage[], isDebugMode: boolean): boolean {
  return messages.some(m => classifyMessage(m, isDebugMode) !== MESSAGE_CATEGORY.HIDDEN)
}
