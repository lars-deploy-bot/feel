/**
 * Type-safe Claude SSE stream builder
 *
 * Uses actual StreamEvent types from production code to ensure
 * mocks stay in sync with reality.
 */
import type { StreamEvent } from "@/app/features/claude/streamHandler"

const FIXED_TIMESTAMP = "2025-01-01T00:00:00.000Z"
const FIXED_REQUEST_ID = "test-req-123"

export class StreamBuilder {
  private events: StreamEvent[] = []
  private msgCount = 0

  /**
   * Add a 'start' event
   */
  start(cwd = "/test", host = "test"): this {
    this.events.push({
      type: "start",
      requestId: FIXED_REQUEST_ID,
      timestamp: FIXED_TIMESTAMP,
      data: {
        host,
        cwd,
        message: "Starting Claude query...",
        messageLength: 100,
        isResume: false,
      },
    })
    return this
  }

  /**
   * Add an assistant text message
   */
  text(content: string): this {
    this.msgCount++
    this.events.push({
      type: "message",
      requestId: FIXED_REQUEST_ID,
      timestamp: FIXED_TIMESTAMP,
      data: {
        messageCount: this.msgCount,
        messageType: "assistant",
        content: {
          uuid: `uuid-${this.msgCount}`,
          session_id: "test-session",
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: content }],
            stop_reason: "end_turn",
          },
          parent_tool_use_id: null,
        },
      },
    })
    return this
  }

  /**
   * Add a thinking block
   */
  thinking(content: string): this {
    this.msgCount++
    this.events.push({
      type: "message",
      requestId: FIXED_REQUEST_ID,
      timestamp: FIXED_TIMESTAMP,
      data: {
        messageCount: this.msgCount,
        messageType: "assistant",
        content: {
          uuid: `uuid-${this.msgCount}`,
          session_id: "test-session",
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "thinking", thinking: content }],
            stop_reason: "end_turn",
          },
          parent_tool_use_id: null,
        },
      },
    })
    return this
  }

  /**
   * Add a tool use + tool result pair
   */
  tool(name: string, input: Record<string, unknown>, result: string, isError = false): this {
    // Tool use message
    this.msgCount++
    const toolId = `tool-${this.msgCount}`

    this.events.push({
      type: "message",
      requestId: FIXED_REQUEST_ID,
      timestamp: FIXED_TIMESTAMP,
      data: {
        messageCount: this.msgCount,
        messageType: "assistant",
        content: {
          uuid: `uuid-${this.msgCount}`,
          session_id: "test-session",
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: toolId, name, input }],
            stop_reason: "tool_use",
          },
          parent_tool_use_id: null,
        },
      },
    })

    // Tool result message
    this.msgCount++
    this.events.push({
      type: "message",
      requestId: FIXED_REQUEST_ID,
      timestamp: FIXED_TIMESTAMP,
      data: {
        messageCount: this.msgCount,
        messageType: "user",
        content: {
          uuid: `uuid-${this.msgCount}`,
          session_id: "test-session",
          type: "user",
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolId,
                content: result,
                is_error: isError,
              },
            ],
          },
        },
      },
    })

    return this
  }

  /**
   * Add a session event
   */
  session(sessionId = "test-session-123"): this {
    this.events.push({
      type: "session",
      requestId: FIXED_REQUEST_ID,
      timestamp: FIXED_TIMESTAMP,
      data: { sessionId },
    })
    return this
  }

  /**
   * Add a complete event
   */
  complete(
    data?: Partial<{
      totalMessages: number
      totalTurns: number
      maxTurns: number
    }>,
  ): this {
    this.events.push({
      type: "complete",
      requestId: FIXED_REQUEST_ID,
      timestamp: FIXED_TIMESTAMP,
      data: {
        totalMessages: this.msgCount,
        totalTurns: 1,
        maxTurns: 25,
        result: null,
        message: "Claude query completed successfully (1/25 turns used)",
        ...data,
      },
    })
    return this
  }

  /**
   * Add an error event
   */
  error(message: string, code = "QUERY_FAILED"): this {
    this.events.push({
      type: "error",
      requestId: FIXED_REQUEST_ID,
      timestamp: FIXED_TIMESTAMP,
      data: {
        error: code,
        code,
        message,
        details: message,
      },
    })
    return this
  }

  /**
   * Convert to SSE format
   */
  toSSE(): string {
    const lines = this.events.map(e => `event: bridge_${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
    lines.push("event: done\ndata: {}\n\n")
    return lines.join("")
  }
}
