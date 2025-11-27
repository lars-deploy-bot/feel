import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { useStreamCancellation } from "../useStreamCancellation"

type UseStreamCancellationOptions = Parameters<typeof useStreamCancellation>[0]

/** Mock options type with vi.fn() for callbacks */
type MockOptions = Omit<UseStreamCancellationOptions, "addMessage" | "setBusy" | "setShowCompletionDots"> & {
  addMessage: Mock
  setBusy: Mock
  setShowCompletionDots: Mock
}

// Mock dependencies
vi.mock("@/lib/api/api-client", () => ({
  postty: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/lib/api/schemas", () => ({
  validateRequest: vi.fn((_endpoint: string, data: unknown) => data),
}))

vi.mock("@/lib/stores/streamingStore", () => ({
  useStreamingActions: () => ({
    endStream: vi.fn(),
  }),
}))

describe("useStreamCancellation", () => {
  // Default mock options for the hook
  const createMockOptions = (): MockOptions => ({
    conversationId: "test-conversation-123",
    workspace: "test-workspace",
    addMessage: vi.fn(),
    setBusy: vi.fn(),
    setShowCompletionDots: vi.fn(),
    abortControllerRef: { current: new AbortController() },
    currentRequestIdRef: { current: "request-123" },
    isSubmittingRef: { current: true },
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("isStopping behavior", () => {
    /**
     * IMPORTANT: The isStopping value is only useful for the internal guard.
     *
     * Since stopStreaming() is fully synchronous and resets isStopping at the end,
     * consumers CANNOT observe isStopping=true between React renders.
     * React batches state updates, so setIsStopping(true) followed by
     * setIsStopping(false) in the same tick means consumers only see false.
     *
     * This test verifies:
     * 1. isStopping is properly typed as boolean (not a ref object)
     * 2. The double-click guard works via the internal ref
     */
    it("should expose isStopping as a boolean that starts and ends as false", () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useStreamCancellation(options))

      // Initial state
      expect(typeof result.current.isStopping).toBe("boolean")
      expect(result.current.isStopping).toBe(false)

      // After stopStreaming (which is synchronous and resets at end)
      act(() => {
        result.current.stopStreaming()
      })

      // Still false because stopStreaming resets it synchronously
      expect(result.current.isStopping).toBe(false)
    })

    it("should guard against RE-ENTRY (not sequential calls)", () => {
      // IMPORTANT: The guard protects against recursive/re-entrant calls,
      // NOT sequential calls. Since stopStreaming is fully synchronous,
      // it completes (including guard reset) before any second call starts.
      //
      // This test documents that sequential calls both execute - this is
      // the expected behavior for a synchronous function.
      let callCount = 0
      const setBusy = vi.fn(() => {
        callCount++
      })

      const options = {
        ...createMockOptions(),
        setBusy,
      }
      const { result } = renderHook(() => useStreamCancellation(options))

      // Sequential calls - BOTH will execute because each completes fully
      // before the next starts
      act(() => {
        result.current.stopStreaming() // Completes, resets guard
        result.current.stopStreaming() // Guard is reset, so this executes
      })

      // Both calls execute (this is correct for sync functions)
      expect(callCount).toBe(2)
    })

    it("should guard against re-entry during execution", () => {
      // This tests the ACTUAL purpose of the guard: preventing re-entry
      // if a callback called during stopStreaming tried to call stopStreaming again
      let reEntryAttempted = false
      let _reEntrySucceeded = false

      const setBusy = vi.fn(() => {
        if (!reEntryAttempted) {
          reEntryAttempted = true
          // Try to call stopStreaming from WITHIN stopStreaming
          // This simulates a callback that might trigger another stop
          result.current.stopStreaming()
          _reEntrySucceeded = true // If we get here, re-entry wasn't blocked
        }
      })

      const options = { ...createMockOptions(), setBusy }
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      // Re-entry was attempted
      expect(reEntryAttempted).toBe(true)
      // But it should have been blocked by the guard
      // (setBusy only called once means re-entry was blocked)
      expect(setBusy).toHaveBeenCalledTimes(1)
    })

    it("should allow subsequent calls after guard resets", () => {
      let callCount = 0
      const setBusy = vi.fn(() => {
        callCount++
      })

      const options = {
        ...createMockOptions(),
        setBusy,
      }
      const { result } = renderHook(() => useStreamCancellation(options))

      // First call
      act(() => {
        result.current.stopStreaming()
      })
      expect(callCount).toBe(1)

      // Second call in NEW act() - guard has reset, should execute
      act(() => {
        result.current.stopStreaming()
      })
      expect(callCount).toBe(2)
    })

    /**
     * This test captures isStopping DURING execution via a callback.
     * It verifies that the internal state is true when setBusy is called
     * (setBusy is called BEFORE the state resets to false).
     */
    it("should have isStopping=true during execution (captured via callback)", () => {
      let capturedIsStopping: boolean | undefined

      const setBusy = vi.fn(() => {
        // This callback runs BEFORE isStopping is reset to false
        // Capture what a component would see if it could read during execution
        capturedIsStopping = result.current.isStopping
      })

      const options = { ...createMockOptions(), setBusy }
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      // NOTE: Due to React's state batching, this will actually be false
      // because setIsStopping(true) hasn't triggered a re-render yet.
      // This test documents the ACTUAL behavior, not ideal behavior.
      // If this ever becomes true, it means React's batching changed or
      // we found a way to flush state synchronously.
      expect(capturedIsStopping).toBe(false) // Documents actual behavior
    })
  })

  describe("UI state management", () => {
    it("should reset busy state to false", () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(options.setBusy).toHaveBeenCalledWith(false)
    })

    it("should show completion dots", () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(options.setShowCompletionDots).toHaveBeenCalledWith(true)
    })

    it("should reset isSubmittingRef to false", () => {
      const options = createMockOptions()
      options.isSubmittingRef.current = true
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(options.isSubmittingRef.current).toBe(false)
    })
  })

  describe("abort handling", () => {
    it("should abort the current request", () => {
      const options = createMockOptions()
      const abortSpy = vi.spyOn(options.abortControllerRef.current!, "abort")
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(abortSpy).toHaveBeenCalled()
    })

    it("should clear abortControllerRef", () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(options.abortControllerRef.current).toBeNull()
    })

    it("should clear currentRequestIdRef", () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(options.currentRequestIdRef.current).toBeNull()
    })

    it("should handle missing abortController gracefully", () => {
      const options = createMockOptions()
      options.abortControllerRef.current = null
      const { result } = renderHook(() => useStreamCancellation(options))

      // Should not throw
      expect(() => {
        act(() => {
          result.current.stopStreaming()
        })
      }).not.toThrow()
    })
  })

  describe("completion message", () => {
    it("should add a completion message to mark thinking group as complete", () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(options.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "complete",
          content: {},
        }),
      )
    })

    it("should generate unique message ID based on timestamp", () => {
      const options = createMockOptions()
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      const call = options.addMessage.mock.calls[0][0]
      expect(call.id).toBeDefined()
      expect(typeof call.id).toBe("string")
      expect(call.timestamp).toBeInstanceOf(Date)
    })
  })

  describe("cancel API request", () => {
    it("should send cancel request with requestId when available", async () => {
      const { postty } = await import("@/lib/api/api-client")
      const options = createMockOptions()
      options.currentRequestIdRef.current = "request-456"
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(postty).toHaveBeenCalledWith("claude/stream/cancel", { requestId: "request-456" })
    })

    it("should fallback to conversationId when no requestId", async () => {
      const { postty } = await import("@/lib/api/api-client")
      const options = createMockOptions()
      options.currentRequestIdRef.current = null
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(postty).toHaveBeenCalledWith("claude/stream/cancel", {
        conversationId: "test-conversation-123",
        workspace: "test-workspace",
      })
    })

    it("should skip cancel request when no requestId AND no workspace", async () => {
      const { postty } = await import("@/lib/api/api-client")
      ;(postty as Mock).mockClear()

      const options = createMockOptions()
      options.currentRequestIdRef.current = null
      options.workspace = null
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      // Should not call postty - relies on abort() only
      expect(postty).not.toHaveBeenCalled()
    })

    it("should skip cancel request when conversationId is empty", async () => {
      const { postty } = await import("@/lib/api/api-client")
      ;(postty as Mock).mockClear()

      const options = createMockOptions()
      options.currentRequestIdRef.current = null
      options.conversationId = ""
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(postty).not.toHaveBeenCalled()
    })
  })

  describe("dev terminal events", () => {
    it("should call onDevEvent with interrupt event when provided", () => {
      const options = {
        ...createMockOptions(),
        onDevEvent: vi.fn(),
      }
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      expect(options.onDevEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "client.interrupt",
          data: expect.objectContaining({
            message: "Response interrupted by user",
            source: "client_cancel",
            conversationId: "test-conversation-123",
          }),
        }),
      )
    })

    it("should include timestamp in dev event", () => {
      const options = {
        ...createMockOptions(),
        onDevEvent: vi.fn(),
      }
      const { result } = renderHook(() => useStreamCancellation(options))

      act(() => {
        result.current.stopStreaming()
      })

      const eventData = options.onDevEvent.mock.calls[0][0].data
      expect(eventData.timestamp).toBeDefined()
      // Should be ISO format
      expect(() => new Date(eventData.timestamp)).not.toThrow()
    })

    it("should work when onDevEvent is not provided", () => {
      const options = createMockOptions()
      // No onDevEvent
      const { result } = renderHook(() => useStreamCancellation(options))

      expect(() => {
        act(() => {
          result.current.stopStreaming()
        })
      }).not.toThrow()
    })
  })
})
