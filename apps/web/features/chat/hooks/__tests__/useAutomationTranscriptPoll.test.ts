// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock fetchTabMessages
const mockFetchTabMessages = vi.fn().mockResolvedValue({ messages: [], hasMore: false })
vi.mock("@/lib/db/conversationSync", () => ({
  fetchTabMessages: (...args: unknown[]) => mockFetchTabMessages(...args),
}))

// Mock logError
const mockLogError = vi.fn()
vi.mock("@/lib/client-error-logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

// Mock global fetch (for run status checks)
const mockFetch = vi.fn()

import { useAutomationTranscriptPoll } from "../useAutomationTranscriptPoll"

type PollOpts = Parameters<typeof useAutomationTranscriptPoll>[0]

const baseOpts: PollOpts = {
  isAutomationRun: true,
  tabId: "tab-123",
  userId: "user-456",
  jobId: "job-abc",
  claimRunId: "run-xyz",
}

describe("useAutomationTranscriptPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Default: run is still active
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ run: { status: "running" } }),
    })
    global.fetch = mockFetch as unknown as typeof fetch

    // Make document visible
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("fetches messages immediately on mount", async () => {
    renderHook(() => useAutomationTranscriptPoll(baseOpts))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockFetchTabMessages).toHaveBeenCalledWith("tab-123", "user-456")
  })

  it("does not poll when automation mode is off", async () => {
    renderHook(() => useAutomationTranscriptPoll({ ...baseOpts, isAutomationRun: false }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(mockFetchTabMessages).not.toHaveBeenCalled()
  })

  it("does not poll when tabId is null", async () => {
    renderHook(() => useAutomationTranscriptPoll({ ...baseOpts, tabId: null }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(mockFetchTabMessages).not.toHaveBeenCalled()
  })

  it("checks specific run status with includeMessages=false", async () => {
    renderHook(() => useAutomationTranscriptPoll(baseOpts))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/automations/job-abc/runs/run-xyz?includeMessages=false"),
      expect.objectContaining({ credentials: "include" }),
    )
  })

  it("stops polling when run status becomes terminal", async () => {
    renderHook(() => useAutomationTranscriptPoll(baseOpts))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ run: { status: "success" } }),
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000)
    })

    const callsAfterCompletion = mockFetchTabMessages.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBe(callsAfterCompletion)
  })

  it("stops polling when run details endpoint returns 404", async () => {
    renderHook(() => useAutomationTranscriptPoll(baseOpts))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    mockFetch.mockResolvedValue({ ok: false, status: 404 })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000)
    })

    const callsAfterNotFound = mockFetchTabMessages.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBe(callsAfterNotFound)
  })

  it("does one final fetch before stopping after completion", async () => {
    renderHook(() => useAutomationTranscriptPoll(baseOpts))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    const callsBefore = mockFetchTabMessages.mock.calls.length

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ run: { status: "failure" } }),
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it("skips polling while document is hidden", async () => {
    renderHook(() => useAutomationTranscriptPoll(baseOpts))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    const callsBeforeHide = mockFetchTabMessages.mock.calls.length

    Object.defineProperty(document, "hidden", { value: true, configurable: true })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBe(callsBeforeHide)
  })

  it("resumes polling on visibilitychange when tab becomes visible", async () => {
    renderHook(() => useAutomationTranscriptPoll(baseOpts))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    Object.defineProperty(document, "hidden", { value: true, configurable: true })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000)
    })

    const callsWhileHidden = mockFetchTabMessages.mock.calls.length

    Object.defineProperty(document, "hidden", { value: false, configurable: true })

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBeGreaterThan(callsWhileHidden)
  })

  it("opens circuit breaker after repeated status check failures", async () => {
    renderHook(() => useAutomationTranscriptPoll(baseOpts))

    mockFetch.mockResolvedValue({ ok: false, status: 500 })

    await act(async () => {
      // 6 checks x 10s plus initial scheduling overhead
      await vi.advanceTimersByTimeAsync(70_000)
    })

    const callsAfterBreaker = mockFetchTabMessages.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBe(callsAfterBreaker)
    expect(mockLogError).toHaveBeenCalledWith(
      "automation-poll",
      "Stopping transcript polling after repeated status check failures",
      expect.objectContaining({ consecutiveFailures: 6 }),
    )
  })

  it("keeps polling without status endpoint when job metadata is missing", async () => {
    renderHook(() => useAutomationTranscriptPoll({ ...baseOpts, jobId: null, claimRunId: null }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBeGreaterThan(3)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("backs off to slower interval after many empty polls in fallback mode", async () => {
    mockFetchTabMessages.mockResolvedValue({ messages: [], hasMore: false })

    renderHook(() => useAutomationTranscriptPoll({ ...baseOpts, jobId: null, claimRunId: null }))

    await act(async () => {
      // Run through the 10 empty-poll threshold.
      await vi.advanceTimersByTimeAsync(32_000)
    })

    const callsAfterBackoff = mockFetchTabMessages.mock.calls.length

    await act(async () => {
      // 3s is shorter than backoff interval (10s), so there should be no extra call.
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBe(callsAfterBackoff)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7_000)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBeGreaterThan(callsAfterBackoff)
  })

  it("does not overlap polls when previous poll is in-flight", async () => {
    let resolveSlowPoll: (() => void) | undefined
    mockFetchTabMessages.mockImplementationOnce(
      () =>
        new Promise<{ messages: never[]; hasMore: boolean }>(resolve => {
          resolveSlowPoll = () => resolve({ messages: [], hasMore: false })
        }),
    )

    renderHook(() => useAutomationTranscriptPoll(baseOpts))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(mockFetchTabMessages).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(mockFetchTabMessages).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSlowPoll?.()
      await vi.advanceTimersByTimeAsync(0)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(mockFetchTabMessages.mock.calls.length).toBeGreaterThan(1)
  })

  it("cleans up timer and visibility listener on unmount", async () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener")

    const { unmount } = renderHook(() => useAutomationTranscriptPoll(baseOpts))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function))
  })
})
