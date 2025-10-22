import { query, type Options } from '@anthropic-ai/claude-agent-sdk'

export interface StreamEvent {
  type: 'start' | 'message' | 'complete' | 'error'
  requestId: string
  timestamp: string
  data: any
}

export interface StreamOptions {
  message: string
  claudeOptions: Options
  requestId: string
  host: string
  cwd: string
}

/**
 * Creates a ReadableStream that streams Claude SDK messages via Server-Sent Events
 */
export function createClaudeStream({ message, claudeOptions, requestId, host, cwd }: StreamOptions): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const sendEvent = (eventType: StreamEvent['type'], data: any) => {
        const event: StreamEvent = {
          type: eventType,
          requestId,
          timestamp: new Date().toISOString(),
          data
        }
        const eventData = `event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`
        controller.enqueue(encoder.encode(eventData))

        // Also log for server debugging
        console.log(`[Stream ${requestId}] Event: ${eventType}`, data)
      }

      try {
        // Send initial status
        sendEvent('start', {
          host,
          cwd,
          message: 'Starting Claude query...',
          messageLength: message.length
        })

        const q = query({ prompt: message, options: claudeOptions })
        console.log(`[Stream ${requestId}] Query created, starting iteration...`)

        let queryResult: any = null
        let messageCount = 0

        for await (const m of q) {
          messageCount++
          console.log(`[Stream ${requestId}] Message ${messageCount}: type=${m.type}`)

          // Stream every message to frontend
          sendEvent('message', {
            messageCount,
            messageType: m.type,
            content: m,
            ...(m.type === 'tool_use' && {
              toolName: (m as any).name,
              toolInput: (m as any).input
            }),
            ...(m.type === 'tool_result' && {
              toolResult: (m as any).content
            }),
            ...(m.type === 'text' && {
              textContent: (m as any).content
            })
          })

          if (m.type === 'result') {
            queryResult = m
            console.log(`[Stream ${requestId}] Got result message:`, {
              success: !!queryResult,
              hasContent: !!(queryResult as any)?.content,
              contentLength: (queryResult as any)?.content?.length || 0
            })
          }
        }

        console.log(`[Stream ${requestId}] Query iteration completed. Total messages: ${messageCount}`)

        // Send completion event
        sendEvent('complete', {
          totalMessages: messageCount,
          result: queryResult,
          message: 'Claude query completed successfully'
        })

        console.log(`[Stream ${requestId}] === STREAM SUCCESS ===`)
        controller.close()

      } catch (error) {
        console.error(`[Stream ${requestId}] Stream error:`, error)
        sendEvent('error', {
          error: 'query_failed',
          message: 'Claude SDK query failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
        controller.close()
      }
    },

    cancel() {
      console.log(`[Stream ${requestId}] Stream cancelled by client`)
    }
  })
}

/**
 * Helper to create SSE Response with proper headers
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}