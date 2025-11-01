import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk"
import type {
  CompleteEventData,
  DoneEventData,
  ErrorEventData,
  MessageEventData,
  PingEventData,
  SessionEventData,
  StartEventData,
  StreamEvent,
} from "@/lib/message-parser"

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

export function isErrorEvent(event: StreamEvent): event is StreamEvent & { data: ErrorEventData } {
  return event.type === "error" && "error" in event.data && "message" in event.data
}

export function isPingEvent(event: StreamEvent): event is StreamEvent & { data: PingEventData } {
  return event.type === "ping"
}

export function isDoneEvent(event: StreamEvent): event is StreamEvent & { data: DoneEventData } {
  return event.type === "done"
}
