import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockQueueSync = vi.fn()

vi.mock("../conversationSync", () => ({
  fetchConversations: vi.fn(),
  fetchTabMessages: vi.fn(),
  queueSync: (...args: unknown[]) => mockQueueSync(...args),
  archiveConversation: vi.fn(),
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
  shareConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  unshareConversation: vi.fn(),
}))

import { useDexieMessageStore } from "../dexieMessageStore"
import { getMessageDb } from "../messageDb"

const TEST_USER_ID = "test-user-stream-sync"
const TEST_ORG_ID = "test-org-stream-sync"
const TEST_WORKSPACE = "stream-sync.test"

const TAB_GROUP_A = "tabgroup-a"
const TAB_GROUP_B = "tabgroup-b"
const TAB_A = "tab-a"
const TAB_B = "tab-b"

async function setupStore() {
  const store = useDexieMessageStore.getState()
  store.setSession({ userId: TEST_USER_ID, orgId: TEST_ORG_ID })
  await store.ensureTabGroupWithTab(TEST_WORKSPACE, TAB_GROUP_A, TAB_A)
  await store.ensureTabGroupWithTab(TEST_WORKSPACE, TAB_GROUP_B, TAB_B)
  return store
}

describe("dexie stream sync targeting", () => {
  beforeEach(() => {
    mockQueueSync.mockReset()
    useDexieMessageStore.setState({
      session: null,
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

  it("finalizeAssistantStream syncs the stream tab conversation when current tab changed", async () => {
    const store = await setupStore()
    const streamId = await store.startAssistantStream(TAB_A)
    await store.finalizeAssistantStream(streamId)

    expect(mockQueueSync).toHaveBeenLastCalledWith(TAB_GROUP_A, TEST_USER_ID)
  })

  it("stopAssistantStream syncs the stream tab conversation when current tab changed", async () => {
    const store = await setupStore()
    const streamId = await store.startAssistantStream(TAB_A)
    await store.stopAssistantStream(streamId)

    expect(mockQueueSync).toHaveBeenLastCalledWith(TAB_GROUP_A, TEST_USER_ID)
  })

  it("failAssistantStream syncs the stream tab conversation when current tab changed", async () => {
    const store = await setupStore()
    const streamId = await store.startAssistantStream(TAB_A)
    await store.failAssistantStream(streamId, "test_error")

    expect(mockQueueSync).toHaveBeenLastCalledWith(TAB_GROUP_A, TEST_USER_ID)
  })
})
