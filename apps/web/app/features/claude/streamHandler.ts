import { formatMessage } from "@/app/features/handlers/formatMessage"
import { type ErrorCode, ErrorCodes } from "@/lib/error-codes"
import { extractSessionId, getMessageStreamData } from "@/lib/sdk-types"
import type { SessionStore } from "@/lib/sessionStore"
import { type Options, query } from "@anthropic-ai/claude-agent-sdk"

export interface StreamEvent {
  type: "start" | "message" | "session" | "complete" | "error"
  requestId: string
  timestamp: string
  data: unknown
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
  maxTurns?: number // For better error handling and user feedback
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
  const encoder = new TextEncoder()
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

  // If the HTTP request itself gets aborted, stop the SDK too
  const onHttpAbort = async () => {
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

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ;(async () => {
        const sendEvent = (eventType: StreamEvent["type"], data: unknown) => {
          const event: StreamEvent = {
            type: eventType,
            requestId,
            timestamp: new Date().toISOString(),
            data,
          }
          const eventData = `event: bridge_${eventType}\ndata: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(eventData))

          // Also log for server debugging
          console.log(`[Stream ${requestId}] Event: ${eventType}`, data)
        }

        // Optional heartbeat to keep connection alive (every 20s)
        const tick = setInterval(() => {
          if (!cancelled && !sdkAbort.signal.aborted) {
            controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"))
          }
        }, 20000)

        // Optional runaway protection (2 minutes)
        const killer = setTimeout(() => sdkAbort.abort("timeout"), 120000)

        // Declare variables outside try block so they're accessible in catch
        let queryResult: any = null
        let messageCount = 0
        let turnCount = 0 // Track conversation turns (assistant responses)
        let sessionSaved = !!claudeOptions.resume // Already had one?

        try {
          // Send initial status
          sendEvent("start", {
            host,
            cwd,
            message: "Starting Claude query...",
            messageLength: message.length,
            isResume: !!claudeOptions.resume,
          })
          console.log(`[Stream ${requestId}] Query created, starting iteration...`)

          for await (const m of q) {
            messageCount++

            // Count turns (assistant messages indicate new turns)
            if (m.type === "assistant") {
              turnCount++
              console.log(`[Stream ${requestId}] Turn ${turnCount}/${maxTurns}: Message ${messageCount}`)

              // Send warning when approaching limit
              if (turnCount === maxTurns - 2) {
                sendEvent("message", {
                  messageCount: messageCount + 0.5, // Insert between messages
                  messageType: "warning",
                  content: {
                    type: "warning",
                    message: `⚠️ Approaching conversation limit: ${turnCount}/${maxTurns} turns used. Consider starting a new conversation soon.`,
                  },
                })
              }
            } else {
              console.log(`[Stream ${requestId}] Message ${messageCount}: type=${m.type}`)
            }

            // Capture and persist the session_id as soon as we see system:init
            if (!sessionSaved) {
              const sessionId = extractSessionId(m)
              if (sessionId && conversation) {
                try {
                  await conversation.store.set(conversation.key, sessionId)
                  console.log(`[Stream ${requestId}] Session saved: ${sessionId}`)
                  sessionSaved = true
                  sendEvent("session", { sessionId })
                } catch (error) {
                  console.error(`[Stream ${requestId}] Failed to save session:`, error)
                }
              }
            }

            // Format/minimize message content if it's a result message
            let processedMessage = m
            if (m.type === "result") {
              console.log(`[Stream ${requestId}] Formatting result message...`)
              processedMessage = await formatMessage(m)
            }

            // Stream every message to frontend
            const messageData = getMessageStreamData(processedMessage)
            sendEvent("message", {
              messageCount,
              ...messageData,
            })

            if (processedMessage.type === "result") {
              queryResult = processedMessage
              console.log(`[Stream ${requestId}] Got result message`)
            }
          }

          console.log(`[Stream ${requestId}] Query iteration completed. Total messages: ${messageCount}`)

          // Send completion event
          sendEvent("complete", {
            totalMessages: messageCount,
            totalTurns: turnCount,
            maxTurns: maxTurns,
            result: queryResult,
            message: `Claude query completed successfully (${turnCount}/${maxTurns} turns used)`,
          })

          // Normal end
          controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"))
          console.log(`[Stream ${requestId}] === STREAM SUCCESS ===`)
        } catch (error) {
          console.error(`[Stream ${requestId}] Stream error:`, error)

          // Check if this is a maxTurns limit error with improved detection
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorString = errorMessage.toLowerCase()
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

            if (isMaxTurnsError) {
              errorCode = ErrorCodes.ERROR_MAX_TURNS
              userMessage = `Conversation reached maximum turn limit (${turnCount}/${maxTurns} turns). Please start a new conversation to continue working.`
            }

            sendEvent("error", {
              error: errorCode,
              code: errorCode,
              message: userMessage,
              details: errorMessage,
            })
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
 * Helper to create SSE Response with proper headers
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
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
