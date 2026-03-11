import { describe, expect, it } from "vitest"
import { parseStreamEvent, type StreamEvent } from "@/features/chat/lib/message-parser"
import { BridgeStreamType } from "@/features/chat/lib/streaming/ndjson"
import { useStreamingStore } from "@/lib/stores/streamingStore"

describe("parseStreamEvent", () => {
  it("maps assistant billing_error to a user-facing result error", () => {
    const event: StreamEvent = {
      type: BridgeStreamType.MESSAGE,
      requestId: "req-billing",
      timestamp: "2026-02-17T12:00:00.000Z",
      data: {
        messageCount: 1,
        messageType: "assistant",
        content: {
          type: "assistant",
          error: "billing_error",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Credit balance is too low" }],
          },
        },
      },
    }

    const parsed = parseStreamEvent(event)
    expect(parsed).not.toBeNull()
    expect(parsed?.type).toBe("sdk_message")
    expect((parsed?.content as { type: string }).type).toBe("result")
    expect((parsed?.content as { is_error: boolean }).is_error).toBe(true)
    expect((parsed?.content as { result: string }).result).toContain("platform credits are not affected")
    expect((parsed?.content as { result: string }).result).not.toContain("Credit balance is too low")
  })

  it("normalizes tool_result metadata using the same tool registry as live streaming", () => {
    const tabId = "tab-tool-metadata"
    const streamingActions = useStreamingStore.getState().actions
    streamingActions.clearTab(tabId)

    const assistantEvent: StreamEvent = {
      type: BridgeStreamType.MESSAGE,
      requestId: "req-tools",
      timestamp: "2026-03-09T12:00:00.000Z",
      data: {
        messageCount: 1,
        messageType: "assistant",
        content: {
          type: "assistant",
          uuid: "assistant-1",
          parent_tool_use_id: null,
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: "toolu_read", name: "Read", input: { file_path: "/tmp/file.ts" } }],
          },
        },
      },
    }

    parseStreamEvent(assistantEvent, tabId, streamingActions)

    const userEvent: StreamEvent = {
      type: BridgeStreamType.MESSAGE,
      requestId: "req-tools",
      timestamp: "2026-03-09T12:00:01.000Z",
      data: {
        messageCount: 2,
        messageType: "user",
        content: {
          type: "user",
          uuid: "user-1",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "toolu_read", content: "ok" }],
          },
        },
      },
    }

    const parsed = parseStreamEvent(userEvent, tabId, streamingActions)
    expect(parsed?.type).toBe("sdk_message")

    const parsedContent = parsed?.content
    if (!parsedContent || typeof parsedContent !== "object" || Array.isArray(parsedContent)) {
      throw new Error("Expected parsed SDK message content")
    }
    if (!("message" in parsedContent) || typeof parsedContent.message !== "object" || parsedContent.message === null) {
      throw new Error("Expected SDK user message body")
    }
    if (!("content" in parsedContent.message) || !Array.isArray(parsedContent.message.content)) {
      throw new Error("Expected SDK user content blocks")
    }

    const [toolResult] = parsedContent.message.content
    if (!toolResult || typeof toolResult !== "object" || Array.isArray(toolResult)) {
      throw new Error("Expected tool_result block")
    }

    expect(toolResult.tool_name).toBe("Read")
    expect(toolResult.tool_input).toEqual({ file_path: "/tmp/file.ts" })
    expect(streamingActions.getPendingTools(tabId)).toEqual([])
  })
})
