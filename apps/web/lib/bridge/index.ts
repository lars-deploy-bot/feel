/**
 * Bridge Module
 *
 * Handles streaming communication between client and server.
 * Provides typed events and React hooks for stream handling.
 */

// Stream event types
export {
  type BridgeStreamType,
  type BridgeBaseEvent,
  type BridgeStartEvent,
  type BridgeMessageEvent,
  type BridgeCompleteEvent,
  type BridgeInterruptEvent,
  type BridgeErrorEvent,
  type BridgeEvent,
  type BridgeMessageContent,
  isBridgeEvent,
  isBridgeMessageEvent,
  isBridgeStartEvent,
  isBridgeCompleteEvent,
  isBridgeInterruptEvent,
  isBridgeErrorEvent,
} from "./streamTypes"

// Stream handler hook
export {
  useStreamHandler,
  type UseStreamHandlerOptions,
  type UseStreamHandlerReturn,
} from "./useStreamHandler"
