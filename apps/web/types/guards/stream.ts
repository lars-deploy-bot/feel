import type {
  CompleteEventData,
  MessageEventData,
  SessionEventData,
  StartEventData,
  StreamEvent,
} from "@/lib/message-parser"
import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk"

// Type guards for stream events
export function isStartEvent(event: StreamEvent): event is StreamEvent & { data: StartEventData } {
  return event.type === "start" && "cwd" in event.data
}

export function isSessionEvent(event: StreamEvent): event is StreamEvent & { data: SessionEventData } {
  return event.type === "session" && "sessionId" in event.data
}

export function isMessageEvent(event: StreamEvent): event is StreamEvent & { data: MessageEventData } {
  return event.type === "message" && "messageType" in event.data && "content" in event.data
}

export function isResultEvent(event: StreamEvent): event is StreamEvent & { data: SDKResultMessage } {
  return event.type === "result" && "subtype" in event.data
}

export function isCompleteEvent(event: StreamEvent): event is StreamEvent & { data: CompleteEventData } {
  return event.type === "complete" && "totalMessages" in event.data
}
