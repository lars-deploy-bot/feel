import { describe, expect, it, vi } from "vitest"
import { persistRunMessage, shouldPersist, unwrapStreamEnvelope, updateConversationMetadata } from "../messages"

// =============================================================================
// Helpers
// =============================================================================

function mockSupabase(insertResult: { error: { message: string } | null } = { error: null }) {
  const inserted: Record<string, unknown>[] = []

  const supabase = {
    from: vi.fn((_table: string) => ({
      insert: vi.fn((data: Record<string, unknown>) => {
        inserted.push(data)
        return Promise.resolve(insertResult)
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  }

  return { supabase, inserted }
}

// =============================================================================
// shouldPersist — IPC-level filtering
// =============================================================================

describe("shouldPersist", () => {
  it("returns false for session IPC type", () => {
    expect(shouldPersist({ type: "session", requestId: "r1", sessionId: "s1" })).toBe(false)
  })

  it("returns false for complete IPC type", () => {
    expect(shouldPersist({ type: "complete", result: {} })).toBe(false)
  })

  it("returns false when type is missing", () => {
    expect(shouldPersist({ data: "something" })).toBe(false)
  })

  it("returns false when content is not an object", () => {
    expect(shouldPersist({ type: "message", content: "string" })).toBe(false)
  })

  it("returns false when content is null", () => {
    expect(shouldPersist({ type: "message", content: null })).toBe(false)
  })

  it("returns false when content has no messageType or role", () => {
    expect(shouldPersist({ type: "message", content: { data: "something" } })).toBe(false)
  })

  // ===========================================================================
  // SDK-level filtering (worker pool path via messageType)
  // ===========================================================================

  it("returns true for assistant messageType", () => {
    expect(shouldPersist({ type: "message", content: { messageType: "assistant", content: {} } })).toBe(true)
  })

  it("returns true for user messageType", () => {
    expect(shouldPersist({ type: "message", content: { messageType: "user", content: {} } })).toBe(true)
  })

  it("returns true for result messageType", () => {
    expect(shouldPersist({ type: "message", content: { messageType: "result", content: {} } })).toBe(true)
  })

  it("returns false for system messageType (init, compaction, status)", () => {
    expect(shouldPersist({ type: "message", content: { messageType: "system", content: {} } })).toBe(false)
  })

  it("returns false for tool_progress messageType", () => {
    expect(shouldPersist({ type: "message", content: { messageType: "tool_progress" } })).toBe(false)
  })

  it("returns false for auth_status messageType", () => {
    expect(shouldPersist({ type: "message", content: { messageType: "auth_status" } })).toBe(false)
  })

  // ===========================================================================
  // Direct SDK path (via role)
  // ===========================================================================

  it("returns true for assistant role (direct SDK path)", () => {
    expect(shouldPersist({ type: "message", content: { role: "assistant", content: [] } })).toBe(true)
  })

  it("returns true for user role (direct SDK path)", () => {
    expect(shouldPersist({ type: "message", content: { role: "user", content: [] } })).toBe(true)
  })
})

// =============================================================================
// unwrapStreamEnvelope — extract SDK message from worker pool envelope
// =============================================================================

describe("unwrapStreamEnvelope", () => {
  it("unwraps worker pool stream envelope to inner SDK message", () => {
    const sdkMessage = { type: "assistant", uuid: "abc", message: { role: "assistant", content: [] } }
    const envelope = {
      type: "stream_message",
      messageCount: 1,
      messageType: "assistant",
      content: sdkMessage,
    }

    expect(unwrapStreamEnvelope(envelope)).toEqual(sdkMessage)
  })

  it("unwraps user message envelope", () => {
    const sdkMessage = { type: "user", uuid: "def", message: { role: "user", content: [] } }
    const envelope = {
      type: "stream_message",
      messageCount: 2,
      messageType: "user",
      content: sdkMessage,
    }

    expect(unwrapStreamEnvelope(envelope)).toEqual(sdkMessage)
  })

  it("passes through direct SDK messages unchanged", () => {
    const directSdkMessage = { role: "assistant", content: [{ type: "text", text: "hello" }] }

    expect(unwrapStreamEnvelope(directSdkMessage)).toEqual(directSdkMessage)
  })

  it("passes through non-object values unchanged", () => {
    expect(unwrapStreamEnvelope("string")).toBe("string")
    expect(unwrapStreamEnvelope(42)).toBe(42)
    expect(unwrapStreamEnvelope(null)).toBe(null)
  })

  it("passes through objects without messageType unchanged", () => {
    const msg = { type: "assistant", message: { content: [] } }
    expect(unwrapStreamEnvelope(msg)).toEqual(msg)
  })

  it("does not unwrap when content is null", () => {
    const msg = { messageType: "assistant", content: null }
    expect(unwrapStreamEnvelope(msg)).toEqual(msg)
  })
})

// =============================================================================
// persistRunMessage
// =============================================================================

describe("persistRunMessage", () => {
  it("wraps content as { kind: 'sdk_message', data: ... } for DbMessageContent compatibility", async () => {
    const { supabase, inserted } = mockSupabase()
    const sdkMessage = { type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }

    const result = await persistRunMessage({
      supabase: supabase as never,
      tabId: "tab_123",
      seq: 1,
      sdkMessage,
    })

    expect(result).toBe(true)
    expect(supabase.from).toHaveBeenCalledWith("messages")
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toEqual({
      tab_id: "tab_123",
      seq: 1,
      type: "sdk_message",
      content: { kind: "sdk_message", data: sdkMessage },
      status: "complete",
      version: 1,
    })
  })

  it("returns false on DB error without throwing", async () => {
    const { supabase } = mockSupabase({ error: { message: "DB down" } })

    const result = await persistRunMessage({
      supabase: supabase as never,
      tabId: "tab_123",
      seq: 5,
      sdkMessage: { type: "assistant" },
    })

    expect(result).toBe(false)
  })

  it("returns false on unexpected exception without throwing", async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error("unexpected crash")
      }),
    }

    const result = await persistRunMessage({
      supabase: supabase as never,
      tabId: "tab_123",
      seq: 3,
      sdkMessage: {},
    })

    expect(result).toBe(false)
  })
})

// =============================================================================
// updateConversationMetadata
// =============================================================================

describe("updateConversationMetadata", () => {
  it("updates tab and conversation counts", async () => {
    const tabUpdateArgs: Record<string, unknown>[] = []
    const convUpdateArgs: Record<string, unknown>[] = []

    const supabase = {
      from: vi.fn((table: string) => ({
        update: vi.fn((data: Record<string, unknown>) => {
          if (table === "conversation_tabs") tabUpdateArgs.push(data)
          if (table === "conversations") convUpdateArgs.push(data)
          return {
            eq: vi.fn(() => Promise.resolve({ error: null })),
          }
        }),
      })),
    }

    await updateConversationMetadata({
      supabase: supabase as never,
      conversationId: "conv_1",
      tabId: "tab_1",
      messageCount: 15,
    })

    expect(tabUpdateArgs).toHaveLength(1)
    expect(tabUpdateArgs[0].message_count).toBe(15)
    expect(tabUpdateArgs[0].last_message_at).toBeDefined()

    expect(convUpdateArgs).toHaveLength(1)
    expect(convUpdateArgs[0].message_count).toBe(15)
    expect(convUpdateArgs[0].last_message_at).toBeDefined()
    expect(convUpdateArgs[0].updated_at).toBeDefined()
  })

  it("does not throw on DB errors", async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: { message: "DB error" } })),
        })),
      })),
    }

    // Should not throw
    await updateConversationMetadata({
      supabase: supabase as never,
      conversationId: "conv_1",
      tabId: "tab_1",
      messageCount: 5,
    })
  })
})
