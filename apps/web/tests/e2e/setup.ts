import { type Page, test as base, expect } from "@playwright/test"

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page)
  },
})

export { expect }

interface MockStreamOptions {
  message: string
  delay?: number
}

export async function mockClaudeStream(page: Page, options: MockStreamOptions) {
  await page.route("**/api/claude/stream", async route => {
    const { message, delay = 100 } = options
    const requestId = "test-request"
    const timestamp = new Date().toISOString()

    const events = [
      `event: bridge_start\ndata: ${JSON.stringify({
        type: "start",
        requestId,
        timestamp,
        data: {
          host: "test",
          cwd: "/test",
          message: "Starting Claude query...",
          messageLength: 5,
          isResume: false,
        },
      })}\n\n`,
      `event: bridge_message\ndata: ${JSON.stringify({
        type: "message",
        requestId,
        timestamp,
        data: {
          messageCount: 1,
          messageType: "assistant",
          content: {
            uuid: "test-uuid-123",
            session_id: "test-session",
            type: "assistant",
            message: {
              role: "assistant",
              content: [{ type: "text", text: message }],
              stop_reason: "end_turn",
            },
            parent_tool_use_id: null,
          },
        },
      })}\n\n`,
      `event: bridge_complete\ndata: ${JSON.stringify({
        type: "complete",
        requestId,
        timestamp,
        data: {
          totalMessages: 1,
          totalTurns: 1,
          maxTurns: 25,
          result: null,
          message: "Claude query completed successfully (1/25 turns used)",
        },
      })}\n\n`,
      "event: done\ndata: {}\n\n",
    ]

    await new Promise(resolve => setTimeout(resolve, delay))

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
      body: events.join(""),
    })
  })
}

export async function mockClaudeStreamError(page: Page, errorMessage: string) {
  await page.route("**/api/claude/stream", async route => {
    const requestId = "test-request"
    const timestamp = new Date().toISOString()

    const event = `event: bridge_error\ndata: ${JSON.stringify({
      type: "error",
      requestId,
      timestamp,
      data: {
        error: "QUERY_FAILED",
        code: "QUERY_FAILED",
        message: errorMessage,
        details: errorMessage,
      },
    })}\n\n`

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body: event,
    })
  })
}
