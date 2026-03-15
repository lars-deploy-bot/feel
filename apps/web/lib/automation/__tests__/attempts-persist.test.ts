/**
 * Tests that onPersistMessage callback is called for each message in tryWorkerPool.
 *
 * Mocks the worker pool to simulate IPC messages and verifies the persist
 * callback receives the raw messages alongside the collector.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock worker pool before importing attempts
const mockPoolQuery = vi.fn()

vi.mock("@webalive/worker-pool", async () => {
  return {
    getWorkerPool: () => ({ query: mockPoolQuery }),
    isQueryResultCancelled: (result: { cancelled?: boolean } | null | undefined) => result?.cancelled === true,
  }
})

vi.mock("node:fs", () => ({
  statSync: () => ({ uid: 1000, gid: 1000 }),
}))

vi.mock("@webalive/shared", async importOriginal => {
  const actual = await importOriginal<typeof import("@webalive/shared")>()
  return {
    ...actual,
    DEFAULTS: { CLAUDE_MAX_TURNS: 10 },
    WORKER_POOL: { ENABLED: true },
  }
})

vi.mock("@/lib/claude/agent-constants.mjs", () => ({
  getAllowedTools: () => ["Read", "Write"],
  getDisallowedTools: () => [],
  PERMISSION_MODE: "allowedTools",
  SETTINGS_SOURCES: [],
  STREAM_TYPES: [],
}))

import { tryWorkerPool } from "../attempts"

// =============================================================================
// Tests
// =============================================================================

describe("tryWorkerPool onPersistMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls onPersistMessage for each message received", async () => {
    const messages = [
      { type: "message", content: { role: "assistant", content: [{ type: "text", text: "hi" }] } },
      { type: "message", content: { role: "user", content: [{ type: "text", text: "test" }] } },
      {
        type: "complete",
        result: { result: { subtype: "success", result: "done", total_cost_usd: 0.01, num_turns: 1 } },
      },
    ]

    mockPoolQuery.mockImplementation(
      async (_creds: unknown, opts: { onMessage: (msg: Record<string, unknown>) => void }) => {
        for (const msg of messages) {
          opts.onMessage(msg as Record<string, unknown>)
        }
        return { success: true }
      },
    )

    const onPersistMessage = vi.fn()

    await tryWorkerPool({
      requestId: "req_1",
      cwd: "/tmp/test",
      workspace: "test.test.example",
      userId: "user_1",
      fullPrompt: "do stuff",
      selectedModel: "claude-sonnet-4-20250514",
      systemPrompt: "you are a bot",
      timeoutSeconds: 60,
      oauthAccessToken: "token",
      onPersistMessage,
    })

    expect(onPersistMessage).toHaveBeenCalledTimes(3)
    expect(onPersistMessage).toHaveBeenNthCalledWith(1, messages[0])
    expect(onPersistMessage).toHaveBeenNthCalledWith(2, messages[1])
    expect(onPersistMessage).toHaveBeenNthCalledWith(3, messages[2])
  })

  it("does not error when onPersistMessage is not provided", async () => {
    mockPoolQuery.mockImplementation(
      async (_creds: unknown, opts: { onMessage: (msg: Record<string, unknown>) => void }) => {
        opts.onMessage({ type: "message", content: { role: "assistant", content: [] } })
        return { success: true }
      },
    )

    // No onPersistMessage — should not throw
    const result = await tryWorkerPool({
      requestId: "req_2",
      cwd: "/tmp/test",
      workspace: "test.test.example",
      userId: "user_1",
      fullPrompt: "do stuff",
      selectedModel: "claude-sonnet-4-20250514",
      systemPrompt: "you are a bot",
      timeoutSeconds: 60,
      oauthAccessToken: "token",
    })

    expect(result.allMessages).toHaveLength(1)
  })

  it("throws when pool.query returns cancelled result", async () => {
    mockPoolQuery.mockResolvedValue({ success: true, cancelled: true })

    await expect(
      tryWorkerPool({
        requestId: "req_cancelled",
        cwd: "/tmp/test",
        workspace: "test.test.example",
        userId: "user_1",
        fullPrompt: "do stuff",
        selectedModel: "claude-sonnet-4-20250514",
        systemPrompt: "you are a bot",
        timeoutSeconds: 60,
        oauthAccessToken: "token",
      }),
    ).rejects.toThrow("Automation timed out during execution")
  })
})
