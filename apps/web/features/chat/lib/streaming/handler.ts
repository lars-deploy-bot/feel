import { type Options, query } from "@anthropic-ai/claude-agent-sdk"
import type { SessionStore } from "@/features/auth/lib/sessionStore"
import type { SDKMessage } from "@/features/chat/types/sdk-types"
import { extractSessionId, getMessageStreamData } from "@/features/chat/types/sdk-types"
import { type ErrorCode, ErrorCodes } from "@/lib/error-codes"
import { ALLOWED_SDK_TOOLS } from "@/lib/claude/agent-constants.mjs"
import { formatMessage } from "../formatMessage"
import {
  BridgeInterruptSource,
  createCompleteMessage,
  createDoneMessage,
  createErrorMessage,
  createInterruptMessage,
  createMessageEvent,
  createPingMessage,
  createStartMessage,
  encodeNDJSON,
  type StreamMessage,
} from "./ndjson"

// Re-export for compatibility
export type StreamEvent = StreamMessage

/**
 * Filter system init message to only expose allowed SDK tools.
 * The SDK may report all available tools; this restricts visibility to workspace-scoped operations.
 * Modifies message in-place and returns it for chaining.
 */
function filterAllowedTools(message: SDKMessage): SDKMessage {
  const msg = message as Record<string, unknown>

  if (msg.type === "system" && msg.subtype === "init" && Array.isArray(msg.tools)) {
    msg.tools = (msg.tools as string[]).filter(tool => ALLOWED_SDK_TOOLS.includes(tool))
  }

  return message
}

export interface StreamOptions {
  message: string
  claudeOptions: Options
  requestId: string
  host: string
  cwd: string
  user: { id: string }
  conversation?: {
    key: string
    store: SessionStore
  }
  requestSignal?: AbortSignal
  onClose?: () => void
  maxTurns?: number
}

/**
 * Creates a ReadableStream that streams Claude SDK messages via Server-Sent Events
 */
export function createClaudeStream({
  message,
  claudeOptions,
  requestId,
  host,
  cwd,
  conversation,
  requestSignal,
  onClose,
  maxTurns = 25,
}: StreamOptions): { stream: ReadableStream } {
  const sdkAbort = new AbortController()
  let cancelled = false
  let conversationUnlocked = false

  // Build the SDK query with OUR abort controller
  const q = query({
    prompt: message,
    options: {
      ...claudeOptions,
      abortController: sdkAbort,
      includePartialMessages: false,
    },
  })

  // Store controller reference for cancel/abort methods
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null

  // If the HTTP request itself gets aborted, stop the SDK too
  const onHttpAbort = async () => {
    // Send interrupt event if stream is still active
    if (streamController) {
      sendInterruptEvent(streamController, BridgeInterruptSource.HTTP_ABORT)
    }

    try {
      sdkAbort.abort("http_request_aborted")
    } catch {}
    // interrupt() exists on Query; guard in case SDK changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(q as any)?.interrupt?.().catch(() => {})

    // Don't invalidate session on HTTP abort - user may be refreshing or navigating
    // Session will be cleaned up by conversation unlocking, but preserved for resume
    console.log(`[Stream ${requestId}] HTTP abort - preserving session for potential resume`)

    // Ensure conversation is unlocked on abort
    if (!conversationUnlocked) {
      conversationUnlocked = true
      onClose?.()
    }
  }
  requestSignal?.addEventListener("abort", onHttpAbort, { once: true })

  // Helper to send interrupt event with typed source
  let interruptSent = false
  const sendInterruptEvent = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    source: BridgeInterruptSource,
  ) => {
    if (interruptSent) return // Only send once
    interruptSent = true

    try {
      controller.enqueue(encodeNDJSON(createInterruptMessage(requestId, source)))
      console.log(`[Stream ${requestId}] Interrupt event sent (source: ${source})`)
    } catch {
      console.log(`[Stream ${requestId}] Could not send interrupt event (stream may be closed)`)
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
      ;(async () => {
        const sendEvent = (message: StreamMessage) => {
          controller.enqueue(encodeNDJSON(message))
          console.log(`[Stream ${requestId}] Event: ${message.type}`, message.data)
        }

        // Optional heartbeat to keep connection alive (every 20s)
        const tick = setInterval(() => {
          if (!cancelled && !sdkAbort.signal.aborted) {
            controller.enqueue(encodeNDJSON(createPingMessage(requestId)))
          }
        }, 20000)

        // Optional runaway protection (2 minutes)
        const killer = setTimeout(() => sdkAbort.abort("timeout"), 120000)

        // Declare variables outside try block so they're accessible in catch
        let queryResult: SDKMessage | null = null
        let messageCount = 0
        let turnCount = 0 // Track conversation turns (assistant responses)
        let sessionSaved = !!claudeOptions.resume // Already had one?

        try {
          sendEvent(
            createStartMessage(requestId, {
              host,
              cwd,
              message: "Starting Claude query...",
              messageLength: message.length,
              isResume: !!claudeOptions.resume,
            }),
          )
          console.log(`[Stream ${requestId}] Query created, starting iteration...`)

          for await (const m of q) {
            messageCount++

            // Count turns (assistant messages indicate new turns)
            if (m.type === "assistant") {
              turnCount++
              console.log(`[Stream ${requestId}] Turn ${turnCount}/${maxTurns}: Message ${messageCount}`)

              // Send warning when approaching limit
              if (turnCount === maxTurns - 2) {
                sendEvent(
                  createMessageEvent(requestId, {
                    messageCount: messageCount + 0.5,
                    messageType: "bridge_warning",
                    content: {
                      type: "bridge_warning",
                      message: `⚠️ Approaching conversation limit: ${turnCount}/${maxTurns} turns used. Consider starting a new conversation soon.`,
                    },
                  }),
                )
              }
            } else {
              console.log(`[Stream ${requestId}] Message ${messageCount}: type=${m.type}`)
            }

            const processedMessageForStream = filterAllowedTools(m)

            // Capture and persist the session_id as soon as we see system:init
            if (!sessionSaved) {
              const sessionId = extractSessionId(m)
              if (sessionId && conversation) {
                try {
                  await conversation.store.set(conversation.key, sessionId)
                  console.log(`[Stream ${requestId}] Session saved: ${sessionId}`)
                  sessionSaved = true
                } catch (error) {
                  console.error(`[Stream ${requestId}] Failed to save session:`, error)
                }
              }
            }

            // Format/minimize message content if it's a result message
            let processedMessage = processedMessageForStream
            if (processedMessage.type === "result") {
              console.log(`[Stream ${requestId}] Formatting result message...`)
              processedMessage = await formatMessage(processedMessage)
            }

            // Stream every message to frontend
            const messageData = getMessageStreamData(processedMessage)
            sendEvent(
              createMessageEvent(requestId, {
                messageCount,
                ...messageData,
              }),
            )

            if (processedMessage.type === "result") {
              queryResult = processedMessage
              console.log(`[Stream ${requestId}] Got result message`)
            }
          }

          console.log(`[Stream ${requestId}] Query iteration completed. Total messages: ${messageCount}`)

          // Send completion event
          sendEvent(
            createCompleteMessage(requestId, {
              totalMessages: messageCount,
              totalTurns: turnCount,
              maxTurns: maxTurns,
              result: queryResult,
              message: `Claude query completed successfully (${turnCount}/${maxTurns} turns used)`,
            }),
          )

          // Normal end
          sendEvent(createDoneMessage(requestId))
          console.log(`[Stream ${requestId}] === STREAM SUCCESS ===`)
        } catch (error) {
          console.error(`[Stream ${requestId}] Stream error:`, error)

          // Extract error information
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorString = errorMessage.toLowerCase()

          // Check for API authentication errors by parsing error structure
          // See: apps/web/features/chat/lib/anthropic-error-examples.json
          let isAuthError = false
          try {
            // Anthropic SDK errors have format: "API Error: 401 (...JSON...)"
            if (errorString.includes("api error") && errorString.includes("401")) {
              isAuthError = true
            } else if (typeof error === "object" && error !== null) {
              const err = error as any
              // Check error structure: error.type === "error" && error.error?.type === "authentication_error"
              if (err.type === "error" && err.error?.type === "authentication_error") {
                isAuthError = true
              }
            }
          } catch (_parseError) {
            // Fallback to string matching if parsing fails
            isAuthError = errorString.includes("authentication_error")
          }

          const isMaxTurnsError =
            // Claude SDK specific error patterns
            (errorString.includes("max") && errorString.includes("turn")) ||
            errorString.includes("conversation limit") ||
            errorString.includes("turn limit") ||
            errorString.includes("maximum turns") ||
            // Check if we reached the limit we set
            turnCount >= maxTurns

          // Only invalidate session on actual process crashes, preserve for recoverable errors
          if (conversation && errorMessage.includes("process exited unexpectedly")) {
            try {
              await conversation.store.delete(conversation.key)
              console.log(`[Stream ${requestId}] Session invalidated due to process crash`)
            } catch (sessionError) {
              console.error(`[Stream ${requestId}] Failed to invalidate session after process crash:`, sessionError)
            }
          } else if (conversation) {
            console.log(`[Stream ${requestId}] Preserving session - error appears recoverable: ${errorMessage}`)
          }

          // Handle different error types
          if (!sdkAbort.signal.aborted) {
            let errorCode: ErrorCode = ErrorCodes.QUERY_FAILED
            let userMessage = "Claude SDK query failed"

            if (isAuthError) {
              errorCode = ErrorCodes.API_AUTH_FAILED
              userMessage =
                "API authentication failed. The API key may be expired or invalid. Please contact the system administrator to update the API key."
            } else if (isMaxTurnsError) {
              errorCode = ErrorCodes.ERROR_MAX_TURNS
              userMessage = `Conversation reached maximum turn limit (${turnCount}/${maxTurns} turns). Please start a new conversation to continue working.`
            }

            sendEvent(
              createErrorMessage(requestId, {
                error: errorCode,
                code: errorCode,
                message: userMessage,
                details: errorMessage,
              }),
            )
          }
        } finally {
          clearInterval(tick)
          clearTimeout(killer)
          if (!cancelled) controller.close() // Close only if not already cancelled

          // Ensure conversation is unlocked (only once)
          if (!conversationUnlocked) {
            conversationUnlocked = true
            onClose?.()
          }

          requestSignal?.removeEventListener("abort", onHttpAbort)
        }
      })()
    },

    async cancel(reason?: unknown) {
      cancelled = true
      console.log(`[Stream ${requestId}] Stream cancelled by client:`, reason)

      // Send interrupt event before closing
      if (streamController) {
        sendInterruptEvent(streamController, BridgeInterruptSource.CLIENT_CANCEL)
      }

      try {
        sdkAbort.abort("client_cancelled")
      } catch {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (q as any)?.interrupt?.().catch(() => {})

      // Don't invalidate session on user cancellation - allow resume
      console.log(`[Stream ${requestId}] Stream cancelled - preserving session for potential resume`)

      // Ensure conversation is unlocked (only once)
      if (!conversationUnlocked) {
        conversationUnlocked = true
        onClose?.()
      }
    },
  })

  return { stream }
}

/**
 * Helper to create NDJSON Response with proper headers
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  })
}
