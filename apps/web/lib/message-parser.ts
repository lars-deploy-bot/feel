import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKUserMessage,
} from "@/lib/sdk-types"
import { isSDKAssistantMessage, isSDKResultMessage, isSDKSystemMessage, isSDKUserMessage } from "@/lib/sdk-types"
import { isStartEvent, isSessionEvent, isMessageEvent, isResultEvent, isCompleteEvent } from "@/types/guards/stream"

// Stream event types
export interface StreamEvent {
  type: "start" | "message" | "session" | "result" | "complete" | "error"
  requestId: string
  timestamp: string
  data:
    | StartEventData
    | MessageEventData
    | SessionEventData
    | CompleteEventData
    | { error: string; message: string; details?: string }
}

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
  type: "user" | "start" | "session" | "sdk_message" | "result" | "complete"
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
      id: event.requestId + "-start",
      type: "start",
      content: event.data,
      ...baseMessage,
    }
  }

  if (isSessionEvent(event)) {
    return {
      id: event.requestId + "-session",
      type: "session",
      content: event.data,
      ...baseMessage,
    }
  }

  if (isMessageEvent(event)) {
    const content = event.data.content

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
      id: event.requestId + "-" + event.data.messageCount,
      type: "sdk_message",
      content: content,
      ...baseMessage,
    }
  }

  if (isResultEvent(event)) {
    return {
      id: event.requestId + "-result",
      type: "result",
      content: event.data,
      ...baseMessage,
    }
  }

  if (event.type === "complete") {
    return {
      id: event.requestId + "-complete",
      type: "complete",
      content: event.data,
      ...baseMessage,
    }
  }

  return null
}

// Re-export the type guard functions for use in other modules
export { isSDKSystemMessage, isSDKAssistantMessage, isSDKUserMessage, isSDKResultMessage }
export { isStartEvent, isSessionEvent, isMessageEvent, isResultEvent, isCompleteEvent }

// Get message component type for routing
export function getMessageComponentType(message: UIMessage): string {
  if (message.type === "user") return "user"
  if (message.type === "start") return "start"
  if (message.type === "session") return "session"
  if (message.type === "complete") return "complete"

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
