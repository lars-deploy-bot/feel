/**
 * NDJSON Stream Handler - Process child process output with credit charging
 *
 * ARCHITECTURE:
 * - Credits are the primary currency (stored and charged in credits)
 * - LLM tokens from Claude API are converted to credits only at charge time
 * - Example: Claude uses 1000 LLM tokens → converted to 10 credits → charged to workspace
 *
 * Responsibilities:
 * - Parse NDJSON events from child process
 * - Handle session ID storage (via optional callback)
 * - Charge workspace credits for actual LLM token usage
 * - Build typed stream messages
 * - Manage stream lifecycle and cancellation
 *
 * This module encapsulates the complete streaming pipeline: receiving raw bytes
 * from child process, parsing NDJSON, routing to session/message handlers,
 * applying credit charges, and sending typed messages to client.
 */

import { SessionStoreMemory } from "@/features/auth/lib/sessionStore"
import type { BridgeErrorMessage, StreamMessage } from "@/features/chat/lib/streaming/ndjson"
import { BridgeStreamType, encodeNDJSON } from "@/features/chat/lib/streaming/ndjson"
import { isAssistantMessageWithUsage, isBridgeMessageEvent } from "@/features/chat/types/guards"
import { llmTokensToCredits } from "@/lib/credits"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { calculateLLMTokenCost, chargeTokensFromCredits, WORKSPACE_CREDIT_DISCOUNT } from "@/lib/tokens"

/**
 * Event types emitted by child process
 */
interface ChildEvent {
  type: string
  messageCount?: number
  messageType?: string
  content?: unknown
  totalMessages?: number
  result?: unknown
  sessionId?: string
}

/**
 * Shared cancellation state between registry and stream
 */
export interface CancelState {
  requested: boolean
  reader: ReadableStreamDefaultReader<Uint8Array> | null
}

/**
 * Configuration for NDJSON stream handler
 *
 * The stream handler is responsible for:
 * - Parsing NDJSON from child process
 * - Extracting and storing session IDs
 * - Building typed stream messages
 * - Charging workspace credits for actual LLM usage
 * - Managing stream lifecycle and cancellation
 */
interface StreamHandlerConfig {
  childStream: ReadableStream<Uint8Array>
  conversationKey: string
  requestId: string
  conversationWorkspace: string
  /**
   * Token source determines credit billing:
   * - "workspace": Charge from workspace credit balance
   * - "user_provided": User provided their own API key, no charges
   */
  tokenSource: "workspace" | "user_provided"
  /**
   * Called when a session ID is received from the child process
   * Allows caller to store session ID or perform other session setup
   */
  onSessionIdReceived?: (sessionId: string) => Promise<void>
  /**
   * Called when the stream completes (success, error, or abort)
   * Used for cleanup like releasing conversation locks
   * Guaranteed to be called exactly once via finally block
   */
  onStreamComplete?: () => void
  /**
   * Shared cancellation state with registry
   * Allows explicit cancellation via separate HTTP request
   */
  cancelState: CancelState
}

/**
 * Charge credits for assistant message based on LLM token usage
 * Only charges when using workspace credits (not user API key)
 * Conversion from LLM tokens to credits happens inside chargeTokensFromCredits
 */
function chargeTokensForMessage(message: StreamMessage, workspace: string, requestId: string): boolean {
  if (!isBridgeMessageEvent(message) || !isAssistantMessageWithUsage(message)) {
    return false
  }

  const usage = message.data.content.message.usage
  const llmTokensUsed = calculateLLMTokenCost(usage)
  const creditsUsed = llmTokensToCredits(llmTokensUsed)
  const chargedCredits = Math.floor(creditsUsed * WORKSPACE_CREDIT_DISCOUNT * 100) / 100

  try {
    const newBalance = chargeTokensFromCredits(workspace, llmTokensUsed)

    if (newBalance !== null) {
      console.log(
        `[NDJSON Stream ${requestId}] Charged ${chargedCredits} credits (LLM tokens: ${llmTokensUsed}, input: ${usage.input_tokens}, output: ${usage.output_tokens}), new balance: ${newBalance} credits`,
      )
      return true
    } else {
      console.warn(`[NDJSON Stream ${requestId}] Failed to charge credits`)
      return false
    }
  } catch (error) {
    console.error(
      `[NDJSON Stream ${requestId}] Error charging credits:`,
      error instanceof Error ? error.message : String(error),
    )
    return false
  }
}

/**
 * Process a single child event - handle session or message
 * Encapsulates the session/message routing logic to avoid duplication
 */
async function processChildEvent(
  childEvent: ChildEvent,
  requestId: string,
  conversationKey: string,
  workspace: string,
  tokenSource: "workspace" | "user_provided",
  onSessionIdReceived: ((sessionId: string) => Promise<void>) | undefined,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
  // Handle session ID storage (server-side only)
  if (childEvent.type === "bridge_session" && childEvent.sessionId) {
    console.log(`[NDJSON Stream ${requestId}] Storing session ID: ${childEvent.sessionId}`)
    try {
      await SessionStoreMemory.set(conversationKey, childEvent.sessionId)
      if (onSessionIdReceived) {
        await onSessionIdReceived(childEvent.sessionId)
      }
    } catch (sessionError) {
      console.error(
        `[NDJSON Stream ${requestId}] Error storing session ID:`,
        sessionError instanceof Error ? sessionError.message : String(sessionError),
      )
    }
  } else {
    // Build message and send to client
    const message = buildStreamMessage(childEvent, requestId)

    // Only charge LLM tokens if using workspace credits (not user API key)
    if (tokenSource === "workspace") {
      chargeTokensForMessage(message, workspace, requestId)
    }

    controller.enqueue(encodeNDJSON(message))
  }
}

/**
 * Build a stream message from child event
 */
function buildStreamMessage(childEvent: ChildEvent, requestId: string): StreamMessage | BridgeErrorMessage {
  const timestamp = new Date().toISOString()

  if (childEvent.type === "error") {
    return {
      type: BridgeStreamType.ERROR,
      requestId,
      timestamp,
      data: {
        error: ErrorCodes.STREAM_ERROR,
        code: ErrorCodes.STREAM_ERROR,
        message: getErrorMessage(ErrorCodes.STREAM_ERROR),
        details: { error: String(childEvent) },
      },
    } as unknown as BridgeErrorMessage
  }

  return {
    type: childEvent.type,
    requestId,
    timestamp,
    data:
      childEvent.type === "message"
        ? {
            messageCount: childEvent.messageCount,
            messageType: childEvent.messageType,
            content: childEvent.content,
          }
        : childEvent.type === "complete"
          ? { totalMessages: childEvent.totalMessages, result: childEvent.result }
          : childEvent,
  } as StreamMessage
}

/**
 * Create an NDJSON stream from child process output
 *
 * Handles:
 * - NDJSON parsing and buffering
 * - Session ID extraction and callback invocation
 * - Message transformation and routing
 * - Token deduction for workspace-funded requests (synchronous)
 * - Error handling and recovery
 * - Graceful shutdown and cancellation
 *
 * @param config - Stream handler configuration
 * @returns ReadableStream that can be sent as HTTP response
 */
export function createNDJSONStream(config: StreamHandlerConfig): ReadableStream<Uint8Array> {
  const {
    childStream,
    conversationKey,
    requestId,
    conversationWorkspace,
    tokenSource,
    onSessionIdReceived,
    onStreamComplete,
    cancelState,
  } = config

  const decoder = new TextDecoder()
  let cleanupCalled = false // Track if cleanup was already called (shared between start and cancel)

  return new ReadableStream({
    async start(controller) {
      const reader = childStream.getReader()
      cancelState.reader = reader // Store for explicit cancellation
      let buffer = ""

      try {
        while (true) {
          // Check if explicitly cancelled via cancel endpoint
          if (cancelState.requested) {
            console.log(`[NDJSON Stream ${requestId}] Breaking loop due to explicit cancellation`)
            // CRITICAL: Release lock immediately, don't wait for child process to finish
            if (!cleanupCalled) {
              onStreamComplete?.()
              cleanupCalled = true
            }
            break
          }

          const { done, value } = await reader.read()
          if (done) {
            break
          }

          // Decode incoming data and split by newlines
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          // Process each complete NDJSON line
          for (const line of lines) {
            // Check for cancellation during processing for better responsiveness
            if (cancelState.requested) {
              console.log(`[NDJSON Stream ${requestId}] Cancelled during line processing`)
              // CRITICAL: Release lock immediately
              if (!cleanupCalled) {
                onStreamComplete?.()
                cleanupCalled = true
              }
              break
            }

            if (!line.trim()) continue

            try {
              const childEvent: ChildEvent = JSON.parse(line)
              await processChildEvent(
                childEvent,
                requestId,
                conversationKey,
                conversationWorkspace,
                tokenSource,
                onSessionIdReceived,
                controller,
              )
            } catch (parseError) {
              console.error(
                `[NDJSON Stream ${requestId}] Failed to parse child output (length: ${line.length}):`,
                parseError instanceof Error ? parseError.message : String(parseError),
              )
              console.error(`[NDJSON Stream ${requestId}] Line preview:`, line.substring(0, 200))
            }
          }

          // Break outer loop if cancelled during processing
          if (cancelState.requested) break
        }

        // Process final buffered content
        if (buffer.trim()) {
          try {
            const childEvent: ChildEvent = JSON.parse(buffer)
            await processChildEvent(
              childEvent,
              requestId,
              conversationKey,
              conversationWorkspace,
              tokenSource,
              onSessionIdReceived,
              controller,
            )
          } catch (_parseError) {
            console.error(`[NDJSON Stream ${requestId}] Failed to parse final buffer:`, buffer)
          }
        }

        console.log(`[NDJSON Stream ${requestId}] Child process stream complete`)
      } catch (error) {
        console.error(`[NDJSON Stream ${requestId}] Child process stream error:`, error)
        const errorMessage: BridgeErrorMessage = {
          type: BridgeStreamType.ERROR,
          requestId,
          timestamp: new Date().toISOString(),
          data: {
            error: ErrorCodes.STREAM_ERROR,
            code: ErrorCodes.STREAM_ERROR,
            message: getErrorMessage(ErrorCodes.STREAM_ERROR),
            details: { error: String(error) },
          },
        }
        controller.enqueue(encodeNDJSON(errorMessage))
      } finally {
        // Guaranteed cleanup: runs on success, error, or cancellation
        // Close the stream so client knows we're done
        controller.close()

        // Release conversation lock and perform any other cleanup
        // Only call if not already called during explicit cancellation
        if (!cleanupCalled) {
          onStreamComplete?.()
          cleanupCalled = true
        }

        console.log(`[NDJSON Stream ${requestId}] Stream finalized and cleaned up`)
      }
    },

    /**
     * Called when stream is cancelled (client abort)
     * Propagates cancellation to child process for graceful shutdown
     */
    cancel() {
      console.log(`[NDJSON Stream ${requestId}] Stream cancelled by client (abort), releasing lock immediately`)
      // CRITICAL: Release lock immediately on abort (super-early Stop case)
      // Only call if not already called
      if (!cleanupCalled) {
        onStreamComplete?.()
        cleanupCalled = true
      }

      // Then try to cancel child stream (may already be locked, that's fine)
      childStream.cancel().catch(error => {
        console.error(`[NDJSON Stream ${requestId}] Failed to cancel childStream:`, error)
      })
    },
  })
}
