import { describe, expect, it } from "vitest"
import { toUIMessage } from "@/lib/db/messageAdapters"
import type { DbMessage } from "@/lib/db/messageDb"

/**
 * Tests for backward compatibility with automation transcript messages
 * that were persisted with the NDJSON stream envelope (#342).
 *
 * Before the fix, messages were stored as:
 *   { kind: "sdk_message", data: { type: "stream_message", messageType: "assistant", content: <SDK msg> } }
 *
 * After the fix, messages are stored as:
 *   { kind: "sdk_message", data: <SDK msg> }
 *
 * The read path must handle both formats.
 */

function makeDbMessage(data: unknown, seq = 1): DbMessage {
  return {
    id: `msg-${seq}`,
    tabId: "tab-automation",
    type: "sdk_message",
    content: { kind: "sdk_message", data },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    status: "complete",
    origin: "remote",
    seq,
    pendingSync: false,
  }
}

describe("messageAdapters stream envelope unwrapping (#342)", () => {
  it("unwraps legacy wrapped assistant message to sdk_message with correct type", () => {
    const sdkMsg = {
      type: "assistant",
      uuid: "abc-123",
      message: { role: "assistant", content: [{ type: "text", text: "Hello" }] },
    }
    const wrappedData = {
      type: "stream_message",
      messageCount: 1,
      messageType: "assistant",
      content: sdkMsg,
    }

    const ui = toUIMessage(makeDbMessage(wrappedData))

    expect(ui.type).toBe("sdk_message")
    // The content should be the inner SDK message, not the stream envelope
    expect(ui.content).toEqual(sdkMsg)
    // Verify the type guard would now work
    expect((ui.content as Record<string, unknown>).type).toBe("assistant")
  })

  it("unwraps legacy wrapped user (tool_result) message", () => {
    const sdkMsg = {
      type: "user",
      uuid: "def-456",
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
    }
    const wrappedData = {
      type: "stream_message",
      messageCount: 2,
      messageType: "user",
      content: sdkMsg,
    }

    const ui = toUIMessage(makeDbMessage(wrappedData, 2))

    expect(ui.type).toBe("sdk_message")
    expect(ui.content).toEqual(sdkMsg)
    expect((ui.content as Record<string, unknown>).type).toBe("user")
  })

  it("passes through correctly stored SDK messages unchanged", () => {
    const sdkMsg = {
      type: "assistant",
      uuid: "ghi-789",
      message: { role: "assistant", content: [{ type: "text", text: "Direct" }] },
    }

    const ui = toUIMessage(makeDbMessage(sdkMsg))

    expect(ui.type).toBe("sdk_message")
    expect(ui.content).toEqual(sdkMsg)
  })

  it("passes through result messages unchanged", () => {
    const resultMsg = {
      type: "result",
      is_error: false,
      result: "done",
      duration_ms: 1234,
      num_turns: 3,
    }

    const ui = toUIMessage(makeDbMessage(resultMsg))

    expect(ui.type).toBe("sdk_message")
    expect(ui.content).toEqual(resultMsg)
  })

  it("does not unwrap objects that have messageType but null content", () => {
    const weirdData = { messageType: "assistant", content: null }

    const ui = toUIMessage(makeDbMessage(weirdData))

    expect(ui.type).toBe("sdk_message")
    // Should NOT unwrap since content is null
    expect(ui.content).toEqual(weirdData)
  })
})
