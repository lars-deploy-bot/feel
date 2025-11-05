import type { SDKMessage, SDKResultMessage } from "@/features/chat/types/sdk-types"
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
  isMessageEvent,
  isPingEvent,
  isResultEvent,
  isSessionEvent,
  isStartEvent,
} from "@/features/chat/types/stream"

// Stream event types
export interface StreamEvent {
  type: "start" | "message" | "session" | "result" | "complete" | "error" | "ping" | "done"
  requestId: string
  timestamp: string
  data:
    | StartEventData
    | MessageEventData
    | SessionEventData
    | CompleteEventData
    | ErrorEventData
    | PingEventData
    | DoneEventData
}

export interface ErrorEventData {
  error: string
  message: string
  details?: string
  code?: "aborted" | "query_failed" | "timeout"
}

export type PingEventData = Record<string, never>

export type DoneEventData = Record<string, never>

export interface StartEventData {
  host: string
  cwd: string
  message: string
  messageLength: number
  isResume?: boolean
}

export interface SessionEventData {
  sessionId: string
}

export interface MessageEventData {
  messageCount: number
  messageType: string
  content: SDKMessage
}

export interface CompleteEventData {
  totalMessages: number
  result: SDKResultMessage | null
}

// Message types for UI
export type UIMessage = {
  id: string
  type: "user" | "start" | "session" | "sdk_message" | "result" | "complete" | "compact_boundary"
  content: any
  timestamp: Date
  isStreaming?: boolean
}

// Global store for tool_use_id to tool name mapping
const toolUseMap = new Map<string, string>()

// Parse stream event into UI message
export function parseStreamEvent(event: StreamEvent): UIMessage | null {
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

  if (isSessionEvent(event)) {
    // Session events are internal - don't create UI messages for them
    return null
  }

  if (isMessageEvent(event)) {
    const content = event.data.content

    // Handle system messages with special subtypes (e.g., compact_boundary)
    // See: apps/web/features/chat/lib/unknown-message-types.json for documentation
    if (content.type === "system" && content.subtype === "compact_boundary") {
      // This is an internal SDK message about context compaction - show visual indicator
      console.log(`[MessageParser] Context compaction triggered at ${content.compact_metadata?.pre_tokens || 'unknown'} tokens`)
      return {
        id: `${event.requestId}-compact-${content.uuid}`,
        type: "compact_boundary",
        content: content,
        ...baseMessage,
      }
    }

    // If this is an assistant message with tool_use, store the mapping
    if (content.type === "assistant" && content.message?.content && Array.isArray(content.message.content)) {
      content.message.content.forEach((item: any) => {
        if (item.type === "tool_use" && item.id && item.name) {
          toolUseMap.set(item.id, item.name)
        }
      })
    }

    // If this is a user message with tool_result, attach tool names
    if (content.type === "user" && content.message?.content && Array.isArray(content.message.content)) {
      content.message.content.forEach((item: any) => {
        if (item.type === "tool_result" && item.tool_use_id) {
          item.tool_name = toolUseMap.get(item.tool_use_id) || "Tool"
        }
      })
    }

    return {
      id: `${event.requestId}-${event.data.messageCount}`,
      type: "sdk_message",
      content: content,
      ...baseMessage,
    }
  }

  if (isResultEvent(event)) {
    return {
      id: `${event.requestId}-result`,
      type: "result",
      content: event.data,
      ...baseMessage,
    }
  }

  if (event.type === "complete") {
    return {
      id: `${event.requestId}-complete`,
      type: "complete",
      content: event.data,
      ...baseMessage,
    }
  }

  if (event.type === "error") {
    const errorData = event.data as ErrorEventData
    return {
      id: `${event.requestId}-error`,
      type: "sdk_message",
      content: {
        type: "result",
        is_error: true,
        result: `${errorData.message}: ${errorData.details || errorData.error}`,
        error_code: errorData.code,
      },
      ...baseMessage,
    }
  }

  if (event.type === "ping") {
    // Don't create UI messages for ping events - they're just keepalive
    return null
  }

  if (event.type === "done") {
    // Optional: create a subtle completion indicator
    return {
      id: `${event.requestId}-done`,
      type: "complete",
      content: { message: "Stream completed" },
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
  isMessageEvent,
  isPingEvent,
  isResultEvent,
  isSDKAssistantMessage,
  isSDKResultMessage,
  isSDKSystemMessage,
  isSDKUserMessage,
  isSessionEvent,
  isStartEvent,
}

// Get message component type for routing
export function getMessageComponentType(message: UIMessage): string {
  if (message.type === "user") return "user"
  if (message.type === "start") return "start"
  if (message.type === "session") return "session"
  if (message.type === "complete") return "complete"
  if (message.type === "compact_boundary") return "compact_boundary"

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
