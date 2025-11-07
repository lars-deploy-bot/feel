import { isDevelopment } from "@/lib/stores/debug-store"
import { ClientError, type ClientErrorType, type DevSSEEvent } from "./dev-terminal-context"

export interface ClientErrorData {
  errorType: ClientErrorType
  [key: string]: unknown
}

export function sendClientError(params: {
  conversationId: string
  errorType: ClientErrorType
  data: Record<string, unknown>
  addDevEvent: (event: DevSSEEvent) => void
}): void {
  if (!isDevelopment()) return

  const { conversationId, errorType, data, addDevEvent } = params

  const errorData: ClientErrorData = {
    errorType,
    ...data,
  }

  const eventData = {
    type: errorType,
    requestId: conversationId,
    timestamp: new Date().toISOString(),
    data: errorData,
  }

  const devEvent: DevSSEEvent = {
    eventName: errorType,
    event: eventData,
    rawSSE: JSON.stringify(eventData) + '\n',
  }

  addDevEvent(devEvent)
}
