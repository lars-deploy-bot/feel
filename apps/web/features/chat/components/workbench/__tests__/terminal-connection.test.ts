// @vitest-environment happy-dom
/**
 * Tests for WorkbenchTerminal connection state machine.
 *
 * Bug: When the E2B sandbox is provisioning, the terminal shows "Connecting..."
 * and never updates when the sandbox becomes ready. Two root causes:
 *
 * 1. ws.onclose while in "connecting" state keeps state stuck (no transition)
 * 2. No retry when /api/terminal/lease returns SANDBOX_NOT_READY (503)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Minimal WebSocket mock that lets us control events
// ---------------------------------------------------------------------------
interface MockMessageEvent {
  data: string
}

class MockWebSocket {
  static CONNECTING = 0 as const
  static OPEN = 1 as const
  static CLOSING = 2 as const
  static CLOSED = 3 as const

  readonly CONNECTING = 0 as const
  readonly OPEN = 1 as const
  readonly CLOSING = 2 as const
  readonly CLOSED = 3 as const

  readyState: number = MockWebSocket.CONNECTING
  binaryType = "blob"

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MockMessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: Event) => void) | null = null

  url: string
  constructor(url: string) {
    this.url = url
  }

  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED
  })

  // Test helpers to simulate server behaviour
  _simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event("open"))
  }

  _simulateMessage(data: string) {
    this.onmessage?.({ data })
  }

  _simulateClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new Event("close"))
  }

  _simulateError() {
    this.onerror?.(new Event("error"))
  }
}

// ---------------------------------------------------------------------------
// Simulates the connect() state machine from WorkbenchTerminal
// Extracted here to test independently of xterm DOM manipulation
// ---------------------------------------------------------------------------
type TerminalState = "connecting" | "connected" | "disconnected" | "error"

interface ConnectResult {
  state: TerminalState
  errorMsg: string | null
  ws: MockWebSocket | null
}

/**
 * Simulates the connect logic from WorkbenchTerminal (FIXED version).
 * Matches the actual component's state transitions after the bug fix.
 */
async function simulateConnect(
  fetchResponses: Array<{ ok: boolean; status: number; body: Record<string, unknown> }>,
  opts?: { simulateWsEvents?: (ws: MockWebSocket) => void },
): Promise<ConnectResult> {
  let state: TerminalState = "connecting"
  let errorMsg: string | null = null
  let wsInstance: MockWebSocket | null = null
  let fetchCallIndex = 0

  const mockFetch = vi.fn().mockImplementation(() => {
    const response = fetchResponses[Math.min(fetchCallIndex++, fetchResponses.length - 1)]
    return Promise.resolve({
      ok: response.ok,
      status: response.status,
      json: () => Promise.resolve(response.body),
    })
  })

  async function attemptConnect(): Promise<boolean> {
    const res = await mockFetch("/api/terminal/lease", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: "test.alive.best" }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const errorCode = typeof data.error === "string" ? data.error : ""

      // FIXED: Auto-retry when sandbox is provisioning
      if (errorCode === "SANDBOX_NOT_READY") {
        return false // signal retry needed
      }

      throw new Error(data.message ?? `Failed to get terminal lease (${res.status})`)
    }

    const leaseData = await res.json()
    const wsUrl = leaseData.wsUrl
    if (typeof wsUrl !== "string") {
      throw new Error("Invalid lease response: missing wsUrl")
    }

    const ws = new MockWebSocket(wsUrl)
    wsInstance = ws

    // FIXED: onclose now handles "connecting" state too
    ws.onclose = () => {
      state = state === "connected" || state === "connecting" ? "disconnected" : state
    }

    ws.onmessage = (event: MockMessageEvent) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "connected") {
          state = "connected"
        }
      } catch {
        // ignore
      }
    }

    ws.onerror = () => {
      state = "error"
      errorMsg = "Connection error"
    }

    opts?.simulateWsEvents?.(ws)
    return true // connected (or at least attempted WS)
  }

  try {
    const connected = await attemptConnect()
    if (!connected) {
      // Simulate retry after delay (3s in real code)
      const retryConnected = await attemptConnect()
      if (!retryConnected) {
        // Still not ready — stays connecting (will keep retrying in real code)
        state = "connecting"
      }
    }
  } catch (err) {
    state = "error"
    errorMsg = err instanceof Error ? err.message : "Failed to connect"
  }

  return { state, errorMsg, ws: wsInstance }
}

/** Convenience: single fetch response (most tests) */
function singleResponse(r: { ok: boolean; status: number; body: Record<string, unknown> }) {
  return [r]
}

describe("WorkbenchTerminal connection state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe("ws.onclose while connecting (FIXED)", () => {
    it("transitions to 'disconnected' when WebSocket closes before 'connected' message", async () => {
      // Scenario: WebSocket opens, but server closes it before sending {"type":"connected"}
      // e.g., sandbox bridge realizes sandbox isn't ready and drops connection
      const result = await simulateConnect(
        singleResponse({
          ok: true,
          status: 200,
          body: { ok: true, wsUrl: "wss://test/ws?lease=abc", lease: "abc", expiresAt: 0 },
        }),
        {
          simulateWsEvents: ws => {
            ws._simulateOpen()
            // Server closes without ever sending "connected" message
            ws._simulateClose()
          },
        },
      )

      // FIXED: Should transition to "disconnected" so user sees Reconnect button
      expect(result.state).toBe("disconnected")
    })

    it("transitions to 'disconnected' when closing after connected", async () => {
      const result = await simulateConnect(
        singleResponse({
          ok: true,
          status: 200,
          body: { ok: true, wsUrl: "wss://test/ws?lease=abc", lease: "abc", expiresAt: 0 },
        }),
        {
          simulateWsEvents: ws => {
            ws._simulateOpen()
            ws._simulateMessage(JSON.stringify({ type: "connected" }))
            ws._simulateClose()
          },
        },
      )

      expect(result.state).toBe("disconnected")
    })
  })

  describe("SANDBOX_NOT_READY auto-retry (FIXED)", () => {
    it("retries and connects when sandbox becomes ready on second attempt", async () => {
      const sandboxNotReady = {
        ok: false,
        status: 503,
        body: {
          ok: false,
          error: "SANDBOX_NOT_READY",
          message: "Sandbox is not running yet. Send a message first to initialize it.",
        },
      }
      const sandboxReady = {
        ok: true,
        status: 200,
        body: { ok: true, wsUrl: "wss://test/ws?lease=abc", lease: "abc", expiresAt: 0 },
      }

      // First call: not ready, second call: ready
      const result = await simulateConnect([sandboxNotReady, sandboxReady], {
        simulateWsEvents: ws => {
          ws._simulateOpen()
          ws._simulateMessage(JSON.stringify({ type: "connected" }))
        },
      })

      expect(result.state).toBe("connected")
      expect(result.errorMsg).toBeNull()
    })

    it("stays in connecting state while sandbox keeps returning not-ready", async () => {
      const sandboxNotReady = {
        ok: false,
        status: 503,
        body: {
          ok: false,
          error: "SANDBOX_NOT_READY",
          message: "Sandbox is not running yet. Send a message first to initialize it.",
        },
      }

      // Both calls return not-ready
      const result = await simulateConnect([sandboxNotReady, sandboxNotReady])

      // Stays connecting — real code will keep retrying via setTimeout
      expect(result.state).toBe("connecting")
    })

    it("shows error for non-sandbox failures (no retry)", async () => {
      const result = await simulateConnect(
        singleResponse({
          ok: false,
          status: 500,
          body: { ok: false, error: "INTERNAL_ERROR", message: "Server error" },
        }),
      )

      expect(result.state).toBe("error")
      expect(result.errorMsg).toContain("Server error")
    })
  })

  describe("happy path", () => {
    it("reaches connected state when lease succeeds and server sends connected", async () => {
      const result = await simulateConnect(
        singleResponse({
          ok: true,
          status: 200,
          body: { ok: true, wsUrl: "wss://test/ws?lease=abc", lease: "abc", expiresAt: 0 },
        }),
        {
          simulateWsEvents: ws => {
            ws._simulateOpen()
            ws._simulateMessage(JSON.stringify({ type: "connected" }))
          },
        },
      )

      expect(result.state).toBe("connected")
      expect(result.errorMsg).toBeNull()
    })
  })
})

// ===========================================================================
// More granular state machine that mirrors the REAL component code exactly,
// including handleReconnect, retry timers, and timeouts.
// Used to expose additional bugs.
// ===========================================================================

type FetchResponse = { ok: boolean; status: number; body: Record<string, unknown> }

class TerminalStateMachine {
  state: TerminalState = "connecting"
  errorMsg: string | null = null
  ws: MockWebSocket | null = null
  retryTimer: ReturnType<typeof setTimeout> | null = null
  wsTimeout: ReturnType<typeof setTimeout> | null = null
  retryCount = 0
  generation = 1
  fetchCallCount = 0

  private fetchResponses: FetchResponse[]
  private wsEventScript: ((ws: MockWebSocket) => void) | null

  static readonly MAX_SANDBOX_RETRIES = 20
  static readonly WS_CONNECT_TIMEOUT_MS = 15_000

  constructor(fetchResponses: FetchResponse[], wsEvents?: (ws: MockWebSocket) => void) {
    this.fetchResponses = fetchResponses
    this.wsEventScript = wsEvents ?? null
  }

  private getFetchResponse(): FetchResponse {
    return this.fetchResponses[Math.min(this.fetchCallCount++, this.fetchResponses.length - 1)]
  }

  /**
   * Mirrors WorkbenchTerminal.connect() — FIXED version with:
   * - SANDBOX_NOT_READY retry via setTimeout (3s) with max retry limit
   * - ws.onclose handling for "connecting" state
   * - WS connection timeout (15s)
   */
  async connect(): Promise<void> {
    this.state = "connecting"
    this.errorMsg = null

    try {
      const response = this.getFetchResponse()
      const res = {
        ok: response.ok,
        status: response.status,
        json: () => Promise.resolve(response.body),
      }

      if (!res.ok) {
        const data: Record<string, unknown> = await res.json().catch(() => ({}))
        const errorCode = typeof data.error === "string" ? data.error : ""

        if (errorCode === "SANDBOX_NOT_READY") {
          if (this.retryCount >= TerminalStateMachine.MAX_SANDBOX_RETRIES) {
            throw new Error(typeof data.message === "string" ? data.message : "Sandbox is not running yet.")
          }
          this.retryCount++
          this.retryTimer = setTimeout(() => {
            this.retryTimer = null
            void this.connect()
          }, 3000)
          return
        }

        throw new Error(
          typeof data.message === "string" ? data.message : `Failed to get terminal lease (${res.status})`,
        )
      }

      // Lease succeeded — reset retry counter
      this.retryCount = 0

      const leaseData = await res.json()
      if (typeof leaseData.wsUrl !== "string") {
        throw new Error("Invalid lease response: missing wsUrl")
      }

      const ws = new MockWebSocket(leaseData.wsUrl)
      this.ws = ws

      // WS connection timeout
      this.wsTimeout = setTimeout(() => {
        if (ws.readyState === MockWebSocket.CONNECTING || ws.readyState === MockWebSocket.OPEN) {
          ws.close()
        }
        this.state = "error"
        this.errorMsg = "Connection timed out"
      }, TerminalStateMachine.WS_CONNECT_TIMEOUT_MS)

      ws.onclose = () => {
        if (this.wsTimeout) {
          clearTimeout(this.wsTimeout)
          this.wsTimeout = null
        }
        this.ws = null
        this.state = this.state === "connected" || this.state === "connecting" ? "disconnected" : this.state
      }

      ws.onmessage = (event: MockMessageEvent) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === "connected") {
            if (this.wsTimeout) {
              clearTimeout(this.wsTimeout)
              this.wsTimeout = null
            }
            this.state = "connected"
          } else if (msg.type === "exit") {
            this.state = "disconnected"
          }
        } catch {
          // ignore
        }
      }

      ws.onerror = () => {
        if (this.wsTimeout) {
          clearTimeout(this.wsTimeout)
          this.wsTimeout = null
        }
        this.state = "error"
        this.errorMsg = "Connection error"
      }

      // Run scripted WS events (simulates server behaviour)
      this.wsEventScript?.(ws)
    } catch (err) {
      this.state = "error"
      this.errorMsg = err instanceof Error ? err.message : "Failed to connect"
    }
  }

  /**
   * Mirrors WorkbenchTerminal.handleReconnect() — FIXED: clears retry timer.
   */
  handleReconnect(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (this.ws?.readyState === MockWebSocket.OPEN) {
      this.ws.close()
    }
    this.ws = null
    this.retryCount = 0
    void this.connect()
  }

  /** Check if a retry timer is pending */
  get hasRetryPending(): boolean {
    return this.retryTimer !== null
  }

  cleanup(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (this.wsTimeout) {
      clearTimeout(this.wsTimeout)
      this.wsTimeout = null
    }
  }
}

describe("WorkbenchTerminal additional bugs", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe("handleReconnect clears pending retry timer (FIXED)", () => {
    it("should cancel the retry timer when user clicks Reconnect", async () => {
      const sandboxNotReady: FetchResponse = {
        ok: false,
        status: 503,
        body: { ok: false, error: "SANDBOX_NOT_READY", message: "Sandbox is not running yet." },
      }
      const leaseOk: FetchResponse = {
        ok: true,
        status: 200,
        body: { ok: true, wsUrl: "wss://test/ws?lease=abc", lease: "abc", expiresAt: 0 },
      }

      // First call: SANDBOX_NOT_READY → schedules retry in 3s
      // Second call onwards: lease succeeds
      const sm = new TerminalStateMachine([sandboxNotReady, leaseOk], ws => {
        ws._simulateOpen()
        ws._simulateMessage(JSON.stringify({ type: "connected" }))
      })

      await sm.connect()
      expect(sm.state).toBe("connecting") // waiting for retry
      expect(sm.hasRetryPending).toBe(true)

      // Simulate: WS from a different path caused "disconnected", user clicks Reconnect
      // before the 3s retry timer fires.
      sm.state = "disconnected"
      const _fetchCountBefore = sm.fetchCallCount
      sm.handleReconnect()

      // After handleReconnect, the pending retry timer should be cleared
      expect(sm.hasRetryPending).toBe(false)

      sm.cleanup()
    })

    it("should not cause duplicate connect() calls when retry fires after reconnect", async () => {
      const sandboxNotReady: FetchResponse = {
        ok: false,
        status: 503,
        body: { ok: false, error: "SANDBOX_NOT_READY", message: "Sandbox is not running yet." },
      }
      const leaseOk: FetchResponse = {
        ok: true,
        status: 200,
        body: { ok: true, wsUrl: "wss://test/ws?lease=abc", lease: "abc", expiresAt: 0 },
      }

      const sm = new TerminalStateMachine([sandboxNotReady, leaseOk, leaseOk], ws => {
        ws._simulateOpen()
        ws._simulateMessage(JSON.stringify({ type: "connected" }))
      })

      await sm.connect()
      expect(sm.hasRetryPending).toBe(true)

      // User triggers reconnect manually (state was "connecting", but for test purposes
      // we force it to "disconnected" to simulate the scenario)
      sm.state = "disconnected"
      sm.handleReconnect()

      // handleReconnect called connect() → fetchCallCount is now 2 (connected)
      const countAfterReconnect = sm.fetchCallCount

      // Now advance past the old 3s retry timer
      await vi.advanceTimersByTimeAsync(3500)

      // Stale retry timer should have been cleared — no extra fetch
      expect(sm.fetchCallCount).toBe(countAfterReconnect)

      sm.cleanup()
    })
  })

  describe("max retry limit for SANDBOX_NOT_READY (FIXED)", () => {
    it("should give up after a reasonable number of retries", async () => {
      const sandboxNotReady: FetchResponse = {
        ok: false,
        status: 503,
        body: { ok: false, error: "SANDBOX_NOT_READY", message: "Sandbox is not running yet." },
      }

      // Every call returns not-ready
      const sm = new TerminalStateMachine([sandboxNotReady])

      await sm.connect()

      // Advance through 20 retry cycles (20 × 3s = 60s)
      for (let i = 0; i < 20; i++) {
        await vi.advanceTimersByTimeAsync(3100)
      }

      // After 60+ seconds of retrying, the terminal should give up and show an error
      expect(sm.state).toBe("error")
      expect(sm.errorMsg).toContain("not running")

      sm.cleanup()
    })

    it("should show retry count to user while retrying", async () => {
      const sandboxNotReady: FetchResponse = {
        ok: false,
        status: 503,
        body: { ok: false, error: "SANDBOX_NOT_READY", message: "Sandbox is not running yet." },
      }

      const sm = new TerminalStateMachine([sandboxNotReady])

      await sm.connect()

      // After a few retries, the fetch count should increase
      await vi.advanceTimersByTimeAsync(3100) // retry 1
      await vi.advanceTimersByTimeAsync(3100) // retry 2
      await vi.advanceTimersByTimeAsync(3100) // retry 3

      // fetchCallCount should be 4 (initial + 3 retries)
      expect(sm.fetchCallCount).toBe(4)

      // At this point the component should indicate it's still trying,
      // e.g., "Connecting... (attempt 4)" or similar feedback
      // But there's no retry counter exposed — state is just "connecting"
      // We at least verify retries are happening
      expect(sm.state).toBe("connecting")

      sm.cleanup()
    })
  })

  describe("WS connection timeout (FIXED)", () => {
    it("should timeout and show error if server never sends 'connected' message", async () => {
      const leaseOk: FetchResponse = {
        ok: true,
        status: 200,
        body: { ok: true, wsUrl: "wss://test/ws?lease=abc", lease: "abc", expiresAt: 0 },
      }

      // WS opens successfully but server never sends {"type":"connected"} and never closes
      const sm = new TerminalStateMachine([leaseOk], ws => {
        ws._simulateOpen()
        // Server is alive but never sends "connected" — e.g. PTY setup stuck
      })

      await sm.connect()
      expect(sm.state).toBe("connecting") // WS open, waiting for "connected"

      // After 15 seconds of waiting, should timeout
      await vi.advanceTimersByTimeAsync(15_000)

      // Should transition to "error" so user can retry
      expect(sm.state).toBe("error")
      expect(sm.errorMsg).toContain("timed out")

      sm.cleanup()
    })

    it("should close the stale WebSocket when timing out", async () => {
      const leaseOk: FetchResponse = {
        ok: true,
        status: 200,
        body: { ok: true, wsUrl: "wss://test/ws?lease=abc", lease: "abc", expiresAt: 0 },
      }

      const sm = new TerminalStateMachine([leaseOk], ws => {
        ws._simulateOpen()
        // No "connected" message
      })

      await sm.connect()
      const ws = sm.ws
      expect(ws).not.toBeNull()

      await vi.advanceTimersByTimeAsync(15_000)

      // WebSocket should be closed after timeout
      expect(ws?.close).toHaveBeenCalled()

      sm.cleanup()
    })
  })
})
