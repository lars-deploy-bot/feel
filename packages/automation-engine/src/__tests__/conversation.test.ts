import { beforeEach, describe, expect, it, vi } from "vitest"
import { bootstrapRunConversation } from "../conversation"
import type { RunContext } from "../types"

// =============================================================================
// Helpers
// =============================================================================

function mockSupabase() {
  const inserted: Record<string, Record<string, unknown>[]> = {
    conversations: [],
    conversation_tabs: [],
  }
  const deleted: Record<string, { eq: [string, string] }[]> = {
    conversations: [],
  }

  const supabase = {
    from: vi.fn((table: string) => ({
      insert: vi.fn((data: Record<string, unknown>) => {
        inserted[table]?.push(data)
        return Promise.resolve({ error: null })
      }),
      delete: vi.fn(() => ({
        eq: vi.fn((col: string, val: string) => {
          deleted[table]?.push({ eq: [col, val] })
          return Promise.resolve({ error: null })
        }),
      })),
    })),
  }

  return { supabase, inserted, deleted }
}

function makeCtx(supabase: unknown): RunContext {
  return {
    supabase,
    job: {
      id: "job_123",
      name: "Daily sync",
      site_id: "site_1",
      user_id: "user_abc",
      org_id: "org_xyz",
      is_active: true,
      status: "running" as const,
      trigger_type: "cron" as const,
      action_type: "prompt" as const,
      action_prompt: "do stuff",
      action_timeout_seconds: 300,
      cron_schedule: "0 * * * *",
      cron_timezone: null,
      consecutive_failures: 0,
      running_at: "2026-02-28T12:00:00Z",
      run_at: null,
      next_run_at: null,
      last_run_at: null,
      last_run_status: null,
      last_run_error: null,
      last_run_duration_ms: null,
      delete_after_run: false,
      skills: null,
      webhook_secret: null,
      email_address: null,
      description: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      run_id: "run_456",
      claimed_by: "srv_test",
      lease_expires_at: null,
      action_model: null,
      action_thinking: null,
      action_source: null,
      action_target_page: null,
      action_format_prompt: null,
    },
    hostname: "test.alive.best",
    runId: "run_456",
    claimedAt: "2026-02-28T12:00:00Z",
    serverId: "srv_test",
    timeoutSeconds: 300,
    triggeredBy: "scheduler" as const,
    heartbeatInterval: null,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("bootstrapRunConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates conversation and tab, returns IDs", async () => {
    const { supabase, inserted } = mockSupabase()
    const ctx = makeCtx(supabase)

    const result = await bootstrapRunConversation(ctx)

    expect(result).not.toBeNull()
    expect(result?.conversationId).toBeDefined()
    expect(result?.tabId).toBeDefined()
    expect(result?.conversationId).not.toBe(result?.tabId)

    // Verify conversation insert
    expect(inserted.conversations).toHaveLength(1)
    const conv = inserted.conversations[0]
    expect(conv.user_id).toBe("user_abc")
    expect(conv.org_id).toBe("org_xyz")
    expect(conv.workspace).toBe("test.alive.best")
    expect(conv.source).toBe("automation_run")
    expect(conv.visibility).toBe("private")
    expect(conv.conversation_id).toBe(result?.conversationId)

    // Verify tab insert
    expect(inserted.conversation_tabs).toHaveLength(1)
    const tab = inserted.conversation_tabs[0]
    expect(tab.tab_id).toBe(result?.tabId)
    expect(tab.conversation_id).toBe(result?.conversationId)
    expect(tab.name).toBe("Run")
  })

  it("sets correct title format with job name and timestamp", async () => {
    const { supabase, inserted } = mockSupabase()
    const ctx = makeCtx(supabase)

    await bootstrapRunConversation(ctx)

    const conv = inserted.conversations[0]
    expect(conv.title).toBe("[Auto] Daily sync — 2026-02-28T12:00:00.000Z")
  })

  it("sets correct source_metadata with job_id, claim_run_id, and triggered_by", async () => {
    const { supabase, inserted } = mockSupabase()
    const ctx = makeCtx(supabase)
    ctx.triggeredBy = "manual"

    await bootstrapRunConversation(ctx)

    const conv = inserted.conversations[0]
    expect(conv.source_metadata).toEqual({
      job_id: "job_123",
      claim_run_id: "run_456",
      triggered_by: "manual",
    })
  })

  it("returns null on conversation insert error without throwing", async () => {
    const supabase = {
      from: vi.fn((table: string) => ({
        insert: vi.fn(() => {
          if (table === "conversations") {
            return Promise.resolve({ error: { message: "DB down", code: "500" } })
          }
          return Promise.resolve({ error: null })
        }),
      })),
    }
    const ctx = makeCtx(supabase)

    const result = await bootstrapRunConversation(ctx)

    expect(result).toBeNull()
  })

  it("returns null and cleans up conversation on tab insert error", async () => {
    let deleteEqCalled = false
    const supabase = {
      from: vi.fn((table: string) => ({
        insert: vi.fn(() => {
          if (table === "conversation_tabs") {
            return Promise.resolve({ error: { message: "tab error", code: "500" } })
          }
          return Promise.resolve({ error: null })
        }),
        delete: vi.fn(() => ({
          eq: vi.fn(() => {
            deleteEqCalled = true
            return Promise.resolve({ error: null })
          }),
        })),
      })),
    }
    const ctx = makeCtx(supabase)

    const result = await bootstrapRunConversation(ctx)

    expect(result).toBeNull()
    expect(deleteEqCalled).toBe(true)
  })

  it("returns null on unexpected exception without throwing", async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error("unexpected crash")
      }),
    }
    const ctx = makeCtx(supabase)

    const result = await bootstrapRunConversation(ctx)

    expect(result).toBeNull()
  })
})
