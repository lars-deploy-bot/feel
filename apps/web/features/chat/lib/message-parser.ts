import {
  type BridgeCompleteMessage,
  type BridgeErrorMessage,
  type BridgeInterruptSource,
  type BridgeMessageEvent,
  type BridgeStartMessage,
  BridgeStreamType,
} from "@/features/chat/lib/streaming/ndjson"
import type { SDKMessage } from "@/features/chat/types/sdk-types"
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

  if (isMessageEvent(event)) {
    const content = event.data.content as SDKMessage

    if (content.type === "system" && (content as any).subtype === "compact_boundary") {
      console.log(
        `[MessageParser] Context compaction triggered at ${(content as any).compact_metadata?.pre_tokens || "unknown"} tokens`,
      )
      return {
        id: `${event.requestId}-compact-${(content as any).uuid}`,
        type: "compact_boundary",
        content: content,
        ...baseMessage,
      }
    }

    if (
      content.type === "assistant" &&
      (content as any).message?.content &&
      Array.isArray((content as any).message.content)
    ) {
      ;(content as any).message.content.forEach((item: any) => {
        if (item.type === "tool_use" && item.id && item.name) {
          toolUseMap.set(item.id, item.name)
        }
      })
    }

    if (
      content.type === "user" &&
      (content as any).message?.content &&
      Array.isArray((content as any).message.content)
    ) {
      ;(content as any).message.content.forEach((item: any) => {
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

  if (event.type === BridgeStreamType.COMPLETE) {
    return {
      id: `${event.requestId}-complete`,
      type: "complete",
      content: event.data,
      ...baseMessage,
    }
  }

  if (event.type === BridgeStreamType.ERROR) {
    const errorData = event.data as ErrorEventData
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

  if (event.type === BridgeStreamType.SESSION) {
    // Session events are server-side only and should never reach the client
    // They're intercepted in route.ts for session storage
    console.warn("[MessageParser] SESSION event reached client - this should not happen")
    return null
  }

  if (event.type === BridgeStreamType.PING) {
    return null
  }

  if (event.type === BridgeStreamType.DONE) {
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
