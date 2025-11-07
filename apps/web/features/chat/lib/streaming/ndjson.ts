/**
 * NDJSON Protocol for Bridge Streaming
 *
 * Format: One complete JSON message per line, no delimiters needed
 * Parser: Split on \n, JSON.parse each line
 *
 * All events and errors must be strictly typed. No loose typing allowed.
 */

import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk"
import type { ErrorCode } from "@/lib/error-codes"

/**
 * Bridge Stream Type Constants
 * Mirrored in agent-constants.mjs for Node.js execution context.
 * Defined here (not imported) to avoid bundling Node.js dependencies in browser.
 */
export const BridgeStreamType = {
  START: "bridge_start",
  SESSION: "bridge_session",
  MESSAGE: "bridge_message",
  COMPLETE: "bridge_complete",
  ERROR: "bridge_error",
  PING: "bridge_ping",
  DONE: "bridge_done",
  INTERRUPT: "bridge_interrupt",
} as const

export type BridgeStreamType = (typeof BridgeStreamType)[keyof typeof BridgeStreamType]

export const BridgeSyntheticMessageType = {
  WARNING: "bridge_warning",
} as const

export type BridgeSyntheticMessageType = (typeof BridgeSyntheticMessageType)[keyof typeof BridgeSyntheticMessageType]

export type BridgeMessageType = SDKMessage["type"] | BridgeSyntheticMessageType

export const BridgeInterruptSource = {
  HTTP_ABORT: "bridge_http_abort",
  CLIENT_CANCEL: "bridge_client_cancel",
} as const

export type BridgeInterruptSource = (typeof BridgeInterruptSource)[keyof typeof BridgeInterruptSource]

export type InterruptSource = BridgeInterruptSource

// ============================================================================
// Message Type Definitions
// ============================================================================

/**
 * Base Bridge message envelope - all streamed messages follow this structure
 */
export interface BridgeMessage {
  type: BridgeStreamType
  requestId: string
  timestamp: string
  data: unknown
}

/**
 * Bridge START event - indicates stream initialization
 */
export interface BridgeStartMessage extends Omit<BridgeMessage, "type" | "data"> {
  type: typeof BridgeStreamType.START
  data: {
    host: string
    cwd: string
    message: string
    messageLength: number
    isResume?: boolean
  }
}

/**
 * Bridge SESSION event - carries SDK session ID for resumption
 */
export interface BridgeSessionMessage extends Omit<BridgeMessage, "type" | "data"> {
  type: typeof BridgeStreamType.SESSION
  data: {
    sessionId: string
  }
}

/**
 * Bridge MESSAGE event - carries SDK messages or Bridge synthetic messages
 */
export interface BridgeMessageEvent extends Omit<BridgeMessage, "type" | "data"> {
  type: typeof BridgeStreamType.MESSAGE
  data: {
    messageCount: number
    messageType: BridgeMessageType
    content: unknown
  }
}

/**
 * Bridge COMPLETE event - indicates successful stream completion
 */
export interface BridgeCompleteMessage extends Omit<BridgeMessage, "type" | "data"> {
  type: typeof BridgeStreamType.COMPLETE
  data: {
    totalMessages: number
    totalTurns?: number
    maxTurns?: number
    result: SDKResultMessage | null
    message?: string
  }
}

/**
 * Bridge ERROR event - indicates stream failure with specific error code
 */
export interface BridgeErrorMessage extends Omit<BridgeMessage, "type" | "data"> {
  type: typeof BridgeStreamType.ERROR
  data: {
    error: ErrorCode
    code: ErrorCode
    message: string
    details?: Record<string, string | number | boolean> | string
  }
}

/**
 * Bridge PING event - heartbeat to keep connection alive
 */
export interface BridgePingMessage extends Omit<BridgeMessage, "type" | "data"> {
  type: typeof BridgeStreamType.PING
  data: Record<string, never>
}

/**
 * Bridge DONE event - indicates clean end of stream
 */
export interface BridgeDoneMessage extends Omit<BridgeMessage, "type" | "data"> {
  type: typeof BridgeStreamType.DONE
  data: Record<string, never>
}

/**
 * Bridge INTERRUPT event - indicates stream was interrupted by user or connection
 */
export interface BridgeInterruptMessage extends Omit<BridgeMessage, "type" | "data"> {
  type: typeof BridgeStreamType.INTERRUPT
  data: {
    message: string
    source: InterruptSource
  }
}

/**
 * Union type of all possible Bridge stream messages
 */
export type StreamMessage =
  | BridgeStartMessage
  | BridgeSessionMessage
  | BridgeMessageEvent
  | BridgeCompleteMessage
  | BridgeErrorMessage
  | BridgePingMessage
  | BridgeDoneMessage
  | BridgeInterruptMessage

/**
 * Encode a stream message as NDJSON (newline-delimited JSON)
 * @param message The typed stream message
 * @returns UTF-8 encoded line with newline terminator
 */
export function encodeNDJSON(message: StreamMessage): Uint8Array {
  const json = JSON.stringify(message)
  const encoder = new TextEncoder()
  return encoder.encode(`${json}\n`)
}

/**
 * Factory functions for creating typed Bridge messages
 */

export function createStartMessage(requestId: string, data: BridgeStartMessage["data"]): BridgeStartMessage {
  return {
    type: BridgeStreamType.START,
    requestId,
    timestamp: new Date().toISOString(),
    data,
  }
}

export function createMessageEvent(requestId: string, data: BridgeMessageEvent["data"]): BridgeMessageEvent {
  return {
    type: BridgeStreamType.MESSAGE,
    requestId,
    timestamp: new Date().toISOString(),
    data,
  }
}

export function createCompleteMessage(requestId: string, data: BridgeCompleteMessage["data"]): BridgeCompleteMessage {
  return {
    type: BridgeStreamType.COMPLETE,
    requestId,
    timestamp: new Date().toISOString(),
    data,
  }
}

export function createErrorMessage(requestId: string, data: BridgeErrorMessage["data"]): BridgeErrorMessage {
  return {
    type: BridgeStreamType.ERROR,
    requestId,
    timestamp: new Date().toISOString(),
    data,
  }
}

export function createPingMessage(requestId: string): BridgePingMessage {
  return {
    type: BridgeStreamType.PING,
    requestId,
    timestamp: new Date().toISOString(),
    data: {},
  }
}

export function createDoneMessage(requestId: string): BridgeDoneMessage {
  return {
    type: BridgeStreamType.DONE,
    requestId,
    timestamp: new Date().toISOString(),
    data: {},
  }
}

export function createInterruptMessage(requestId: string, source: InterruptSource): BridgeInterruptMessage {
  return {
    type: BridgeStreamType.INTERRUPT,
    requestId,
    timestamp: new Date().toISOString(),
    data: {
      message: "Response interrupted by user",
      source,
    },
  }
}
