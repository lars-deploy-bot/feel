import { query, type Options } from '@anthropic-ai/claude-agent-sdk'
import type { SessionStore } from '@/lib/sessionStore'
import { extractSessionId, getMessageStreamData } from '@/lib/sdk-types'

export interface StreamEvent {
	type: 'start' | 'message' | 'session' | 'complete' | 'error'
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
}

/**
 * Creates a ReadableStream that streams Claude SDK messages via Server-Sent Events
 */
export function createClaudeStream({ message, claudeOptions, requestId, host, cwd, user, conversation }: StreamOptions): ReadableStream {
	return new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder()

			const sendEvent = (eventType: StreamEvent['type'], data: unknown) => {
				const event: StreamEvent = {
					type: eventType,
					requestId,
					timestamp: new Date().toISOString(),
					data,
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
					messageLength: message.length,
					isResume: !!claudeOptions.resume,
				})

				const q = query({ prompt: message, options: claudeOptions })
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
								sendEvent('session', { sessionId })
							} catch (error) {
								console.error(`[Stream ${requestId}] Failed to save session:`, error)
							}
						}
					}

					// Stream every message to frontend
					const messageData = getMessageStreamData(m)
					sendEvent('message', {
						messageCount,
						...messageData,
					})

					if (m.type === 'result') {
						queryResult = m
						console.log(`[Stream ${requestId}] Got result message`)
					}
				}

				console.log(`[Stream ${requestId}] Query iteration completed. Total messages: ${messageCount}`)

				// Send completion event
				sendEvent('complete', {
					totalMessages: messageCount,
					result: queryResult,
					message: 'Claude query completed successfully',
				})

				console.log(`[Stream ${requestId}] === STREAM SUCCESS ===`)
				controller.close()
			} catch (error) {
				console.error(`[Stream ${requestId}] Stream error:`, error)
				sendEvent('error', {
					error: 'query_failed',
					message: 'Claude SDK query failed',
					details: error instanceof Error ? error.message : 'Unknown error',
					stack: error instanceof Error ? error.stack : undefined,
				})
				controller.close()
			}
		},

		cancel() {
			console.log(`[Stream ${requestId}] Stream cancelled by client`)
		},
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
			Connection: 'keep-alive',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Credentials': 'true',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		},
	})
}
