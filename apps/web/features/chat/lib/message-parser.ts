import { syncSdkMessageToolMetadata, type ToolMetadataStore } from "@webalive/shared/sdk-message-tool-metadata"
import type { Attachment } from "@/features/chat/components/ChatInput/types"
import {
  type BridgeCompleteMessage,
  type BridgeErrorMessage,
  type BridgeInterruptSource,
  type BridgeMessageEvent,
  type BridgeStartMessage,
  BridgeStreamType,
  type InterruptDetails,
  type InterruptStatus,
} from "@/features/chat/lib/streaming/ndjson"
import type { SDKAssistantMessage, SDKMessage } from "@/features/chat/types/sdk-types"
import {
  isErrorResultMessage,
  isSDKAssistantMessage,
  isSDKResultMessage,
  isSDKStatusMessage,
  isSDKSystemMessage,
  isSDKTaskNotification,
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
  status?: InterruptStatus
  details?: InterruptDetails
}

const INTERRUPT_SOURCES = new Set<BridgeInterruptSource>(["stream_http_abort", "stream_client_cancel"])

function isInterruptLikeContent(value: unknown): value is InterruptEventData {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  if (typeof record.message !== "string") return false
  if (typeof record.source !== "string") return false
  return INTERRUPT_SOURCES.has(record.source as BridgeInterruptSource)
}

export interface StreamEvent {
  type: BridgeStreamType
  requestId: string
  messageId?: string
  streamSeq?: number
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

// Agent Manager message status types
export type AgentManagerStatus = "stop" | "done" | "suggestion"

// Agent Manager message content
export interface AgentManagerContent {
  status: AgentManagerStatus
  message: string
}

// Tool progress message content (from SDK)
// parent_tool_use_id: null = main agent, "toolu_..." = subagent (see sdk-types.ts)
export interface ToolProgressContent {
  type: "tool_progress"
  tool_use_id: string
  tool_name: string
  parent_tool_use_id: string | null
  elapsed_time_seconds: number
  uuid: string
  session_id: string
}

// Auth status message content (from SDK)
export interface AuthStatusContent {
  type: "auth_status"
  isAuthenticating: boolean
  output: string[]
  error?: string
  uuid: string
  session_id: string
}

// Message types for UI
export type UIMessage = {
  id: string
  type:
    | "user"
    | "start"
    | "sdk_message"
    | "result"
    | "complete"
    | "compact_boundary"
    | "compacting"
    | "tool_progress"
    | "auth_status"
    | "task_notification"
    | "interrupt"
    | "agent_manager"
  content: unknown
  timestamp: Date
  isStreaming?: boolean
  /** Structured attachments for user messages (images, PDFs, supertemplates) */
  attachments?: Attachment[]
}

/**
 * User-facing fallback message for SDK billing errors.
 * This avoids surfacing the misleading raw SDK text ("Credit balance is too low"),
 * which refers to backend Anthropic billing rather than platform credits.
 */
const SDK_BILLING_ERROR_MESSAGE =
  "The AI service is temporarily unavailable due to a backend billing issue. Your platform credits are not affected. Please try again later or contact support."

type AssistantErrorResultMessage = {
  type: "result"
  is_error: true
  result: string
  error_code: "API_BILLING_ERROR"
}

/**
 * Map known SDK assistant errors to app-standard result errors.
 */
export function getAssistantErrorResultMessage(
  assistantMessage: SDKAssistantMessage,
): AssistantErrorResultMessage | null {
  if (assistantMessage.error !== "billing_error") {
    return null
  }

  return {
    type: "result",
    is_error: true,
    result: `${SDK_BILLING_ERROR_MESSAGE}\n\n_Error Type: billing_error_`,
    error_code: "API_BILLING_ERROR",
  }
}

function createStreamingToolMetadataStore(
  tabId: string,
  streamingActions: StreamingStoreState["actions"],
): ToolMetadataStore {
  return {
    getToolUse: (toolUseId: string) => {
      const toolName = streamingActions.getToolName(tabId, toolUseId)
      if (!toolName) return undefined

      return {
        toolUseId,
        toolName,
        toolInput: streamingActions.getToolInput(tabId, toolUseId),
      }
    },
    setToolUse: entry => {
      streamingActions.recordToolUse(tabId, entry.toolUseId, entry.toolName, entry.toolInput)
    },
  }
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

    // Check for system message with compact_boundary or status subtype
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
      // Handle status messages (e.g., compacting in progress)
      if (systemMsg.subtype === "status" && systemMsg.status === "compacting") {
        return {
          id: `${event.requestId}-compacting-${systemMsg.uuid}`,
          type: "compacting",
          content: content,
          ...baseMessage,
        }
      }
      // Ignore other status messages (e.g., status: null for session updates)
      if (systemMsg.subtype === "status") {
        return null
      }
      // Handle task_notification (subagent completed/failed/stopped)
      // Has: task_id, status, output_file (full transcript), summary, uuid, session_id
      if (systemMsg.subtype === "task_notification") {
        return {
          id: `${event.requestId}-task-${systemMsg.task_id}-${systemMsg.uuid}`,
          type: "task_notification",
          content: content,
          ...baseMessage,
        }
      }
    }

    // Handle tool_progress messages (elapsed time for long-running tools)
    if (content.type === "tool_progress") {
      const progressMsg = content as ToolProgressContent
      // Update the pending tool's elapsed time
      if (conversationId && streamingActions) {
        streamingActions.updateToolProgress(conversationId, progressMsg.tool_use_id, progressMsg.elapsed_time_seconds)
      }
      return {
        id: `${event.requestId}-progress-${progressMsg.tool_use_id}-${progressMsg.elapsed_time_seconds}`,
        type: "tool_progress",
        content: progressMsg,
        ...baseMessage,
      }
    }

    // Handle auth_status messages (OAuth authentication progress)
    if (content.type === "auth_status") {
      const authMsg = content as AuthStatusContent
      return {
        id: `${event.requestId}-auth-${authMsg.uuid}`,
        type: "auth_status",
        content: authMsg,
        ...baseMessage,
      }
    }

    // Map known assistant SDK errors to app-standard result errors
    if (isSDKAssistantMessage(content)) {
      const errorResult = getAssistantErrorResultMessage(content)
      if (errorResult) {
        return {
          id: `${event.requestId}-${event.data.messageCount}`,
          type: "sdk_message",
          content: errorResult,
          ...baseMessage,
        }
      }
    }

    if (conversationId && streamingActions && (isSDKAssistantMessage(content) || isSDKUserMessage(content))) {
      const syncResult = syncSdkMessageToolMetadata(
        content,
        createStreamingToolMetadataStore(conversationId, streamingActions),
      )

      for (const toolUse of syncResult.toolUses) {
        streamingActions.markToolPending(conversationId, toolUse.toolUseId, toolUse.toolName, toolUse.toolInput)
      }

      for (const toolResult of syncResult.toolResults) {
        streamingActions.markToolComplete(conversationId, toolResult.toolUseId)
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

    let fullMessage = userMessage
    if (helpText) {
      fullMessage += `\n\n${helpText}`
    }
    // Show error ID for log correlation (not full details - those stay in backend logs)
    fullMessage += `\n\n_Error ID: ${event.requestId}_`

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

/**
 * Component types for message routing
 */
export const COMPONENT_TYPE = {
  USER: "user",
  START: "start",
  COMPLETE: "complete",
  COMPACT_BOUNDARY: "compact_boundary",
  COMPACTING: "compacting",
  TOOL_PROGRESS: "tool_progress",
  AUTH_STATUS: "auth_status",
  TASK_NOTIFICATION: "task_notification",
  INTERRUPT: "interrupt",
  SYSTEM: "system",
  ASSISTANT: "assistant",
  TOOL_RESULT: "tool_result",
  RESULT: "result",
  AGENT_MANAGER: "agent_manager",
  UNKNOWN: "unknown",
} as const

export type ComponentType = (typeof COMPONENT_TYPE)[keyof typeof COMPONENT_TYPE]

// Get message component type for routing
export function getMessageComponentType(message: UIMessage): ComponentType {
  if (message.type === "user") return COMPONENT_TYPE.USER
  if (message.type === "start") return COMPONENT_TYPE.START
  if (message.type === "complete") return COMPONENT_TYPE.COMPLETE
  if (message.type === "compact_boundary") return COMPONENT_TYPE.COMPACT_BOUNDARY
  if (message.type === "compacting") return COMPONENT_TYPE.COMPACTING
  if (message.type === "tool_progress") return COMPONENT_TYPE.TOOL_PROGRESS
  if (message.type === "auth_status") return COMPONENT_TYPE.AUTH_STATUS
  if (message.type === "task_notification") return COMPONENT_TYPE.TASK_NOTIFICATION
  if (message.type === "interrupt") return COMPONENT_TYPE.INTERRUPT
  if (message.type === "agent_manager") return COMPONENT_TYPE.AGENT_MANAGER

  if (message.type === "sdk_message") {
    // Backward compatibility for older persisted stop/interrupt payloads
    // stored as plain sdk_message content in Dexie.
    if (isInterruptLikeContent(message.content)) {
      return COMPONENT_TYPE.INTERRUPT
    }

    const sdkMsg = message.content as SDKMessage

    // Detect compacting messages reloaded from Dexie (stored as sdk_message)
    if (isSDKStatusMessage(sdkMsg) && sdkMsg.status === "compacting") {
      return COMPONENT_TYPE.COMPACTING
    }

    // Detect task_notification messages reloaded from Dexie (stored as sdk_message)
    if (isSDKTaskNotification(sdkMsg)) {
      return COMPONENT_TYPE.TASK_NOTIFICATION
    }

    if (isSDKSystemMessage(sdkMsg)) return COMPONENT_TYPE.SYSTEM
    if (isSDKAssistantMessage(sdkMsg)) return COMPONENT_TYPE.ASSISTANT
    if (isSDKUserMessage(sdkMsg)) return COMPONENT_TYPE.TOOL_RESULT
    if (isSDKResultMessage(sdkMsg)) return COMPONENT_TYPE.RESULT
  }

  if (message.type === "result") return COMPONENT_TYPE.RESULT

  return COMPONENT_TYPE.UNKNOWN
}
