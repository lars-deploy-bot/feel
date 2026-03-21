import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { useDexieMessageStore } from "../dexieMessageStore"
import { getMessageDb } from "../messageDb"

const TEST_USER_ID = "test-user-tool-state"
const TEST_ORG_ID = "test-org-tool-state"
const TEST_WORKSPACE = "tool-state.test.com"
const TEST_TAB_ID = "tab-tool-state"
const TEST_TAB_GROUP_ID = "tabgroup-tool-state"

function sdkMessage(id: string, content: object): UIMessage {
  return {
    id,
    type: "sdk_message",
    content,
    timestamp: new Date(),
  }
}

describe("updateToolResultContentByToolUseId", () => {
  beforeEach(async () => {
    const store = useDexieMessageStore.getState()
    store.setSession({ userId: TEST_USER_ID, orgId: TEST_ORG_ID })
    await store.ensureTabGroupWithTab(TEST_WORKSPACE, TEST_TAB_GROUP_ID, TEST_TAB_ID)
  })

  afterEach(async () => {
    const db = getMessageDb(TEST_USER_ID)
    await db.delete()
    await db.open()
  })

  it("updates the matching tool_result block and marks message pending sync", async () => {
    const store = useDexieMessageStore.getState()
    const db = getMessageDb(TEST_USER_ID)

    await store.addMessage(
      sdkMessage("tool-result-msg", {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_email_1",
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    to: ["user@example.com"],
                    subject: "Re: FW: Online versie",
                    body: "Body",
                    status: "draft",
                  }),
                },
              ],
            },
          ],
        },
      }),
      TEST_TAB_ID,
    )

    const updated = await store.updateToolResultContentByToolUseId(TEST_TAB_ID, "toolu_email_1", content => {
      if (!Array.isArray(content)) throw new Error("Expected array content")
      const block = content[0]
      if (!block || typeof block !== "object" || !("text" in block) || typeof block.text !== "string")
        throw new Error("Expected text field")
      const parsed: Record<string, unknown> = JSON.parse(block.text)
      const next = [{ ...block, text: JSON.stringify({ ...parsed, status: "sent", id: "gmail-msg-1" }) }]
      return next
    })

    expect(updated).toBe(true)

    const message = await db.messages.get("tool-result-msg")
    expect(message?.pendingSync).toBe(true)
    expect(message?.content.kind).toBe("sdk_message")

    const messageContent = message?.content
    expect(messageContent).toHaveProperty("kind", "sdk_message")
    expect(messageContent).toHaveProperty("data")

    const sdkData = (messageContent && "data" in messageContent ? messageContent.data : undefined) satisfies unknown
    expect(sdkData).toBeDefined()
    if (!sdkData || typeof sdkData !== "object") throw new Error("Expected sdk data object")

    const sdkMsg = "message" in sdkData ? sdkData.message : undefined
    expect(sdkMsg).toBeDefined()
    if (!sdkMsg || typeof sdkMsg !== "object") throw new Error("Expected message object")

    const sdkContent = "content" in sdkMsg ? sdkMsg.content : undefined
    expect(sdkContent).toBeDefined()
    if (!Array.isArray(sdkContent)) throw new Error("Expected content array")

    const toolResultBlock = sdkContent[0]
    expect(toolResultBlock).toHaveProperty("content")
    if (!toolResultBlock || typeof toolResultBlock !== "object" || !("content" in toolResultBlock))
      throw new Error("Expected tool result block")

    const innerContent = toolResultBlock.content
    if (!Array.isArray(innerContent)) throw new Error("Expected inner content array")

    const textBlock = innerContent[0]
    if (!textBlock || typeof textBlock !== "object" || !("text" in textBlock)) throw new Error("Expected text block")
    if (typeof textBlock.text !== "string") throw new Error("Expected text string")

    const payload: Record<string, unknown> = JSON.parse(textBlock.text)

    expect(payload.status).toBe("sent")
    expect(payload.id).toBe("gmail-msg-1")
  })
})
