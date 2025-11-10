import { describe, expect, it, beforeEach, afterEach } from "vitest"
import {
  tryLockConversation,
  unlockConversation,
  sessionKey,
  isConversationLocked,
} from "@/features/auth/lib/sessionStore"
import { createNDJSONStream } from "@/lib/stream/ndjson-stream-handler"
import type { CancelState } from "@/lib/stream/ndjson-stream-handler"
import { registerCancellation, cancelStream } from "@/lib/stream/cancellation-registry"

/**
 * STRICT Integration Tests for Explicit Cancellation
 *
 * PRINCIPLES:
 * 1. NO TIMING ASSERTIONS - We don't care HOW FAST it is, we care IF IT WORKS
 * 2. NO SLEEPS - Use events/promises to synchronize, not guesses
 * 3. TEST BEHAVIOR - "Can user send second message?" not "Did callback fire?"
 * 4. DETERMINISTIC - Same input = same output, every time
 *
 * WHAT WE'RE TESTING:
 * The bug: User clicks Stop → lock held for 14 seconds → 409 on second message
 * The fix: cancelState.requested → immediate lock release → second message works
 *
 * If these tests pass, the feature WORKS. If they fail, it's BROKEN.
 */

describe("Explicit Cancellation Integration (STRICT)", () => {
  const userId = "test-user"
  const workspace = "test-workspace"
  const conversationId = "explicit-cancel-test"
  const convKey = sessionKey({ userId, conversationId })

  beforeEach(() => {
    unlockConversation(convKey)
  })

  afterEach(() => {
    unlockConversation(convKey)
  })

  /**
   * THE 409 BUG TEST
   * This is THE test that matters. If this passes, the bug is fixed.
   */
  describe("The 409 Bug - Second Request Must Succeed After Cancel", () => {
    it("should allow second request after explicit cancellation (THE BUG)", async () => {
      // REQUEST 1: Start and cancel
      const locked1 = tryLockConversation(convKey)
      expect(locked1).toBe(true)

      const cancelState: CancelState = { requested: false, reader: null }

      // Create a stream that never ends (simulates long-running request)
      const childStream = new ReadableStream({
        start() {
          // Never close - simulates child process still running
        },
      })

      let lock1Released = false

      const stream1 = createNDJSONStream({
        childStream,
        conversationKey: convKey,
        requestId: "req-1",
        conversationWorkspace: workspace,
        tokenSource: "user_provided",
        onStreamComplete: () => {
          lock1Released = true
          unlockConversation(convKey)
        },
        cancelState,
      })

      const reader1 = stream1.getReader()
      cancelState.reader = reader1

      // USER CLICKS STOP (production does both of these)
      cancelState.requested = true
      reader1.cancel() // Unblock the read

      // Wait for lock to be released
      await new Promise((resolve) => {
        const checkLock = setInterval(() => {
          if (lock1Released) {
            clearInterval(checkLock)
            resolve(undefined)
          }
        }, 10)

        // Timeout after 2 seconds (if bug exists, would wait 14 seconds)
        setTimeout(() => {
          clearInterval(checkLock)
          resolve(undefined)
        }, 2000)
      })

      // THE KEY TEST: Can we acquire lock for second request?
      const locked2 = tryLockConversation(convKey)

      if (!locked2) {
        // If this fails, we have the 409 bug
        throw new Error("THE 409 BUG EXISTS: Lock not released after cancel, second request would get 409")
      }

      expect(locked2).toBe(true)
      expect(lock1Released).toBe(true)

      // Cleanup
      unlockConversation(convKey)
      reader1.releaseLock()
    })

    it("should handle rapid Stop → Send cycles without 409 errors", async () => {
      // User behavior: Click Stop, Send, Stop, Send, Stop, Send...
      for (let i = 0; i < 10; i++) {
        const locked = tryLockConversation(convKey)

        if (!locked) {
          throw new Error(`409 BUG on iteration ${i}: Lock still held from previous request`)
        }

        expect(locked).toBe(true)

        const cancelState: CancelState = { requested: false, reader: null }

        const childStream = new ReadableStream({
          start() {
            // Infinite stream
          },
        })

        let lockReleased = false

        const stream = createNDJSONStream({
          childStream,
          conversationKey: convKey,
          requestId: `rapid-${i}`,
          conversationWorkspace: workspace,
          tokenSource: "user_provided",
          onStreamComplete: () => {
            lockReleased = true
            unlockConversation(convKey)
          },
          cancelState,
        })

        const reader = stream.getReader()
        cancelState.reader = reader

        // User clicks Stop (production does both)
        cancelState.requested = true
        reader.cancel() // Unblock the read

        // Wait for lock release (with timeout)
        await new Promise((resolve) => {
          const check = setInterval(() => {
            if (lockReleased) {
              clearInterval(check)
              resolve(undefined)
            }
          }, 10)

          setTimeout(() => {
            clearInterval(check)
            resolve(undefined)
          }, 1000)
        })

        expect(lockReleased).toBe(true)
        expect(isConversationLocked(convKey)).toBe(false)

        reader.releaseLock()
      }
    })
  })

  /**
   * CANCEL DURING STREAMING
   * Tests that cancelState.requested is checked DURING the loop
   */
  describe("Cancel During Active Streaming", () => {
    it("should stop processing when cancelState.requested = true", async () => {
      const locked = tryLockConversation(convKey)
      expect(locked).toBe(true)

      const cancelState: CancelState = { requested: false, reader: null }

      // Stream with buffered events (all sent at once)
      const events = Array.from({ length: 1000 }, (_, i) => ({ type: "message", data: { i } }))
      const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n"

      const childStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(lines))
          // Don't close - keep stream open
        },
      })

      let eventsReceived = 0
      let lockReleased = false

      const stream = createNDJSONStream({
        childStream,
        conversationKey: convKey,
        requestId: "cancel-during",
        conversationWorkspace: workspace,
        tokenSource: "user_provided",
        onStreamComplete: () => {
          lockReleased = true
          unlockConversation(convKey)
        },
        cancelState,
      })

      const reader = stream.getReader()
      cancelState.reader = reader

      // Start consuming
      const consumePromise = (async () => {
        try {
          while (true) {
            const { done } = await reader.read()
            if (done) break
            eventsReceived++

            // Cancel after receiving 100 events
            if (eventsReceived === 100) {
              cancelState.requested = true
            }
          }
        } catch {
          // Expected when stream closes
        }
      })()

      await consumePromise

      // BEHAVIOR TEST: Did it stop processing after cancel?
      expect(eventsReceived).toBeLessThan(1000) // Didn't process all events
      expect(lockReleased).toBe(true)
      expect(isConversationLocked(convKey)).toBe(false)
    })
  })

  /**
   * DOUBLE-UNLOCK PREVENTION
   * Ensures onStreamComplete is called exactly once
   */
  describe("Double-Unlock Prevention", () => {
    it("should call onStreamComplete exactly once when both cancel paths trigger", async () => {
      const locked = tryLockConversation(convKey)
      expect(locked).toBe(true)

      const cancelState: CancelState = { requested: false, reader: null }

      const childStream = new ReadableStream({
        start() {
          // Infinite
        },
      })

      let cleanupCallCount = 0

      const stream = createNDJSONStream({
        childStream,
        conversationKey: convKey,
        requestId: "double-unlock",
        conversationWorkspace: workspace,
        tokenSource: "user_provided",
        onStreamComplete: () => {
          cleanupCallCount++
          unlockConversation(convKey)
        },
        cancelState,
      })

      const reader = stream.getReader()
      cancelState.reader = reader

      // Trigger explicit cancel (which internally calls reader.cancel())
      cancelState.requested = true
      reader.cancel()

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100))

      // CRITICAL: Must be called exactly ONCE even though we called reader.cancel()
      // which triggers the cancel() method in addition to the explicit flag
      expect(cleanupCallCount).toBe(1)
      expect(isConversationLocked(convKey)).toBe(false)
    })
  })

  /**
   * REGISTRY INTEGRATION
   * Full flow: registry → cancelState → lock release
   */
  describe("Full Registry Integration", () => {
    it("should integrate registry → cancelState → lock release → second request succeeds", async () => {
      const requestId = "registry-test"

      // Lock conversation
      const locked1 = tryLockConversation(convKey)
      expect(locked1).toBe(true)

      const cancelState: CancelState = { requested: false, reader: null }

      // Register cancellation (route handler does this)
      // Production API: registerCancellation(requestId, userId, convKey, cancelCallback)
      registerCancellation(requestId, userId, convKey, () => {
        cancelState.requested = true
        cancelState.reader?.cancel() // Unblock any waiting read
      })

      const childStream = new ReadableStream({
        start() {
          // Infinite
        },
      })

      let lock1Released = false

      const stream = createNDJSONStream({
        childStream,
        conversationKey: convKey,
        requestId,
        conversationWorkspace: workspace,
        tokenSource: "user_provided",
        onStreamComplete: () => {
          lock1Released = true
          unlockConversation(convKey)
        },
        cancelState,
      })

      const reader = stream.getReader()
      cancelState.reader = reader

      // User clicks Stop → calls cancel endpoint
      const cancelResult = cancelStream(requestId, userId)
      expect(cancelResult).toBe(true)

      // Verify cancelState was updated by registry callback
      expect(cancelState.requested).toBe(true)

      // Wait for lock release
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (lock1Released) {
            clearInterval(check)
            resolve(undefined)
          }
        }, 10)

        setTimeout(() => {
          clearInterval(check)
          resolve(undefined)
        }, 1000)
      })

      // CRITICAL: Second request should succeed
      const locked2 = tryLockConversation(convKey)
      expect(locked2).toBe(true)
      expect(lock1Released).toBe(true)

      // Cleanup
      unlockConversation(convKey)
      reader.releaseLock()
    })

    it("should handle cancel endpoint called multiple times (idempotent)", async () => {
      const requestId = "idempotent-test"

      const locked = tryLockConversation(convKey)
      expect(locked).toBe(true)

      const cancelState: CancelState = { requested: false, reader: null }

      registerCancellation(requestId, userId, convKey, () => {
        cancelState.requested = true
        cancelState.reader?.cancel()
      })

      const childStream = new ReadableStream({
        start() {
          // Infinite
        },
      })

      let lockReleased = false

      const stream = createNDJSONStream({
        childStream,
        conversationKey: convKey,
        requestId,
        conversationWorkspace: workspace,
        tokenSource: "user_provided",
        onStreamComplete: () => {
          lockReleased = true
          unlockConversation(convKey)
        },
        cancelState,
      })

      const reader = stream.getReader()
      cancelState.reader = reader

      // Call cancel multiple times
      const result1 = cancelStream(requestId, userId)
      const result2 = cancelStream(requestId, userId)
      const result3 = cancelStream(requestId, userId)

      expect(result1).toBe(true) // First succeeds
      expect(result2).toBe(false) // Already cancelled (auto-unregistered)
      expect(result3).toBe(false) // Already cancelled

      // Wait for cleanup
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (lockReleased) {
            clearInterval(check)
            resolve(undefined)
          }
        }, 10)

        setTimeout(() => {
          clearInterval(check)
          resolve(undefined)
        }, 1000)
      })

      expect(lockReleased).toBe(true)

      // Cleanup
      unlockConversation(convKey)
      reader.releaseLock()
    })
  })

  /**
   * EDGE CASES
   * Real-world scenarios that could break the system
   */
  describe("Edge Cases", () => {
    it("should handle cancel before stream starts reading", async () => {
      const locked = tryLockConversation(convKey)
      expect(locked).toBe(true)

      const cancelState: CancelState = { requested: false, reader: null }

      const childStream = new ReadableStream({
        start() {
          // Infinite
        },
      })

      let lockReleased = false

      const stream = createNDJSONStream({
        childStream,
        conversationKey: convKey,
        requestId: "early-cancel",
        conversationWorkspace: workspace,
        tokenSource: "user_provided",
        onStreamComplete: () => {
          lockReleased = true
          unlockConversation(convKey)
        },
        cancelState,
      })

      const reader = stream.getReader()
      cancelState.reader = reader

      // Cancel BEFORE we start consuming
      cancelState.requested = true
      reader.cancel() // Unblock

      // Try to consume (should finish immediately)
      try {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      } catch {
        // Expected
      }

      // Wait for cleanup
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (lockReleased) {
            clearInterval(check)
            resolve(undefined)
          }
        }, 10)

        setTimeout(() => {
          clearInterval(check)
          resolve(undefined)
        }, 500)
      })

      // Lock should be released
      expect(lockReleased).toBe(true)
      expect(isConversationLocked(convKey)).toBe(false)
    })

    it("should release lock even when stream errors", async () => {
      const locked = tryLockConversation(convKey)
      expect(locked).toBe(true)

      const cancelState: CancelState = { requested: false, reader: null }

      // Stream that will error
      const errorStream = new ReadableStream({
        start(controller) {
          controller.error(new Error("Child process crashed"))
        },
      })

      let lockReleased = false

      const stream = createNDJSONStream({
        childStream: errorStream,
        conversationKey: convKey,
        requestId: "error-test",
        conversationWorkspace: workspace,
        tokenSource: "user_provided",
        onStreamComplete: () => {
          lockReleased = true
          unlockConversation(convKey)
        },
        cancelState,
      })

      const reader = stream.getReader()
      cancelState.reader = reader

      // Try to consume (will error)
      try {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      } catch {
        // Expected error
      }

      // Wait for cleanup
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (lockReleased) {
            clearInterval(check)
            resolve(undefined)
          }
        }, 10)

        setTimeout(() => {
          clearInterval(check)
          resolve(undefined)
        }, 500)
      })

      // Lock MUST be released even with error
      expect(lockReleased).toBe(true)
      expect(isConversationLocked(convKey)).toBe(false)
    })
  })
})
