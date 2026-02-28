// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest"
import { BridgeInterruptSource } from "@/features/chat/lib/streaming/ndjson"
import { useStreamCancellation } from "../useStreamCancellation"

type UseStreamCancellationOptions = Parameters<typeof useStreamCancellation>[0]

type MockOptions = Omit<UseStreamCancellationOptions, "addMessage" | "setShowCompletionDots"> & {
  addMessage: Mock
  setShowCompletionDots: Mock
}

vi.mock("@/lib/api/api-client", () => ({
  postty: vi.fn().mockResolvedValue({ ok: true, status: "cancelled" }),
}))

vi.mock("@/lib/api/schemas", () => ({
  validateRequest: vi.fn((_endpoint: string, data: unknown) => data),
}))

const mockEndStream = vi.fn()
const mockStartStream = vi.fn()
const mockGetAbortController = vi.fn()
const mockClearAbortController = vi.fn()

vi.mock("@/lib/stores/streamingStore", () => ({
  useStreamingActions: () => ({
    endStream: mockEndStream,
    startStream: mockStartStream,
  }),
  getAbortController: (...args: unknown[]) => mockGetAbortController(...args),
  clearAbortController: (...args: unknown[]) => mockClearAbortController(...args),
}))

describe("useStreamCancellation", () => {
  const createMockOptions = (): MockOptions => ({
    tabId: "test-conversation-123",
    tabGroupId: "test-tabgroup",
    workspace: "test-workspace",
    worktree: "feature-branch",
    worktreesEnabled: true,
    addMessage: vi.fn(),
    setShowCompletionDots: vi.fn(),
    abortControllerRef: { current: new AbortController() },
    currentRequestIdRef: { current: "request-123" },
    isSubmittingByTabRef: { current: new Map([["test-conversation-123", true]]) },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-28T00:00:00Z"))
    mockGetAbortController.mockReturnValue(undefined)

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, hasStream: false }),
    } as Response) as unknown as typeof fetch
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("sends cancel by requestId and marks stop as confirmed on cancelled response", async () => {
    const { postty } = await import("@/lib/api/api-client")
    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    expect(postty).toHaveBeenCalledWith("claude/stream/cancel", expect.objectContaining({ requestId: "request-123" }))

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.isStopping).toBe(false)
    expect(options.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "interrupt",
        content: {
          message: "Response stopped.",
          source: BridgeInterruptSource.CLIENT_CANCEL,
        },
      }),
      options.tabId,
    )
  })

  it("falls back to tabId cancel when requestId is unavailable", async () => {
    const { postty } = await import("@/lib/api/api-client")
    const options = createMockOptions()
    options.currentRequestIdRef.current = null
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    expect(postty).toHaveBeenCalledWith(
      "claude/stream/cancel",
      expect.objectContaining({
        tabId: "test-conversation-123",
        tabGroupId: "test-tabgroup",
        workspace: "test-workspace",
      }),
    )

    await act(async () => {
      await vi.runAllTimersAsync()
    })
  })

  it("sets and clears stopping state around stop resolution", async () => {
    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })
    expect(result.current.isStopping).toBe(true)

    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(result.current.isStopping).toBe(false)
  })

  it("guards against double-click while stop is in progress", async () => {
    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
      result.current.stopStreaming()
    })

    // Immediate phase: only one hidden complete marker should be added.
    expect(options.addMessage).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    // Final phase: one interrupt message is added after resolution.
    expect(options.addMessage).toHaveBeenCalledTimes(2)
  })

  it("ends stream immediately on stop click", async () => {
    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    expect(mockEndStream).toHaveBeenCalledWith("test-conversation-123")

    await act(async () => {
      await vi.runAllTimersAsync()
    })
  })

  it("does not include stale worktree when worktrees are disabled", async () => {
    const { postty } = await import("@/lib/api/api-client")
    const options = createMockOptions()
    options.currentRequestIdRef.current = null
    options.worktreesEnabled = false
    options.worktree = "stale-worktree"
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    const payload = (postty as Mock).mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).toMatchObject({
      tabId: "test-conversation-123",
      tabGroupId: "test-tabgroup",
      workspace: "test-workspace",
    })
    expect(payload).not.toHaveProperty("worktree")

    await act(async () => {
      await vi.runAllTimersAsync()
    })
  })

  it("reports still-running stream when cancel cannot be confirmed", async () => {
    const { postty } = await import("@/lib/api/api-client")
    ;(postty as Mock).mockImplementation(() => new Promise(() => {}))

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, hasStream: true, state: "streaming", requestId: "request-reconnect-1" }),
    } as Response) as unknown as typeof fetch

    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    await act(async () => {
      vi.advanceTimersByTime(6000)
      await vi.runAllTimersAsync()
    })

    expect(mockStartStream).toHaveBeenCalledWith("test-conversation-123")
    expect(options.currentRequestIdRef.current).toBe("request-reconnect-1")
    expect(options.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "interrupt",
        content: {
          message: "Stop not confirmed. Response is still running. Press Stop again.",
          source: BridgeInterruptSource.CLIENT_CANCEL,
        },
      }),
      "test-conversation-123",
    )
    expect(result.current.isStopping).toBe(false)
  })

  it("reports unknown state when reconnect verification is unavailable", async () => {
    const { postty } = await import("@/lib/api/api-client")
    ;(postty as Mock).mockResolvedValue({ ok: true, status: "already_complete" })
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch

    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockStartStream).not.toHaveBeenCalled()
    expect(options.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "interrupt",
        content: {
          message: "Could not confirm stop. Check whether the response is still updating.",
          source: BridgeInterruptSource.CLIENT_CANCEL,
        },
      }),
      "test-conversation-123",
    )
    expect(result.current.isStopping).toBe(false)
  })
})
