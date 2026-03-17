/**
 * Tests for GET /api/conversations endpoint
 *
 * Tests cover:
 * - Authentication required
 * - Workspace parameter is optional (omit for cross-workspace fetch)
 * - Fetching own conversations
 * - Fetching shared conversations from org
 * - Excluding deleted conversations
 * - Data transformation (server → client format)
 * - Pagination (hasMore, nextCursor)
 * - Error handling
 *
 * @vitest-environment node
 */

import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCodes } from "@/lib/error-codes"
import { MOCK_SESSION_USER } from "@/lib/test-helpers/mock-session-user"

// Mock auth
vi.mock("@/features/auth/lib/auth", () => ({
  getSessionUser: vi.fn(),
}))

// Mock Supabase client
//
// The route builds its query as:
//   .from("conversations")
//   .select(...)          ← mockSelect
//   .is("deleted_at", null) ← mockIs
//   .order(...)           ← mockOrder
//   .limit(limit + 1)     ← mockLimit
//   [.eq("workspace", w)] ← mockEq (only when workspace provided)
//   [.lt("updated_at", c)]← mockLt (only when cursor provided)
//
// The final awaited value comes from whichever mock is last in the chain.
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIs = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockLt = vi.fn()

vi.mock("@/lib/supabase/server-rls", () => ({
  createRLSAppClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        select: mockSelect,
      })),
    }),
  ),
}))

// Import after mocking
const { GET } = await import("../route")
const { getSessionUser } = await import("@/features/auth/lib/auth")

// Test data
const TEST_ORG_ID = "org-123"
const TEST_WORKSPACE = "test.example.com"

const TEST_CONVERSATION_DB = {
  conversation_id: "conv-123",
  workspace: TEST_WORKSPACE,
  org_id: TEST_ORG_ID,
  user_id: MOCK_SESSION_USER.id,
  title: "Test Conversation",
  visibility: "private",
  message_count: 5,
  last_message_at: "2026-02-01T10:00:00Z",
  first_user_message_id: "msg-1",
  auto_title_set: false,
  created_at: "2026-02-01T09:00:00Z",
  updated_at: "2026-02-01T10:00:00Z",
  deleted_at: null,
  archived_at: null,
  conversation_tabs: [
    {
      tab_id: "tab-123",
      conversation_id: "conv-123",
      name: "Tab 1",
      position: 0,
      message_count: 5,
      last_message_at: "2026-02-01T10:00:00Z",
      created_at: "2026-02-01T09:00:00Z",
      closed_at: null,
      draft: { text: "Saved draft", attachments: [] },
    },
  ],
}

const TEST_SHARED_CONVERSATION_DB = {
  conversation_id: "conv-456",
  workspace: TEST_WORKSPACE,
  org_id: TEST_ORG_ID,
  user_id: "other-user-789",
  title: "Shared Conversation",
  visibility: "shared",
  message_count: 10,
  last_message_at: "2026-02-01T11:00:00Z",
  first_user_message_id: "msg-10",
  auto_title_set: true,
  created_at: "2026-02-01T08:00:00Z",
  updated_at: "2026-02-01T11:00:00Z",
  deleted_at: null,
  archived_at: null,
  conversation_tabs: [],
}

function createMockRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/conversations")
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

/**
 * Set up the mock chain for a given result.
 *
 * Chain (without workspace/cursor): select → is → order → limit → await
 * Chain (with workspace):           select → is → order → limit → eq → await
 * Chain (with cursor):              select → is → order → limit → lt → await
 * Chain (with both):                select → is → order → limit → eq → lt → await
 *
 * We make every terminal node return the same result object so every variant
 * resolves correctly regardless of which optional chained calls are made.
 */
function setupMockChain(result: { data: unknown[] | null; error: unknown }) {
  // Terminal: awaiting any of these returns the result
  mockLt.mockReturnValue(result)
  mockEq.mockReturnValue({ lt: mockLt, ...result })
  mockLimit.mockReturnValue({ eq: mockEq, lt: mockLt, ...result })
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockIs.mockReturnValue({ order: mockOrder })
  mockSelect.mockReturnValue({ is: mockIs })
}

describe("GET /api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(getSessionUser).mockResolvedValue(MOCK_SESSION_USER)

    // Default DB result: two conversations (one own, one shared)
    setupMockChain({
      data: [TEST_CONVERSATION_DB, TEST_SHARED_CONVERSATION_DB],
      error: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("Authentication", () => {
    it("should require session (401 without user)", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null)

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe(ErrorCodes.UNAUTHORIZED)
    })

    it("should allow authenticated users", async () => {
      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)

      expect(response.status).toBe(200)
    })
  })

  describe("Input Validation", () => {
    it("should return all conversations when workspace is omitted", async () => {
      // workspace is now optional — omitting it fetches across all workspaces
      const req = createMockRequest({})
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.own).toBeDefined()
      expect(data.shared).toBeDefined()
      expect(typeof data.hasMore).toBe("boolean")
      expect("nextCursor" in data).toBe(true)
    })
  })

  describe("Fetching Own Conversations", () => {
    it("should return own conversations for workspace", async () => {
      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.own).toBeDefined()
      expect(Array.isArray(data.own)).toBe(true)
      expect(typeof data.hasMore).toBe("boolean")
      expect("nextCursor" in data).toBe(true)
    })

    it("should transform database format to client format", async () => {
      setupMockChain({ data: [TEST_CONVERSATION_DB], error: null })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.own[0]).toMatchObject({
        id: "conv-123",
        workspace: TEST_WORKSPACE,
        orgId: TEST_ORG_ID,
        title: "Test Conversation",
        visibility: "private",
        messageCount: 5,
      })
    })

    it("should convert timestamps to milliseconds", async () => {
      setupMockChain({ data: [TEST_CONVERSATION_DB], error: null })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      const conv = data.own[0]
      expect(typeof conv.createdAt).toBe("number")
      expect(typeof conv.updatedAt).toBe("number")
      expect(conv.createdAt).toBe(new Date("2026-02-01T09:00:00Z").getTime())
    })

    it("should include tabs with conversations", async () => {
      setupMockChain({ data: [TEST_CONVERSATION_DB], error: null })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.own[0].tabs).toBeDefined()
      expect(data.own[0].tabs.length).toBe(1)
      expect(data.own[0].tabs[0]).toMatchObject({
        id: "tab-123",
        conversationId: "conv-123",
        name: "Tab 1",
        position: 0,
        draft: { text: "Saved draft", attachments: [] },
      })
    })

    it("should map null tab drafts explicitly", async () => {
      setupMockChain({
        data: [
          {
            ...TEST_CONVERSATION_DB,
            conversation_tabs: [{ ...TEST_CONVERSATION_DB.conversation_tabs[0], draft: null }],
          },
        ],
        error: null,
      })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.own[0].tabs[0].draft).toBeNull()
    })
  })

  describe("Fetching Shared Conversations", () => {
    it("should return shared conversations from org", async () => {
      setupMockChain({ data: [TEST_CONVERSATION_DB, TEST_SHARED_CONVERSATION_DB], error: null })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.shared).toBeDefined()
      expect(Array.isArray(data.shared)).toBe(true)
    })

    it("should include creatorId for shared conversations", async () => {
      setupMockChain({ data: [TEST_SHARED_CONVERSATION_DB], error: null })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.shared[0].creatorId).toBe("other-user-789")
    })
  })

  describe("Filtering", () => {
    it("should exclude deleted conversations", async () => {
      // The query should call .is("deleted_at", null)
      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      await GET(req)

      expect(mockIs).toHaveBeenCalledWith("deleted_at", null)
    })

    it("should order by updated_at descending", async () => {
      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      await GET(req)

      expect(mockOrder).toHaveBeenCalledWith("updated_at", { ascending: false })
    })

    it("should apply workspace filter only when workspace is provided", async () => {
      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      await GET(req)

      expect(mockEq).toHaveBeenCalledWith("workspace", TEST_WORKSPACE)
    })

    it("should not apply workspace filter when workspace is omitted", async () => {
      const req = createMockRequest({})
      await GET(req)

      expect(mockEq).not.toHaveBeenCalledWith("workspace", expect.anything())
    })
  })

  describe("Pagination", () => {
    it("should return hasMore: false and nextCursor: null when results fit within limit", async () => {
      // Default limit is 50; returning 2 rows means no next page
      setupMockChain({ data: [TEST_CONVERSATION_DB, TEST_SHARED_CONVERSATION_DB], error: null })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.hasMore).toBe(false)
      expect(data.nextCursor).toBeNull()
    })

    it("should return hasMore: true and nextCursor when results exceed limit", async () => {
      // Request limit=1, return 2 rows (limit+1) to signal there is a next page
      const row1 = { ...TEST_CONVERSATION_DB, updated_at: "2026-02-01T10:00:00Z" }
      const row2 = { ...TEST_SHARED_CONVERSATION_DB, updated_at: "2026-02-01T09:00:00Z" }
      setupMockChain({ data: [row1, row2], error: null })

      const req = createMockRequest({ workspace: TEST_WORKSPACE, limit: "1" })
      const response = await GET(req)
      const data = await response.json()

      expect(data.hasMore).toBe(true)
      // nextCursor is the updated_at of the last item in the page (row1, since only 1 item fits)
      expect(data.nextCursor).toBe(row1.updated_at)
    })

    it("should include hasMore and nextCursor in every successful response", async () => {
      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect("hasMore" in data).toBe(true)
      expect("nextCursor" in data).toBe(true)
    })
  })

  describe("Error Handling", () => {
    it("should return 500 on database error", async () => {
      setupMockChain({ data: null, error: { message: "Database error" } })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe(ErrorCodes.QUERY_FAILED)
    })

    it("should handle empty results gracefully", async () => {
      setupMockChain({ data: [], error: null })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.own).toEqual([])
      expect(data.shared).toEqual([])
      expect(data.hasMore).toBe(false)
      expect(data.nextCursor).toBeNull()
    })
  })

  describe("Source and SourceMetadata Mapping", () => {
    it("should default source to 'chat' when null", async () => {
      setupMockChain({
        data: [{ ...TEST_CONVERSATION_DB, source: null, source_metadata: null }],
        error: null,
      })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.own[0].source).toBe("chat")
      expect(data.own[0].sourceMetadata).toBeNull()
    })

    it("should pass through source when set to 'automation_run'", async () => {
      const metadata = { job_id: "job_123", claim_run_id: "run_456", triggered_by: "cron" }
      setupMockChain({
        data: [{ ...TEST_CONVERSATION_DB, source: "automation_run", source_metadata: metadata }],
        error: null,
      })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.own[0].source).toBe("automation_run")
      expect(data.own[0].sourceMetadata).toEqual(metadata)
    })

    it("should preserve sourceMetadata shape with job_id, claim_run_id, and triggered_by", async () => {
      const metadata = { job_id: "job_abc", claim_run_id: "run_xyz", triggered_by: "manual" }
      setupMockChain({
        data: [{ ...TEST_CONVERSATION_DB, source: "automation_run", source_metadata: metadata }],
        error: null,
      })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.own[0].sourceMetadata).toHaveProperty("job_id", "job_abc")
      expect(data.own[0].sourceMetadata).toHaveProperty("claim_run_id", "run_xyz")
      expect(data.own[0].sourceMetadata).toHaveProperty("triggered_by", "manual")
    })

    it("should return null sourceMetadata when automation metadata is malformed", async () => {
      setupMockChain({
        data: [{ ...TEST_CONVERSATION_DB, source: "automation_run", source_metadata: { job_id: "job_only" } }],
        error: null,
      })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.own[0].source).toBe("automation_run")
      expect(data.own[0].sourceMetadata).toBeNull()
    })
  })

  describe("Null Timestamp Handling", () => {
    it("should handle null last_message_at", async () => {
      setupMockChain({
        data: [{ ...TEST_CONVERSATION_DB, last_message_at: null }],
        error: null,
      })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.own[0].lastMessageAt).toBeNull()
    })

    it("should handle null archived_at and deleted_at", async () => {
      setupMockChain({ data: [TEST_CONVERSATION_DB], error: null })

      const req = createMockRequest({ workspace: TEST_WORKSPACE })
      const response = await GET(req)
      const data = await response.json()

      expect(data.own[0].archivedAt).toBeNull()
      expect(data.own[0].deletedAt).toBeNull()
    })
  })
})
