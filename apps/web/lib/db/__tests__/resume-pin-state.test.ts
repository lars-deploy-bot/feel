import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useDexieMessageStore } from "../dexieMessageStore"
import { getMessageDb } from "../messageDb"

const TEST_USER_ID = "test-user-resume-pin"
const TEST_ORG_ID = "test-org-resume-pin"
const TEST_WORKSPACE = "resume-pin.test"
const TEST_TAB_ID = "tab-resume-pin"
const TEST_TAB_GROUP_ID = "tabgroup-resume-pin"

async function setupStore() {
  const store = useDexieMessageStore.getState()
  store.setSession({ userId: TEST_USER_ID, orgId: TEST_ORG_ID })
  await store.ensureTabGroupWithTab(TEST_WORKSPACE, TEST_TAB_GROUP_ID, TEST_TAB_ID)
  return store
}

describe("dexieMessageStore captureResumeSessionAtFromLatestAssistant", () => {
  beforeEach(() => {
    useDexieMessageStore.setState({
      session: null,
      currentTabGroupId: null,
      currentTabId: null,
      currentWorkspace: null,
      isLoading: false,
      isSyncing: false,
      activeStreamByTab: {},
      streamingBuffers: {},
      resumeSessionAtByTab: {},
    })
  })

  afterEach(async () => {
    const db = getMessageDb(TEST_USER_ID)
    await db.delete()
    await db.open()
  })

  it("captures resume pin from latest visible assistant sdk message", async () => {
    const store = await setupStore()

    await store.addMessage(
      {
        id: "assistant-1",
        type: "sdk_message",
        content: {
          type: "assistant",
          uuid: "assistant-uuid-1",
          message: { role: "assistant", content: [{ type: "text", text: "First" }] },
        },
        timestamp: new Date(),
      },
      TEST_TAB_ID,
    )

    await store.addMessage(
      {
        id: "assistant-2",
        type: "sdk_message",
        content: {
          type: "assistant",
          uuid: "assistant-uuid-2",
          message: { role: "assistant", content: [{ type: "text", text: "Second" }] },
        },
        timestamp: new Date(),
      },
      TEST_TAB_ID,
    )

    const resumeUuid = await store.captureResumeSessionAtFromLatestAssistant(TEST_TAB_ID)

    expect(resumeUuid).toBe("assistant-uuid-2")
    expect(store.getResumeSessionAt(TEST_TAB_ID)).toBe("assistant-uuid-2")
  })

  it("skips soft-deleted assistant messages when capturing resume pin", async () => {
    const store = await setupStore()
    const db = getMessageDb(TEST_USER_ID)

    await store.addMessage(
      {
        id: "assistant-1",
        type: "sdk_message",
        content: {
          type: "assistant",
          uuid: "assistant-uuid-1",
          message: { role: "assistant", content: [{ type: "text", text: "Visible" }] },
        },
        timestamp: new Date(),
      },
      TEST_TAB_ID,
    )

    await store.addMessage(
      {
        id: "assistant-2",
        type: "sdk_message",
        content: {
          type: "assistant",
          uuid: "assistant-uuid-2",
          message: { role: "assistant", content: [{ type: "text", text: "Deleted" }] },
        },
        timestamp: new Date(),
      },
      TEST_TAB_ID,
    )
    await db.messages.update("assistant-2", { deletedAt: Date.now() })

    const resumeUuid = await store.captureResumeSessionAtFromLatestAssistant(TEST_TAB_ID)

    expect(resumeUuid).toBe("assistant-uuid-1")
    expect(store.getResumeSessionAt(TEST_TAB_ID)).toBe("assistant-uuid-1")
  })

  it("returns null when there is no assistant sdk uuid to resume from", async () => {
    const store = await setupStore()

    await store.addMessage(
      {
        id: "user-1",
        type: "user",
        content: "hello",
        timestamp: new Date(),
      },
      TEST_TAB_ID,
    )
    await store.addMessage(
      {
        id: "assistant-no-uuid",
        type: "sdk_message",
        content: {
          type: "assistant",
          message: { role: "assistant", content: [{ type: "text", text: "No uuid" }] },
        },
        timestamp: new Date(),
      },
      TEST_TAB_ID,
    )

    const resumeUuid = await store.captureResumeSessionAtFromLatestAssistant(TEST_TAB_ID)

    expect(resumeUuid).toBeNull()
    expect(store.getResumeSessionAt(TEST_TAB_ID)).toBeNull()
  })
})
