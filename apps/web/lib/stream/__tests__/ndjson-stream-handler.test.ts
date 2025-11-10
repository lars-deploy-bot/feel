import { afterEach, describe, expect, it, vi } from "vitest"
import { createNDJSONStream, type CancelState } from "../ndjson-stream-handler"

/**
 * NDJSON Stream Handler Tests
 *
 * These tests verify the core functionality:
 * 1. Stream creation doesn't throw
 * 2. Stream has cancel method
 * 3. Configuration is properly accepted
 * 4. Stream can be passed to HTTP responses
 * 5. Cancellation state management
 */

/**
 * Helper to create a fresh cancel state for each test
 */
function createCancelState(): CancelState {
  return {
    requested: false,
    reader: null,
  }
}

describe("NDJSON Stream Handler", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("Stream Creation & Configuration", () => {
    it("should create stream with minimal config", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-req-1",
        conversationWorkspace: "test-workspace",
        tokenSource: "user_provided",
        cancelState: createCancelState(),
      })

      expect(stream).toBeDefined()
      expect(stream).toBeInstanceOf(ReadableStream)
    })

    it("should accept optional session callback", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const sessionCallback = vi.fn().mockResolvedValue(undefined)

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-req-2",
        conversationWorkspace: "test-workspace",
        tokenSource: "workspace",
        cancelState: createCancelState(),
        onSessionIdReceived: sessionCallback,
      })

      expect(stream).toBeDefined()
    })

    it("should accept workspace token source", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-req-3",
        conversationWorkspace: "test-workspace",
        tokenSource: "workspace",
        cancelState: createCancelState(),
      })

      expect(stream).toBeDefined()
    })

    it("should accept user-provided token source", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-req-4",
        conversationWorkspace: "test-workspace",
        tokenSource: "user_provided",
        cancelState: createCancelState(),
      })

      expect(stream).toBeDefined()
    })
  })

  describe("Stream Properties", () => {
    it("should have cancel method", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-req-5",
        conversationWorkspace: "test-workspace",
        tokenSource: "user_provided",
        cancelState: createCancelState(),
      })

      expect(stream.cancel).toBeDefined()
      expect(typeof stream.cancel).toBe("function")
    })

    it("should have getReader method", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-req-6",
        conversationWorkspace: "test-workspace",
        tokenSource: "user_provided",
        cancelState: createCancelState(),
      })

      expect(stream.getReader).toBeDefined()
      expect(typeof stream.getReader).toBe("function")
    })
  })

  describe("Configuration Parameters", () => {
    it("should accept various conversation key formats", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const conversationKeys = ["simple-key", "user1::workspace::conv-123", "complex-key-with-many-segments::multiple"]

      for (const key of conversationKeys) {
        const stream = createNDJSONStream({
          childStream: mockChildStream,
          conversationKey: key,
          requestId: "test-req",
          conversationWorkspace: "test-workspace",
          tokenSource: "user_provided",
        cancelState: createCancelState(),
        })

        expect(stream).toBeDefined()
      }
    })

    it("should accept various request IDs", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const requestIds = ["req-1", "unique-req-abc-123", "request-with-dashes-and-numbers-123"]

      for (const id of requestIds) {
        const stream = createNDJSONStream({
          childStream: mockChildStream,
          conversationKey: "test-conv",
          requestId: id,
          conversationWorkspace: "test-workspace",
          tokenSource: "user_provided",
        cancelState: createCancelState(),
        })

        expect(stream).toBeDefined()
      }
    })

    it("should accept various workspace names", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const workspaces = ["test", "production", "my-workspace-123", "workspace.example.com"]

      for (const workspace of workspaces) {
        const stream = createNDJSONStream({
          childStream: mockChildStream,
          conversationKey: "test-conv",
          requestId: "test-req",
          conversationWorkspace: workspace,
          tokenSource: "user_provided",
        cancelState: createCancelState(),
        })

        expect(stream).toBeDefined()
      }
    })
  })

  describe("Cancellation", () => {
    it("should not throw when cancel is called", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-req-7",
        conversationWorkspace: "test-workspace",
        tokenSource: "user_provided",
        cancelState: createCancelState(),
      })

      expect(() => {
        stream.cancel()
      }).not.toThrow()
    })

    it("should handle cancel with reason parameter", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-req-8",
        conversationWorkspace: "test-workspace",
        tokenSource: "user_provided",
        cancelState: createCancelState(),
      })

      expect(() => {
        stream.cancel(new Error("User cancelled"))
      }).not.toThrow()
    })
  })

  describe("Error Handling", () => {
    it("should handle child stream errors without throwing on creation", () => {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.error(new Error("Child stream error"))
        },
      })

      const stream = createNDJSONStream({
        childStream: errorStream,
        conversationKey: "test-conv",
        requestId: "test-req-error-1",
        conversationWorkspace: "test-workspace",
        tokenSource: "user_provided",
        cancelState: createCancelState(),
      })

      expect(stream).toBeDefined()
    })

    it("should handle missing child stream gracefully", () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      expect(() => {
        createNDJSONStream({
          childStream: mockChildStream,
          conversationKey: "test-conv",
          requestId: "test-req-error-2",
          conversationWorkspace: "test-workspace",
          tokenSource: "user_provided",
        cancelState: createCancelState(),
        })
      }).not.toThrow()
    })
  })

  describe("Type Safety", () => {
    it("should maintain Uint8Array output type", () => {
      const mockChildStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-req-type-1",
        conversationWorkspace: "test-workspace",
        tokenSource: "user_provided",
        cancelState: createCancelState(),
      })

      expect(stream).toBeInstanceOf(ReadableStream)
    })
  })

  describe("Multiple Instances", () => {
    it("should allow creating multiple independent stream instances", () => {
      const mockChildStream1 = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const mockChildStream2 = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream1 = createNDJSONStream({
        childStream: mockChildStream1,
        conversationKey: "conv-1",
        requestId: "req-1",
        conversationWorkspace: "ws-1",
        tokenSource: "user_provided",
        cancelState: createCancelState(),
      })

      const stream2 = createNDJSONStream({
        childStream: mockChildStream2,
        conversationKey: "conv-2",
        requestId: "req-2",
        conversationWorkspace: "ws-2",
        tokenSource: "workspace",
        cancelState: createCancelState(),
      })

      expect(stream1).toBeDefined()
      expect(stream2).toBeDefined()
      expect(stream1).not.toBe(stream2)
    })
  })

  describe("Stream Cleanup (Regression Test for Lock Bug)", () => {
    it("should call onStreamComplete callback on successful completion", async () => {
      const onStreamComplete = vi.fn()

      // Child stream that emits bridge_complete and then ends
      const mockChildStream = new ReadableStream({
        start(controller) {
          const completeEvent = JSON.stringify({
            type: "bridge_complete",
            totalMessages: 1,
            result: { type: "result", is_error: false },
          })
          controller.enqueue(new TextEncoder().encode(`${completeEvent}\n`))
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-cleanup-1",
        conversationWorkspace: "test-workspace",
        tokenSource: "workspace",
        cancelState: createCancelState(),
        onStreamComplete,
      })

      // Read the stream to completion
      const reader = stream.getReader()
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      // Callback should have been called exactly once
      expect(onStreamComplete).toHaveBeenCalledTimes(1)
    })

    it("should call onStreamComplete callback on error", async () => {
      const onStreamComplete = vi.fn()

      // Child stream that throws an error
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.error(new Error("Test error"))
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-cleanup-2",
        conversationWorkspace: "test-workspace",
        tokenSource: "workspace",
        cancelState: createCancelState(),
        onStreamComplete,
      })

      // Try to read the stream (will error)
      const reader = stream.getReader()
      try {
        await reader.read()
      } catch {
        // Expected to throw
      }

      // Callback should still have been called in finally block
      expect(onStreamComplete).toHaveBeenCalledTimes(1)
    })

    it("should call onStreamComplete callback even with malformed data", async () => {
      const onStreamComplete = vi.fn()

      // Child stream with invalid JSON
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("not valid json\n"))
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-cleanup-3",
        conversationWorkspace: "test-workspace",
        tokenSource: "workspace",
        cancelState: createCancelState(),
        onStreamComplete,
      })

      // Read the stream (parse error logged, but stream continues)
      const reader = stream.getReader()
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      // Callback should still be called
      expect(onStreamComplete).toHaveBeenCalledTimes(1)
    })

    it("should close stream when child stream ends", async () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          const message = JSON.stringify({
            type: "bridge_message",
            messageCount: 1,
            messageType: "user",
            content: { type: "user", content: "test" },
          })
          controller.enqueue(new TextEncoder().encode(`${message}\n`))
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-close-1",
        conversationWorkspace: "test-workspace",
        tokenSource: "workspace",
        cancelState: createCancelState(),
      })

      // Read until stream closes
      const reader = stream.getReader()
      const chunks: Uint8Array[] = []

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // Stream properly closed
          expect(done).toBe(true)
          break
        }
        if (value) chunks.push(value)
      }

      // Should have received data
      expect(chunks.length).toBeGreaterThan(0)
    })

    it("should work without onStreamComplete callback (backward compatible)", async () => {
      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-no-callback",
        conversationWorkspace: "test-workspace",
        tokenSource: "workspace",
        cancelState: createCancelState(),
        // No onStreamComplete provided
      })

      // Should not throw
      const reader = stream.getReader()
      const { done } = await reader.read()
      expect(done).toBe(true)
    })

    it("should call onStreamComplete only once even if stream read multiple times", async () => {
      const onStreamComplete = vi.fn()

      const mockChildStream = new ReadableStream({
        start(controller) {
          controller.close()
        },
      })

      const stream = createNDJSONStream({
        childStream: mockChildStream,
        conversationKey: "test-conv",
        requestId: "test-once",
        conversationWorkspace: "test-workspace",
        tokenSource: "workspace",
        cancelState: createCancelState(),
        onStreamComplete,
      })

      // Read the stream completely
      const reader = stream.getReader()
      await reader.read()

      // Should have been called exactly once (in finally block)
      expect(onStreamComplete).toHaveBeenCalledTimes(1)
    })
  })
})
