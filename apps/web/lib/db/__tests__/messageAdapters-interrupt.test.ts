import { describe, expect, it } from "vitest"
import { BridgeInterruptSource, InterruptStatus } from "@/features/chat/lib/streaming/ndjson"
import { toDbMessage, toUIMessage } from "@/lib/db/messageAdapters"
import type { DbMessage } from "@/lib/db/messageDb"

describe("messageAdapters interrupt mapping", () => {
  it("restores persisted interrupt message as UI interrupt type", () => {
    const dbMessage: DbMessage = {
      id: "msg-interrupt-1",
      tabId: "tab-1",
      type: "system",
      content: {
        kind: "sdk_message",
        data: {
          message: "Response stopped.",
          source: BridgeInterruptSource.CLIENT_CANCEL,
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      status: "complete",
      origin: "local",
      seq: 1,
      pendingSync: false,
    }

    const uiMessage = toUIMessage(dbMessage)

    expect(uiMessage.type).toBe("interrupt")
    expect(uiMessage.content).toEqual({
      message: "Response stopped.",
      source: BridgeInterruptSource.CLIENT_CANCEL,
    })
  })

  it("round-trips interrupt UI messages through db adapters", () => {
    const interruptMessage = {
      id: "msg-interrupt-2",
      type: "interrupt" as const,
      content: {
        message: "Response stopped.",
        source: BridgeInterruptSource.CLIENT_CANCEL,
        status: InterruptStatus.STOPPED,
        details: {
          stopId: "stop-123",
          cancelStatus: "cancelled" as const,
          verificationResult: "skipped" as const,
          verificationAttempts: 0,
        },
      },
      timestamp: new Date(),
    }

    const dbMessage = toDbMessage(interruptMessage, "tab-1", 2)
    const uiMessage = toUIMessage(dbMessage)

    expect(uiMessage.type).toBe("interrupt")
    expect(uiMessage.content).toEqual(interruptMessage.content)
  })
})
