import { formatMessage } from "@/app/features/handlers/formatMessage"
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
}: StreamOptions): { stream: ReadableStream } {
  const encoder = new TextEncoder()
  const sdkAbort = new AbortController()
  let cancelled = false

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

    // CRITICAL: When HTTP request is aborted, invalidate the session to prevent
    // resuming from a corrupted/interrupted state
    if (conversation) {
      try {
        await conversation.store.delete(conversation.key)
        console.log(`[Stream ${requestId}] Session invalidated due to HTTP abort`)
      } catch (error) {
        console.error(`[Stream ${requestId}] Failed to invalidate session on HTTP abort:`, error)
      }
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
            controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`))
          }
        }, 20000)

        // Optional runaway protection (2 minutes)
        const killer = setTimeout(() => sdkAbort.abort("timeout"), 120000)

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

          let queryResult: any = null
          let messageCount = 0
          let sessionSaved = !!claudeOptions.resume // Already had one?

          for await (const m of q) {
            messageCount++
            console.log(`[Stream ${requestId}] Message ${messageCount}: type=${m.type}`)

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
            result: queryResult,
            message: "Claude query completed successfully",
          })

          // Normal end
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`))
          console.log(`[Stream ${requestId}] === STREAM SUCCESS ===`)
        } catch (error) {
          console.error(`[Stream ${requestId}] Stream error:`, error)

          // If this is an SDK error that might indicate session corruption, invalidate the session
          const errorMessage = error instanceof Error ? error.message : String(error)
          const isSessionError = errorMessage.includes("process exited") ||
                                  errorMessage.includes("Claude Code") ||
                                  errorMessage.toLowerCase().includes("session")

          if (isSessionError && conversation) {
            try {
              await conversation.store.delete(conversation.key)
              console.log(`[Stream ${requestId}] Session invalidated due to SDK error: ${errorMessage}`)
            } catch (sessionError) {
              console.error(`[Stream ${requestId}] Failed to invalidate session after SDK error:`, sessionError)
            }
          }

          // If we aborted, include error code for client
          if (!sdkAbort.signal.aborted) {
            const errorCode = sdkAbort.signal.aborted ? "aborted" : "query_failed"
            sendEvent("error", {
              error: errorCode,
              code: errorCode,
              message: "Claude SDK query failed",
              details: errorMessage,
            })
          }
        } finally {
          clearInterval(tick)
          clearTimeout(killer)
          if (!cancelled) controller.close() // Close only if not already cancelled
          onClose?.() // Unlock conversation here
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

      // CRITICAL: When stream is cancelled, invalidate the session to prevent
      // resuming from a corrupted/interrupted state
      if (conversation) {
        try {
          await conversation.store.delete(conversation.key)
          console.log(`[Stream ${requestId}] Session invalidated due to cancellation`)
        } catch (error) {
          console.error(`[Stream ${requestId}] Failed to invalidate session:`, error)
        }
      }

      onClose?.() // And unlock here too (idempotent)
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
