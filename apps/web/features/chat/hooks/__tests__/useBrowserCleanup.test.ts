// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EXPLICIT_STOP_UNLOAD_BEACON_MARKER } from "@/lib/stream/cancel-markers"
import { useBrowserCleanup } from "../useBrowserCleanup"

type UseBrowserCleanupOptions = Parameters<typeof useBrowserCleanup>[0]

describe("useBrowserCleanup", () => {
  const createOptions = (overrides: Partial<UseBrowserCleanupOptions> = {}): UseBrowserCleanupOptions => ({
    tabId: "11111111-1111-1111-1111-111111111111",
    tabGroupId: "22222222-2222-2222-2222-222222222222",
    workspace: "test.test.example",
    worktree: "feature-123",
    worktreesEnabled: true,
    lastSeenStreamSeq: 42,
    isStreaming: true,
    isStopping: false,
    ...overrides,
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("sends reconnect ack on beforeunload and does not send cancel beacon when not stopping", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: sendBeacon,
    })

    renderHook(() => useBrowserCleanup(createOptions()))

    await act(async () => {
      window.dispatchEvent(new Event("beforeunload"))
    })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon).toHaveBeenCalledWith("/api/claude/stream/reconnect", expect.any(Blob))

    const payloadBlob = sendBeacon.mock.calls[0]?.[1] as Blob
    const payloadText = await payloadBlob.text()
    const payload = JSON.parse(payloadText) as {
      ackOnly: boolean
      lastSeenSeq: number
      worktree?: string
    }
    expect(payload.ackOnly).toBe(true)
    expect(payload.lastSeenSeq).toBe(42)
    expect(payload.worktree).toBe("feature-123")
  })

  it("does nothing on beforeunload when not streaming", () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: sendBeacon,
    })

    renderHook(() => useBrowserCleanup(createOptions({ isStreaming: false })))

    act(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })

    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it("sends explicit cancel beacon on unload when stop is in progress", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: sendBeacon,
    })

    renderHook(() => useBrowserCleanup(createOptions({ isStopping: true })))

    await act(async () => {
      window.dispatchEvent(new Event("beforeunload"))
    })

    expect(sendBeacon).toHaveBeenCalledTimes(2)
    expect(sendBeacon).toHaveBeenNthCalledWith(1, "/api/claude/stream/reconnect", expect.any(Blob))
    expect(sendBeacon).toHaveBeenNthCalledWith(2, "/api/claude/stream/cancel", expect.any(Blob))

    const cancelPayloadBlob = sendBeacon.mock.calls[1]?.[1] as Blob
    const cancelPayloadText = await cancelPayloadBlob.text()
    const cancelPayload = JSON.parse(cancelPayloadText) as {
      clientStack: string
      tabId: string
      tabGroupId: string
      workspace: string
      worktree?: string
    }
    expect(cancelPayload.clientStack).toContain(EXPLICIT_STOP_UNLOAD_BEACON_MARKER)
    expect(cancelPayload.tabId).toBe("11111111-1111-1111-1111-111111111111")
    expect(cancelPayload.tabGroupId).toBe("22222222-2222-2222-2222-222222222222")
    expect(cancelPayload.workspace).toBe("test.test.example")
    expect(cancelPayload.worktree).toBe("feature-123")
  })

  it("still sends explicit cancel beacon when stop is in progress but stream is already locally ended", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true)
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: sendBeacon,
    })

    renderHook(() => useBrowserCleanup(createOptions({ isStreaming: false, isStopping: true })))

    await act(async () => {
      window.dispatchEvent(new Event("beforeunload"))
    })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon).toHaveBeenCalledWith("/api/claude/stream/cancel", expect.any(Blob))

    const cancelPayloadBlob = sendBeacon.mock.calls[0]?.[1] as Blob
    const cancelPayloadText = await cancelPayloadBlob.text()
    const cancelPayload = JSON.parse(cancelPayloadText) as { clientStack: string }
    expect(cancelPayload.clientStack).toContain(EXPLICIT_STOP_UNLOAD_BEACON_MARKER)
  })
})
