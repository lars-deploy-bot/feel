import { SDKMessage, SDKSystemMessage, SDKAssistantMessage, SDKUserMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'

// Type guards for SDK messages
export function isSDKSystemMessage(msg: SDKMessage): msg is SDKSystemMessage {
  return msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init'
}

export function isSDKAssistantMessage(msg: SDKMessage): msg is SDKAssistantMessage {
  return msg.type === 'assistant' && 'message' in msg
}

export function isSDKUserMessage(msg: SDKMessage): msg is SDKUserMessage {
  return msg.type === 'user' && 'message' in msg
}

export function isSDKResultMessage(msg: SDKMessage): msg is SDKResultMessage {
  return msg.type === 'result' && 'subtype' in msg
}

// Stream event types
export interface StreamEvent {
  type: 'start' | 'message' | 'result' | 'complete'
  requestId: string
  timestamp: string
  data: any
}

export interface StartEventData {
  host: string
  cwd: string
  message: string
  messageLength: number
}

export interface MessageEventData {
  messageCount: number
  messageType: 'system' | 'assistant' | 'user'
  content: SDKMessage
}

export interface CompleteEventData {
  totalMessages: number
  result: SDKResultMessage
}

// Type guards for stream events
export function isStartEvent(event: StreamEvent): event is StreamEvent & { data: StartEventData } {
  return event.type === 'start' && 'cwd' in event.data
}

export function isMessageEvent(event: StreamEvent): event is StreamEvent & { data: MessageEventData } {
  return event.type === 'message' && 'messageType' in event.data && 'content' in event.data
}

export function isResultEvent(event: StreamEvent): event is StreamEvent & { data: SDKResultMessage } {
  return event.type === 'result' && 'subtype' in event.data
}

export function isCompleteEvent(event: StreamEvent): event is StreamEvent & { data: CompleteEventData } {
  return event.type === 'complete' && 'totalMessages' in event.data
}

// Message types for UI
export type UIMessage = {
  id: string
  type: 'user' | 'start' | 'sdk_message' | 'result' | 'complete'
  content: any
  timestamp: Date
  isStreaming?: boolean
}

// Global store for tool_use_id to tool name mapping
const toolUseMap = new Map<string, string>()

// Parse stream event into UI message
export function parseStreamEvent(event: StreamEvent): UIMessage | null {
  const baseMessage = {
    timestamp: new Date(event.timestamp)
  }

  if (isStartEvent(event)) {
    return {
      id: event.requestId + '-start',
      type: 'start',
      content: event.data,
      ...baseMessage
    }
  }

  if (isMessageEvent(event)) {
    const content = event.data.content

    // If this is an assistant message with tool_use, store the mapping
    if (content.type === 'assistant' && content.message?.content) {
      content.message.content.forEach((item: any) => {
        if (item.type === 'tool_use' && item.id && item.name) {
          toolUseMap.set(item.id, item.name)
        }
      })
    }

    // If this is a user message with tool_result, attach tool names
    if (content.type === 'user' && content.message?.content) {
      content.message.content.forEach((item: any) => {
        if (item.type === 'tool_result' && item.tool_use_id) {
          item.tool_name = toolUseMap.get(item.tool_use_id) || 'Unknown Tool'
        }
      })
    }

    return {
      id: event.requestId + '-' + event.data.messageCount,
      type: 'sdk_message',
      content: content,
      ...baseMessage
    }
  }

  if (isResultEvent(event)) {
    return {
      id: event.requestId + '-result',
      type: 'result',
      content: event.data,
      ...baseMessage
    }
  }

  if (isCompleteEvent(event)) {
    return {
      id: event.requestId + '-complete',
      type: 'complete',
      content: event.data,
      ...baseMessage
    }
  }

  return null
}

// Get message component type for routing
export function getMessageComponentType(message: UIMessage): string {
  if (message.type === 'user') return 'user'
  if (message.type === 'start') return 'start'
  if (message.type === 'complete') return 'complete'

  if (message.type === 'sdk_message') {
    const sdkMsg = message.content as SDKMessage

    if (isSDKSystemMessage(sdkMsg)) return 'system'
    if (isSDKAssistantMessage(sdkMsg)) return 'assistant'
    if (isSDKUserMessage(sdkMsg)) return 'tool_result'
    if (isSDKResultMessage(sdkMsg)) return 'result'
  }

  if (message.type === 'result') return 'result'

  return 'unknown'
}