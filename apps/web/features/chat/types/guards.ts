/**
 * Type guards for Bridge streaming messages
 */

import type { BridgeMessageEvent } from "@/features/chat/lib/streaming/ndjson"
import { BridgeStreamType } from "@/features/chat/lib/streaming/ndjson"
import type { LLMTokenUsage } from "@/lib/tokens"

/**
 * Type guard for BridgeMessageEvent
 */
export function isBridgeMessageEvent(event: unknown): event is BridgeMessageEvent {
  if (typeof event !== "object" || event === null) return false
  const e = event as any
  return (
    e.type === BridgeStreamType.MESSAGE &&
    typeof e.data === "object" &&
    e.data !== null &&
    typeof e.data.messageCount === "number" &&
    typeof e.data.messageType === "string" &&
    "content" in e.data
  )
}

/**
 * Structure of assistant message content with usage
 */
export interface AssistantMessageContent {
  message: {
    usage: LLMTokenUsage
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Type guard for assistant message with usage data
 */
export function isAssistantMessageWithUsage(
  event: BridgeMessageEvent
): event is BridgeMessageEvent & { data: { content: AssistantMessageContent } } {
  if (event.data.messageType !== "assistant") return false

  const content = event.data.content as any
  if (typeof content !== "object" || content === null) return false
  if (typeof content.message !== "object" || content.message === null) return false
  if (typeof content.message.usage !== "object" || content.message.usage === null) return false

  const usage = content.message.usage
  return (
    typeof usage.input_tokens === "number" &&
    typeof usage.output_tokens === "number"
  )
}
