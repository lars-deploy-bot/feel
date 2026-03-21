// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest"
import { BridgeInterruptSource, InterruptStatus } from "@/features/chat/lib/streaming/ndjson"
import { useStreamCancellation } from "../useStreamCancellation"

type UseStreamCancellationOptions = Parameters<typeof useStreamCancellation>[0]

type MockOptions = Omit<UseStreamCancellationOptions, "addMessage" | "setShowCompletionDots"> & {
  addMessage: Mock
  setShowCompletionDots: Mock
}

/** Module-level mock for postty — typed as plain vi.fn() to avoid generic overload issues */
const mockPostty = vi.fn()
vi.mock("@/lib/api/api-client", () => ({
  postty: (...args: unknown[]) => mockPostty(...args),
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

const mockUpdateMessageContent = vi.fn()
const mockCaptureResumeSessionAt = vi.fn().mockResolvedValue(null)
const mockClearResumeSessionAt = vi.fn()
vi.mock("@/lib/db/dexieMessageStore", () => ({
  useDexieMessageStore: {
    getState: () => ({
      updateMessageContent: mockUpdateMessageContent,
      captureResumeSessionAtFromLatestAssistant: mockCaptureResumeSessionAt,
      clearResumeSessionAt: mockClearResumeSessionAt,
    }),
  },
}))

/**
 * Creates a mock fetch that satisfies `typeof fetch` (including the `preconnect` property).
 * Uses Object.assign to merge the mock callable with the required static property.
 */
function createMockFetch(): typeof fetch {
  return Object.assign(vi.fn(), { preconnect: vi.fn() })
}

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

  const getInterruptMessages = (addMessageMock: Mock) => {
    return addMessageMock.mock.calls
      .map(call => call[0])
      .filter((message: Record<string, unknown>) => message.type === "interrupt")
  }

  /** Get the content from the last resolveInterruptMessage call (Dexie update-in-place) */
  const getResolvedContent = (): Record<string, unknown> | undefined => {
    const calls = mockUpdateMessageContent.mock.calls
    if (calls.length === 0) return undefined
    const lastCall = calls[calls.length - 1]
    return lastCall?.[1]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-28T00:00:00Z"))
    mockGetAbortController.mockReturnValue(undefined)
    mockUpdateMessageContent.mockResolvedValue(true)
    mockCaptureResumeSessionAt.mockResolvedValue(null)

    const mockFetchInstance = createMockFetch()
    vi.mocked(mockFetchInstance).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, hasStream: false }), { status: 200 }),
    )
    global.fetch = mockFetchInstance

    mockPostty.mockResolvedValue({ ok: true, status: "cancelled" })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("sends cancel by requestId and marks stop as confirmed on cancelled response", async () => {
    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    const immediateInterrupts = getInterruptMessages(options.addMessage)
    expect(immediateInterrupts).toHaveLength(1)
    expect(immediateInterrupts[0]?.content).toMatchObject({
      message: "Stopping response...",
      source: BridgeInterruptSource.CLIENT_CANCEL,
      status: InterruptStatus.STOPPING,
    })

    expect(mockPostty).toHaveBeenCalledWith(
      "claude/stream/cancel",
      expect.objectContaining({ requestId: "request-123" }),
    )
    expect(mockCaptureResumeSessionAt).toHaveBeenCalledWith("test-conversation-123")

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.isStopping).toBe(false)
    // Resolution updates the existing message in place via Dexie, not via addMessage
    expect(mockUpdateMessageContent).toHaveBeenCalledTimes(1)
    expect(getResolvedContent()).toMatchObject({
      message: "Response stopped.",
      source: BridgeInterruptSource.CLIENT_CANCEL,
      status: InterruptStatus.STOPPED,
      details: {
        cancelStatus: "cancelled",
        verificationResult: "skipped",
        verificationAttempts: 0,
      },
    })
  })

  it("falls back to tabId cancel when requestId is unavailable", async () => {
    const options = createMockOptions()
    options.currentRequestIdRef.current = null
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    expect(mockPostty).toHaveBeenCalledWith(
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

    // Immediate phase: one hidden complete marker + one visible "Stopping..." status.
    expect(options.addMessage).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    // Final phase: resolution updates in place via Dexie, not addMessage.
    expect(options.addMessage).toHaveBeenCalledTimes(2)
    expect(mockUpdateMessageContent).toHaveBeenCalledTimes(1)
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
    const options = createMockOptions()
    options.currentRequestIdRef.current = null
    options.worktreesEnabled = false
    options.worktree = "stale-worktree"
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    const payload = mockPostty.mock.calls[0]?.[1]
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
    mockPostty.mockImplementation(() => new Promise(() => {}))

    const stillRunningFetch = createMockFetch()
    vi.mocked(stillRunningFetch).mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, hasStream: true, state: "streaming", requestId: "request-reconnect-1" }),
        { status: 200 },
      ),
    )
    global.fetch = stillRunningFetch

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
    expect(mockClearResumeSessionAt).toHaveBeenCalledWith("test-conversation-123")
    expect(options.currentRequestIdRef.current).toBe("request-reconnect-1")
    expect(mockUpdateMessageContent).toHaveBeenCalledTimes(1)
    expect(getResolvedContent()).toMatchObject({
      message: "Stop not confirmed. Response is still running. Press Stop again.",
      source: BridgeInterruptSource.CLIENT_CANCEL,
      status: InterruptStatus.STILL_RUNNING,
      details: {
        activeRequestId: "request-reconnect-1",
        verificationResult: "still_streaming",
        verificationAttempts: 6,
      },
    })
    expect(result.current.isStopping).toBe(false)
  })

  it("reports unknown state when reconnect verification is unavailable", async () => {
    mockPostty.mockResolvedValue({ ok: true, status: "cancel_queued" })
    const failingFetch = createMockFetch()
    vi.mocked(failingFetch).mockRejectedValue(new Error("network down"))
    global.fetch = failingFetch

    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockStartStream).not.toHaveBeenCalled()
    expect(mockUpdateMessageContent).toHaveBeenCalledTimes(1)
    expect(getResolvedContent()).toMatchObject({
      message: "Could not confirm stop. Check whether the response is still updating.",
      source: BridgeInterruptSource.CLIENT_CANCEL,
      status: InterruptStatus.NOT_VERIFIED,
      details: {
        verificationResult: "unknown",
        verificationAttempts: 6,
      },
    })
    expect(result.current.isStopping).toBe(false)
  })

  it("shows already-finished state when stop arrives after completion", async () => {
    mockPostty.mockResolvedValue({ ok: true, status: "already_complete" })

    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockUpdateMessageContent).toHaveBeenCalledTimes(1)
    expect(getResolvedContent()).toMatchObject({
      message: "Response already finished before stop.",
      source: BridgeInterruptSource.CLIENT_CANCEL,
      status: InterruptStatus.FINISHED,
      details: {
        cancelStatus: "already_complete",
        verificationResult: "skipped",
        verificationAttempts: 0,
      },
    })
    expect(result.current.isStopping).toBe(false)
  })

  it("does not claim explicit stop when backend reports cancel timeout", async () => {
    mockPostty.mockResolvedValue({ ok: true, status: "cancel_timed_out" })

    const options = createMockOptions()
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(getResolvedContent()).toMatchObject({
      message: "Response is no longer running.",
      source: BridgeInterruptSource.CLIENT_CANCEL,
      status: InterruptStatus.FINISHED,
      details: {
        cancelStatus: "cancel_timed_out",
        verificationResult: "confirmed",
      },
    })
    expect(result.current.isStopping).toBe(false)
  })

  it("falls back to addMessage when interrupt update-in-place cannot be persisted", async () => {
    mockPostty.mockResolvedValue({ ok: true, status: "cancelled" })
    const options = createMockOptions()
    mockUpdateMessageContent.mockResolvedValueOnce(false)
    const { result } = renderHook(() => useStreamCancellation(options))

    act(() => {
      result.current.stopStreaming()
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    const interruptMessages = getInterruptMessages(options.addMessage)
    expect(interruptMessages).toHaveLength(2)
    expect(interruptMessages[1]?.content).toMatchObject({
      message: "Response stopped.",
      status: InterruptStatus.STOPPED,
    })
  })
})
