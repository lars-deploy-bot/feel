import type { DevSSEEvent } from "./dev-terminal-context"

export type ClientErrorType =
  | "http_error"
  | "timeout_error"
  | "parse_error"
  | "critical_parse_error"
  | "invalid_event_structure"
  | "reader_error"
  | "general_error"

export interface ClientErrorData {
  errorType: ClientErrorType
  [key: string]: unknown
}

/**
 * Send a client-side error to the dev terminal (development mode only)
 */
export function sendClientError(params: {
  conversationId: string
  errorType: ClientErrorType
  data: Record<string, unknown>
  addDevEvent: (event: DevSSEEvent) => void
}): void {
  // Only log in development
  if (process.env.NODE_ENV !== "development") return

  const { conversationId, errorType, data, addDevEvent } = params

  const errorData: ClientErrorData = {
    errorType,
    ...data,
  }

  addDevEvent({
    eventName: "client_error",
    event: {
      type: "error",
      requestId: conversationId,
      timestamp: new Date().toISOString(),
      data: errorData,
    },
    rawSSE: `event: client_error\ndata: ${JSON.stringify(errorData)}\n\n`,
  })
}
