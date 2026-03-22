/**
 * Tests for Conversation Sync Service
 *
 * Tests the client-side sync logic including:
 * - Debounced sync queue
 * - Batch sync behavior
 * - Conflict handling
 * - Offline handling
 * - Exponential backoff
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock navigator for Node.js environment (CI)
if (typeof navigator === "undefined") {
  // @ts-expect-error - mocking global navigator for tests
  global.navigator = { onLine: true }
}

// Mock Dexie database
const mockConversationsGet = vi.fn()
const mockConversationsBulkGet = vi.fn()
const mockConversationsUpdate = vi.fn()
const mockConversationsPut = vi.fn()
const mockConversationsBulkPut = vi.fn()
const mockConversationsWhere = vi.fn()
const mockTabsGet = vi.fn()
const mockTabsBulkGet = vi.fn()
const mockTabsWhere = vi.fn()
const mockTabsBulkPut = vi.fn()
const mockTabsPut = vi.fn()
const mockMessagesWhere = vi.fn()
const mockMessagesBulkPut = vi.fn()
const mockMessagesGet = vi.fn()
const mockMessagesPut = vi.fn()

// Mock modules that use @/ path aliases (vitest can't always resolve them in CI)
vi.mock("@/lib/client-error-logger", () => ({
  logError: vi.fn(),
}))

vi.mock("@/lib/conversations/sync-types", async () => {
  const actual = await import("@/lib/conversations/sync-types").catch(() => ({
    MESSAGE_TYPES: ["user", "assistant", "tool_use", "tool_result", "thinking", "system", "sdk_message"],
    MESSAGE_STATUSES: ["streaming", "complete", "interrupted", "error"],
    VALID_MESSAGE_TYPES: new Set(["user", "assistant", "tool_use", "tool_result", "thinking", "system", "sdk_message"]),
    VALID_MESSAGE_STATUSES: new Set(["streaming", "complete", "interrupted", "error"]),
  }))
  return actual
})

vi.mock("@/lib/conversations/source", () => {
  const VALID_SOURCES = new Set(["chat", "automation_run"])
  return {
    normalizeConversationSourcePayload: vi.fn((source: unknown, meta: unknown) => ({
      source: typeof source === "string" && VALID_SOURCES.has(source) ? source : "chat",
      sourceMetadata: meta && typeof meta === "object" && !Array.isArray(meta) ? meta : undefined,
    })),
  }
})

vi.mock("../tabSync", () => ({
  syncDexieTabsToLocalStorage: vi.fn(),
}))

vi.mock("../messageDb", () => ({
  getMessageDb: vi.fn(() => {
    const db = {
      conversations: {
        get: mockConversationsGet,
        bulkGet: mockConversationsBulkGet,
        update: mockConversationsUpdate,
        put: mockConversationsPut,
        bulkPut: mockConversationsBulkPut,
        where: mockConversationsWhere,
      },
      tabs: {
        get: mockTabsGet,
        bulkGet: mockTabsBulkGet,
        where: mockTabsWhere,
        bulkPut: mockTabsBulkPut,
        put: mockTabsPut,
        update: vi.fn().mockResolvedValue(1),
        count: vi.fn().mockResolvedValue(5),
      },
      messages: {
        where: mockMessagesWhere,
        bulkPut: mockMessagesBulkPut,
        get: mockMessagesGet,
        put: mockMessagesPut,
      },
      // Fake Dexie transaction: just run the callback with the same table refs
      transaction: vi.fn(async (_mode: string, _tables: unknown[], fn: () => Promise<void>) => fn()),
    }
    return db
  }),
}))

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Import after mocking
const {
  queueSync,
  forceSyncNow,
  syncFromServer,
  fetchConversations,
  fetchTabMessages,
  shareConversation,
  unshareConversation,
  archiveConversation,
  deleteConversation,
} = await import("../conversationSync")

// Test data
const TEST_USER_ID = "user-123"
const TEST_WORKSPACE = "test.example.com"
const TEST_ORG_ID = "org-123"

const TEST_CONVERSATION = {
  id: "conv-123",
  workspace: TEST_WORKSPACE,
  orgId: TEST_ORG_ID,
  creatorId: TEST_USER_ID,
  title: "Test Conversation",
  visibility: "private",
  messageCount: 5,
  lastMessageAt: Date.now(),
  firstUserMessageId: "msg-1",
  autoTitleSet: false,
  createdAt: Date.now() - 10000,
  updatedAt: Date.now(),
  deletedAt: null,
  archivedAt: null,
  syncedAt: null,
  remoteUpdatedAt: null,
  pendingSync: true,
}

const TEST_TAB = {
  id: "tab-123",
  conversationId: "conv-123",
  name: "Tab 1",
  position: 0,
  messageCount: 5,
  lastMessageAt: Date.now(),
  createdAt: Date.now() - 10000,
  closedAt: null,
  draft: { text: "Draft reply", attachments: [] },
  syncedAt: null,
  pendingSync: true,
}

const TEST_MESSAGE = {
  id: "msg-123",
  tabId: "tab-123",
  type: "user",
  content: { kind: "text", text: "Hello" },
  version: 1,
  status: "complete",
  origin: "local",
  seq: 1,
  abortedAt: null,
  errorCode: null,
  createdAt: Date.now() - 5000,
  updatedAt: Date.now(),
  syncedAt: null,
  pendingSync: true,
}

describe("Conversation Sync Service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Default: online
    Object.defineProperty(navigator, "onLine", { value: true, writable: true })

    // Default mock implementations
    mockConversationsGet.mockResolvedValue(TEST_CONVERSATION)
    mockConversationsBulkGet.mockResolvedValue([])
    mockConversationsUpdate.mockResolvedValue(1)
    mockConversationsPut.mockResolvedValue("conv-123")
    mockConversationsBulkPut.mockResolvedValue([])
    mockConversationsWhere.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
      }),
    })

    mockTabsWhere.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([TEST_TAB]),
      }),
    })
    mockTabsGet.mockResolvedValue(null)
    mockTabsBulkGet.mockResolvedValue([])
    mockTabsBulkPut.mockResolvedValue([])
    mockTabsPut.mockResolvedValue("tab-123")

    mockMessagesWhere.mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        and: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([TEST_MESSAGE]),
        }),
      }),
      between: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([TEST_MESSAGE]),
      }),
    })
    mockMessagesBulkPut.mockResolvedValue([])
    mockMessagesGet.mockResolvedValue(null)
    mockMessagesPut.mockResolvedValue("msg-123")

    // Default: successful sync
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          synced: { conversations: 1, tabs: 1, messages: 1 },
        }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe("queueSync (Debounced)", () => {
    it("should debounce multiple calls within 2 seconds", async () => {
      queueSync("conv-1", TEST_USER_ID)
      queueSync("conv-2", TEST_USER_ID)
      queueSync("conv-3", TEST_USER_ID)

      // Before debounce timeout, no fetch should be called
      expect(mockFetch).not.toHaveBeenCalled()

      // Advance timers by 2 seconds
      await vi.advanceTimersByTimeAsync(2000)

      // Now fetch should be called (batch or single)
      expect(mockFetch).toHaveBeenCalled()
    })

    it("should reset debounce timer on new call", async () => {
      queueSync("conv-1", TEST_USER_ID)

      // Advance 1.5 seconds (less than 2 second debounce)
      await vi.advanceTimersByTimeAsync(1500)

      // New call resets timer
      queueSync("conv-2", TEST_USER_ID)

      // Advance another 1.5 seconds (now 3 seconds from first call, 1.5 from second)
      await vi.advanceTimersByTimeAsync(1500)

      // Still shouldn't have fired (only 1.5 seconds since last call)
      expect(mockFetch).not.toHaveBeenCalled()

      // Advance remaining 0.5 seconds
      await vi.advanceTimersByTimeAsync(500)

      // Now should fire
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe("forceSyncNow", () => {
    it("should bypass debounce and sync immediately", async () => {
      forceSyncNow("conv-123", TEST_USER_ID)

      // Should call fetch immediately (no timer needed)
      await vi.advanceTimersByTimeAsync(0)

      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe("Offline Handling", () => {
    it("should skip sync when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false })

      forceSyncNow("conv-123", TEST_USER_ID)
      await vi.advanceTimersByTimeAsync(0)

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("should skip fetch when offline", async () => {
      Object.defineProperty(navigator, "onLine", { value: false })

      await fetchConversations(TEST_USER_ID, TEST_ORG_ID, TEST_WORKSPACE)

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe("Conflict Handling", () => {
    it("should handle 409 conflict response by clearing then re-evaluating", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            error: "Conflict detected",
            conflict: {
              conversationId: "conv-123",
              localUpdatedAt: Date.now(),
              serverUpdatedAt: Date.now() + 1000,
            },
          }),
      })

      forceSyncNow("conv-123", TEST_USER_ID)
      await vi.advanceTimersByTimeAsync(0)

      // First call clears pendingSync to accept server state
      expect(mockConversationsUpdate).toHaveBeenCalledWith("conv-123", expect.objectContaining({ pendingSync: false }))
    })

    it("should handle batch conflicts without failing entire batch", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            synced: { conversations: 1, tabs: 0, messages: 0 },
            conflicts: [
              {
                conversationId: "conv-123",
                localUpdatedAt: Date.now(),
                serverUpdatedAt: Date.now() + 1000,
              },
            ],
          }),
      })

      // Set up multiple conversations
      mockConversationsGet
        .mockResolvedValueOnce(TEST_CONVERSATION)
        .mockResolvedValueOnce({ ...TEST_CONVERSATION, id: "conv-456" })

      mockTabsWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      })

      // Trigger batch sync
      queueSync("conv-123", TEST_USER_ID)
      queueSync("conv-456", TEST_USER_ID)
      await vi.advanceTimersByTimeAsync(2000)

      // Should handle conflict for first conversation
      expect(mockConversationsUpdate).toHaveBeenCalledWith(
        "conv-123",
        expect.objectContaining({
          pendingSync: false,
        }),
      )
    })
  })

  describe("Exponential Backoff", () => {
    it("should set backoff retry on sync failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"))

      forceSyncNow("conv-123", TEST_USER_ID)
      await vi.advanceTimersByTimeAsync(0)

      expect(mockConversationsUpdate).toHaveBeenCalledWith(
        "conv-123",
        expect.objectContaining({
          lastSyncError: "Network error",
          lastSyncAttemptAt: expect.any(Number),
          nextRetryAt: expect.any(Number),
        }),
      )
    })
  })

  describe("fetchConversations", () => {
    beforeEach(() => {
      // Mock window.location for URL construction
      vi.stubGlobal("window", {
        location: { origin: "http://localhost:3000" },
      })
    })

    afterEach(() => {
      // @ts-expect-error cleanup
      delete global.window
    })

    it("should fetch and store conversations from server", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            own: [
              {
                id: "conv-server-1",
                workspace: TEST_WORKSPACE,
                orgId: TEST_ORG_ID,
                creatorId: TEST_USER_ID,
                title: "Server Conversation",
                visibility: "private",
                messageCount: 10,
                lastMessageAt: Date.now(),
                firstUserMessageId: null,
                autoTitleSet: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                deletedAt: null,
                archivedAt: null,
                tabs: [
                  {
                    id: "tab-server-1",
                    conversationId: "conv-server-1",
                    name: "Tab 1",
                    position: 0,
                    messageCount: 10,
                    lastMessageAt: Date.now(),
                    createdAt: Date.now(),
                    closedAt: null,
                    draft: { text: "Saved draft", attachments: [] },
                  },
                ],
              },
            ],
            shared: [],
            hasMore: false,
            nextCursor: null,
          }),
      })

      mockConversationsBulkGet.mockResolvedValue([null]) // No local version
      mockTabsBulkGet.mockResolvedValue([])

      const result = await fetchConversations(TEST_USER_ID, TEST_ORG_ID, TEST_WORKSPACE)

      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeNull()
      expect(mockConversationsBulkPut).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "conv-server-1",
          pendingSync: false,
          syncedAt: expect.any(Number),
        }),
      ])
      expect(mockTabsBulkPut).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "tab-server-1",
          draft: { text: "Saved draft", attachments: [] },
        }),
      ])
    })

    it("should skip server update if local has pending changes", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            own: [{ ...TEST_CONVERSATION, tabs: [] }],
            shared: [],
            hasMore: false,
            nextCursor: null,
          }),
      })

      // Local has pending changes — bulkGet returns the pending record
      mockConversationsBulkGet.mockResolvedValue([{ ...TEST_CONVERSATION, pendingSync: true }])

      await fetchConversations(TEST_USER_ID, TEST_ORG_ID, TEST_WORKSPACE)

      // Should NOT overwrite local — bulkPut called with empty array
      expect(mockConversationsBulkPut).toHaveBeenCalledWith([])
    })

    it("should preserve null tab drafts from server payloads", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            own: [
              {
                ...TEST_CONVERSATION,
                tabs: [
                  {
                    ...TEST_TAB,
                    id: "tab-server-2",
                    conversationId: TEST_CONVERSATION.id,
                    draft: null,
                  },
                ],
              },
            ],
            shared: [],
            hasMore: false,
            nextCursor: null,
          }),
      })

      mockConversationsBulkGet.mockResolvedValue([null])
      mockTabsBulkGet.mockResolvedValue([])

      await fetchConversations(TEST_USER_ID, TEST_ORG_ID, TEST_WORKSPACE)

      expect(mockTabsBulkPut).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "tab-server-2",
          draft: undefined,
        }),
      ])
    })
  })

  describe("fetchTabMessages", () => {
    beforeEach(() => {
      // Mock window.location for URL construction
      vi.stubGlobal("window", {
        location: { origin: "http://localhost:3000" },
      })
    })

    afterEach(() => {
      // @ts-expect-error cleanup
      delete global.window
    })

    it("should fetch and merge messages from server", async () => {
      const serverMsg = {
        id: "msg-server-1",
        tabId: "tab-123",
        type: "assistant",
        content: { kind: "text", text: "Hello back" },
        version: 1,
        status: "complete",
        seq: 2,
        abortedAt: null,
        errorCode: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: [serverMsg], hasMore: false, nextCursor: null }),
      })

      const result = await fetchTabMessages("tab-123", TEST_USER_ID)

      // Server returned messages — verify they were fetched and result is correct
      expect(mockFetch).toHaveBeenCalled()
      expect(result.hasMore).toBe(false)
      // Messages should include the local ones (from mock's between chain)
      expect(result.messages.length).toBeGreaterThan(0)
    })

    it("should not overwrite pending local messages", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            messages: [{ ...TEST_MESSAGE, id: "msg-pending" }],
            hasMore: false,
          }),
      })

      // Local message has pending changes
      mockMessagesGet.mockResolvedValue({ ...TEST_MESSAGE, id: "msg-pending", pendingSync: true })

      await fetchTabMessages("tab-123", TEST_USER_ID)

      // Pending messages must be preserved: bulkPut should either not be called
      // or be called with an empty array (all pending messages filtered out).
      // The pending message must NOT appear in the bulkPut args.
      const putCalls = mockMessagesBulkPut.mock.calls
      for (const [messages] of putCalls) {
        expect(Array.isArray(messages)).toBe(true)
        if (!Array.isArray(messages)) throw new Error("Expected messages to be an array")
        const ids = messages.map((m: { id: string }) => m.id)
        expect(ids).not.toContain("msg-pending")
      }
    })
  })

  describe("Conversation Operations", () => {
    describe("shareConversation", () => {
      it("should update visibility and trigger sync", async () => {
        await shareConversation("conv-123", TEST_USER_ID)

        expect(mockConversationsUpdate).toHaveBeenCalledWith("conv-123", {
          visibility: "shared",
          updatedAt: expect.any(Number),
          pendingSync: true,
        })

        // Should trigger immediate sync
        await vi.advanceTimersByTimeAsync(0)
        expect(mockFetch).toHaveBeenCalled()
      })
    })

    describe("unshareConversation", () => {
      it("should update visibility to private", async () => {
        await unshareConversation("conv-123", TEST_USER_ID)

        expect(mockConversationsUpdate).toHaveBeenCalledWith("conv-123", {
          visibility: "private",
          updatedAt: expect.any(Number),
          pendingSync: true,
        })
      })
    })

    describe("archiveConversation", () => {
      it("should set archivedAt timestamp", async () => {
        await archiveConversation("conv-123", TEST_USER_ID)

        expect(mockConversationsUpdate).toHaveBeenCalledWith("conv-123", {
          archivedAt: expect.any(Number),
          updatedAt: expect.any(Number),
          pendingSync: true,
        })
      })
    })

    describe("deleteConversation", () => {
      it("should soft delete with deletedAt timestamp", async () => {
        await deleteConversation("conv-123", TEST_USER_ID)

        expect(mockConversationsUpdate).toHaveBeenCalledWith("conv-123", {
          deletedAt: expect.any(Number),
          updatedAt: expect.any(Number),
          pendingSync: true,
        })
      })
    })
  })

  describe("Source and SourceMetadata Persistence", () => {
    beforeEach(() => {
      // Mock window.location for URL construction
      vi.stubGlobal("window", {
        location: { origin: "http://localhost:3000" },
      })
    })

    afterEach(() => {
      // @ts-expect-error cleanup
      delete global.window
    })

    it("should persist source and sourceMetadata from server to Dexie", async () => {
      const metadata = { job_id: "job_123", claim_run_id: "run_456", triggered_by: "cron" }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            own: [
              {
                ...TEST_CONVERSATION,
                source: "automation_run",
                sourceMetadata: metadata,
                tabs: [],
                pendingSync: false,
              },
            ],
            shared: [],
            hasMore: false,
            nextCursor: null,
          }),
      })

      mockConversationsBulkGet.mockResolvedValue([null]) // No local version

      await fetchConversations(TEST_USER_ID, TEST_ORG_ID, TEST_WORKSPACE)

      expect(mockConversationsBulkPut).toHaveBeenCalledWith([
        expect.objectContaining({
          source: "automation_run",
          sourceMetadata: metadata,
        }),
      ])
    })

    it("should default source to 'chat' when server returns no source", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            own: [
              {
                ...TEST_CONVERSATION,
                source: undefined,
                sourceMetadata: undefined,
                tabs: [],
                pendingSync: false,
              },
            ],
            shared: [],
            hasMore: false,
            nextCursor: null,
          }),
      })

      mockConversationsBulkGet.mockResolvedValue([null])

      await fetchConversations(TEST_USER_ID, TEST_ORG_ID, TEST_WORKSPACE)

      expect(mockConversationsBulkPut).toHaveBeenCalledWith([
        expect.objectContaining({
          source: "chat",
        }),
      ])
    })

    it("should reject invalid source values and default to 'chat'", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            own: [
              {
                ...TEST_CONVERSATION,
                source: "invalid_source",
                sourceMetadata: null,
                tabs: [],
                pendingSync: false,
              },
            ],
            shared: [],
            hasMore: false,
            nextCursor: null,
          }),
      })

      mockConversationsBulkGet.mockResolvedValue([null])

      await fetchConversations(TEST_USER_ID, TEST_ORG_ID, TEST_WORKSPACE)

      expect(mockConversationsBulkPut).toHaveBeenCalledWith([
        expect.objectContaining({
          source: "chat",
        }),
      ])
    })

    it("should reject malformed sourceMetadata (array, missing fields)", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            own: [
              {
                ...TEST_CONVERSATION,
                source: "automation_run",
                sourceMetadata: [1, 2, 3], // array, not object
                tabs: [],
                pendingSync: false,
              },
            ],
            shared: [],
            hasMore: false,
            nextCursor: null,
          }),
      })

      mockConversationsBulkGet.mockResolvedValue([null])

      await fetchConversations(TEST_USER_ID, TEST_ORG_ID, TEST_WORKSPACE)

      expect(mockConversationsBulkPut).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceMetadata: undefined,
        }),
      ])
    })

    it("should default sourceMetadata to undefined when null", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            own: [
              {
                ...TEST_CONVERSATION,
                source: "chat",
                sourceMetadata: null,
                tabs: [],
                pendingSync: false,
              },
            ],
            shared: [],
            hasMore: false,
            nextCursor: null,
          }),
      })

      mockConversationsBulkGet.mockResolvedValue([null])

      await fetchConversations(TEST_USER_ID, TEST_ORG_ID, TEST_WORKSPACE)

      expect(mockConversationsBulkPut).toHaveBeenCalledWith([
        expect.objectContaining({
          source: "chat",
          sourceMetadata: undefined,
        }),
      ])
    })
  })

  describe("syncFromServer", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        location: { origin: "http://localhost:3000" },
      })

      // Default: no pending messages, no orphans, no reconciliation needed
      mockMessagesWhere.mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0),
          }),
        }),
        between: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        }),
      })

      mockTabsWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        }),
        anyOf: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      })
    })

    afterEach(() => {
      // @ts-expect-error cleanup
      delete global.window
    })

    it("should return stats after syncing", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            own: [{ ...TEST_CONVERSATION, tabs: [] }],
            shared: [],
            hasMore: false,
            nextCursor: null,
          }),
      })

      mockConversationsBulkGet.mockResolvedValue([null])
      mockConversationsWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(3),
          toArray: vi.fn().mockResolvedValue([]),
        }),
      })

      const result = await syncFromServer(TEST_WORKSPACE, TEST_USER_ID, TEST_ORG_ID)

      expect(result.isOffline).toBe(false)
      expect(result.conversations).toBe(3)
    })

    it("should indicate offline status", async () => {
      Object.defineProperty(navigator, "onLine", { value: false })

      const result = await syncFromServer(TEST_WORKSPACE, TEST_USER_ID, TEST_ORG_ID)

      expect(result.isOffline).toBe(true)
      expect(result.conversations).toBe(0)
    })
  })

  describe("handleConflict recovery", () => {
    it("should re-queue conversation when pending messages exist after 409", async () => {
      // Setup: conversation has a pending message
      const pendingMessage = { ...TEST_MESSAGE, pendingSync: true, status: "complete" }

      mockTabsWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([TEST_TAB]),
        }),
      })

      mockMessagesWhere.mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([pendingMessage]),
            count: vi.fn().mockResolvedValue(1),
          }),
        }),
        between: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([pendingMessage]),
        }),
      })

      // 409 conflict response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            conflict: {
              conversationId: "conv-123",
              localUpdatedAt: Date.now(),
              serverUpdatedAt: Date.now() + 1000,
            },
          }),
      })

      forceSyncNow("conv-123", TEST_USER_ID)
      await vi.advanceTimersByTimeAsync(0)

      // handleConflict should first clear pendingSync, then re-mark it
      const updateCalls = mockConversationsUpdate.mock.calls
      const lastUpdate = updateCalls[updateCalls.length - 1]
      expect(lastUpdate[0]).toBe("conv-123")
      expect(lastUpdate[1]).toMatchObject({ pendingSync: true })
    })

    it("should NOT re-queue if no pending messages exist after 409", async () => {
      // No pending messages
      mockTabsWhere.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([{ ...TEST_TAB, pendingSync: false }]),
        }),
      })

      mockMessagesWhere.mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0),
          }),
        }),
        between: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            conflict: {
              conversationId: "conv-123",
              localUpdatedAt: Date.now(),
              serverUpdatedAt: Date.now() + 1000,
            },
          }),
      })

      forceSyncNow("conv-123", TEST_USER_ID)
      await vi.advanceTimersByTimeAsync(0)

      // Should only set pendingSync: false (no re-queue)
      const updateCalls = mockConversationsUpdate.mock.calls
      const lastUpdate = updateCalls[updateCalls.length - 1]
      expect(lastUpdate[1]).toMatchObject({ pendingSync: false })
    })
  })

  describe("fetchTabMessages 404 re-queue", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        location: { origin: "http://localhost:3000" },
      })
    })

    afterEach(() => {
      // @ts-expect-error cleanup
      delete global.window
    })

    it("should re-queue conversation when server returns 404 but local has pending messages", async () => {
      const pendingMsg = { ...TEST_MESSAGE, pendingSync: true }

      mockMessagesWhere.mockReturnValue({
        between: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([pendingMsg]),
        }),
      })

      mockTabsGet.mockResolvedValue(TEST_TAB)

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not found" }),
      })

      await fetchTabMessages("tab-123", TEST_USER_ID)

      // Should re-queue the conversation for sync
      expect(mockConversationsUpdate).toHaveBeenCalledWith("conv-123", expect.objectContaining({ pendingSync: true }))
    })

    it("should NOT re-queue when 404 and no pending local messages", async () => {
      mockMessagesWhere.mockReturnValue({
        between: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([{ ...TEST_MESSAGE, pendingSync: false }]),
        }),
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not found" }),
      })

      await fetchTabMessages("tab-123", TEST_USER_ID)

      // Should NOT call conversations.update to re-queue
      expect(mockConversationsUpdate).not.toHaveBeenCalled()
    })
  })
})
