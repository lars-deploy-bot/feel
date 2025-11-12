import {
  type BridgeCompleteMessage,
  type BridgeErrorMessage,
  type BridgeInterruptSource,
  type BridgeMessageEvent,
  type BridgeStartMessage,
  BridgeStreamType,
} from "@/features/chat/lib/streaming/ndjson"
import type { Attachment } from "@/features/chat/components/ChatInput/types"
import type { SDKAssistantMessage, SDKMessage, SDKUserMessage } from "@/features/chat/types/sdk-types"
import {
  isErrorResultMessage,
  isSDKAssistantMessage,
  isSDKResultMessage,
  isSDKSystemMessage,
  isSDKUserMessage,
} from "@/features/chat/types/sdk-types"
import {
  isCompleteEvent,
  isDoneEvent,
  isErrorEvent,
  isInterruptEvent,
  isMessageEvent,
  isPingEvent,
  isStartEvent,
} from "@/features/chat/types/stream"
import { getErrorHelp, getErrorMessage } from "@/lib/error-codes"
import type { StreamingStoreState } from "@/lib/stores/streamingStore"

export type StartEventData = BridgeStartMessage["data"]

export type MessageEventData = BridgeMessageEvent["data"]

export type CompleteEventData = BridgeCompleteMessage["data"]

export type ErrorEventData = BridgeErrorMessage["data"]

export type PingEventData = Record<string, never>

export type DoneEventData = Record<string, never>

export interface InterruptEventData {
  message: string
  source: BridgeInterruptSource
}

export interface StreamEvent {
  type: BridgeStreamType
  requestId: string
  timestamp: string
  data:
    | StartEventData
    | MessageEventData
    | CompleteEventData
    | ErrorEventData
    | PingEventData
    | DoneEventData
    | InterruptEventData
}

// Message types for UI
export type UIMessage = {
  id: string
  type: "user" | "start" | "sdk_message" | "result" | "complete" | "compact_boundary" | "interrupt"
  content: unknown
  timestamp: Date
  isStreaming?: boolean
  /** Structured attachments for user messages (images, PDFs, supertemplates) */
  attachments?: Attachment[]
}

// Parse stream event into UI message
// Now conversation-scoped to avoid tool mapping collisions across conversations
export function parseStreamEvent(
  event: StreamEvent,
  conversationId?: string,
  streamingActions?: StreamingStoreState["actions"],
): UIMessage | null {
  const baseMessage = {
    timestamp: new Date(event.timestamp),
  }

  if (isStartEvent(event)) {
    return {
      id: `${event.requestId}-start`,
      type: "start",
      content: event.data,
      ...baseMessage,
    }
  }

  if (isMessageEvent(event)) {
    const content = event.data.content as SDKMessage

    // Check for system message with compact_boundary subtype
    if (content.type === "system") {
      const systemMsg = content as any // SDK system messages may have subtype for context compaction
      if (systemMsg.subtype === "compact_boundary") {
        console.log(
          `[MessageParser] Context compaction triggered at ${systemMsg.compact_metadata?.pre_tokens || "unknown"} tokens`,
        )
        return {
          id: `${event.requestId}-compact-${systemMsg.uuid}`,
          type: "compact_boundary",
          content: content,
          ...baseMessage,
        }
      }
    }

    // Track tool uses per conversation (not globally)
    if (conversationId && streamingActions && isSDKAssistantMessage(content)) {
      const assistantMsg = content as SDKAssistantMessage
      if (assistantMsg.message?.content && Array.isArray(assistantMsg.message.content)) {
        assistantMsg.message.content.forEach(item => {
          if (item.type === "tool_use" && item.id && item.name) {
            streamingActions.recordToolUse(conversationId, item.id, item.name)
          }
        })
      }
    }

    // Lookup tool names from per-conversation store
    if (conversationId && streamingActions && isSDKUserMessage(content)) {
      const userMsg = content as SDKUserMessage
      if (userMsg.message?.content && Array.isArray(userMsg.message.content)) {
        userMsg.message.content.forEach(item => {
          if (item.type === "tool_result" && item.tool_use_id) {
            // Augment SDK ToolResultBlockParam with tool_name for UI rendering
            // SDK doesn't include tool_name in tool_result, so we add it client-side
            ;(item as any).tool_name = streamingActions.getToolName(conversationId, item.tool_use_id) || "Tool"
          }
        })
      }
    }

    return {
      id: `${event.requestId}-${event.data.messageCount}`,
      type: "sdk_message",
      content: content,
      ...baseMessage,
    }
  }

  if (isCompleteEvent(event)) {
    return {
      id: `${event.requestId}-complete`,
      type: "complete",
      content: event.data,
      ...baseMessage,
    }
  }

  if (isErrorEvent(event)) {
    const errorData = event.data
    const errorCode = errorData.code || errorData.error

    const details = typeof errorData.details === "object" ? errorData.details : undefined
    const userMessage = getErrorMessage(errorCode, details) || errorData.message
    const helpText = getErrorHelp(errorCode, details)

    let detailsText = ""
    if (errorData.details && typeof errorData.details === "object") {
      detailsText = JSON.stringify(errorData.details, null, 2)
    } else if (errorData.details) {
      detailsText = String(errorData.details)
    }

    let fullMessage = userMessage
    if (helpText) {
      fullMessage += `\n\n${helpText}`
    }
    if (detailsText && process.env.NODE_ENV === "development") {
      fullMessage += `\n\nDetails: ${detailsText}`
    }

    return {
      id: `${event.requestId}-error`,
      type: "sdk_message",
      content: {
        type: "result",
        is_error: true,
        result: fullMessage,
        error_code: errorCode,
      },
      ...baseMessage,
    }
  }

  // SESSION events are server-side only - never reach client
  // They're intercepted in route.ts for session storage
  if (event.type === BridgeStreamType.SESSION) {
    console.warn("[MessageParser] SESSION event reached client - this should not happen")
    return null
  }

  if (isPingEvent(event)) {
    return null
  }

  if (isDoneEvent(event)) {
    return {
      id: `${event.requestId}-done`,
      type: "complete",
      content: { message: "Stream completed" },
      ...baseMessage,
    }
  }

  if (isInterruptEvent(event)) {
    return {
      id: `${event.requestId}-interrupt`,
      type: "interrupt",
      content: event.data,
      ...baseMessage,
    }
  }

  return null
}

// Re-export the type guard functions for use in other modules
export {
  isCompleteEvent,
  isDoneEvent,
  isErrorEvent,
  isErrorResultMessage,
  isInterruptEvent,
  isMessageEvent,
  isPingEvent,
  isSDKAssistantMessage,
  isSDKResultMessage,
  isSDKSystemMessage,
  isSDKUserMessage,
  isStartEvent,
}

// Get message component type for routing
export function getMessageComponentType(message: UIMessage): string {
  if (message.type === "user") return "user"
  if (message.type === "start") return "start"
  if (message.type === "complete") return "complete"
  if (message.type === "compact_boundary") return "compact_boundary"
  if (message.type === "interrupt") return "interrupt"

  if (message.type === "sdk_message") {
    const sdkMsg = message.content as SDKMessage

    if (isSDKSystemMessage(sdkMsg)) return "system"
    if (isSDKAssistantMessage(sdkMsg)) return "assistant"
    if (isSDKUserMessage(sdkMsg)) return "tool_result"
    if (isSDKResultMessage(sdkMsg)) return "result"
  }

  if (message.type === "result") return "result"

  return "unknown"
}
