"use client"

import { useCallback, useRef, useState } from "react"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { BridgeInterruptSource } from "@/features/chat/lib/streaming/ndjson"
import { trackStreamStopped } from "@/lib/analytics/events"
import { postty } from "@/lib/api/api-client"
import { validateRequest } from "@/lib/api/schemas"
import { clearAbortController, getAbortController, useStreamingActions } from "@/lib/stores/streamingStore"

interface UseStreamCancellationOptions {
  /** Current tab ID (session key for Claude SDK) */
  tabId: string
  /** Current tab group ID */
  tabGroupId: string | null
  /** Current workspace */
  workspace: string | null
  /** Current worktree */
  worktree?: string | null
  /** Whether worktrees are enabled for this workspace */
  worktreesEnabled: boolean
  /**
   * Callback to add message to chat.
   * IMPORTANT: targetTabId is REQUIRED for tab isolation.
   * Without it, interrupt messages could be added to the wrong tab.
   */
  addMessage: (message: UIMessage, targetTabId: string) => void
  /** Callback to show completion dots */
  setShowCompletionDots: (show: boolean) => void
  /** Ref to the abort controller for the current request */
  abortControllerRef: React.MutableRefObject<AbortController | null>
  /** Ref to the current request ID */
  currentRequestIdRef: React.MutableRefObject<string | null>
  /** Ref to track per-tab submission state */
  isSubmittingByTabRef: React.MutableRefObject<Map<string, boolean>>
  /** Optional callback for dev terminal events */
  onDevEvent?: (event: { type: string; data: unknown }) => void
}

interface UseStreamCancellationReturn {
  /** Call to stop the current stream */
  stopStreaming: () => void
  /** Whether currently in the process of stopping */
  isStopping: boolean
}

interface CancelApiResponse {
  ok: boolean
  status: "cancelled" | "already_complete" | "ignored_unload_beacon" | "cancel_queued"
  requestId?: string
  tabId?: string
}

interface ReconnectProbeResponse {
  ok: boolean
  hasStream: boolean
  state?: "streaming" | "complete" | "error"
  requestId?: string
}

type StopVerificationResult =
  | { status: "confirmed" }
  | { status: "still_streaming"; requestId?: string }
  | { status: "unknown" }

/**
 * Hook for managing stream cancellation with type-safe API calls
 *
 * Features:
 * - Double-click protection via isStopping guard
 * - Fire-and-forget cancel request (non-blocking UI)
 * - Type-safe API calls with Zod validation
 * - Clean abort handling
 *
 * @example
 * ```tsx
 * const { stopStreaming } = useStreamCancellation({
 *   tabId,
 *   workspace,
 *   addMessage,
 *   setShowCompletionDots,
 *   abortControllerRef,
 *   currentRequestIdRef,
 *   isSubmittingByTabRef,
 * })
 *
 * <button onClick={stopStreaming}>Stop</button>
 * ```
 */
export function useStreamCancellation({
  tabId,
  tabGroupId,
  workspace,
  worktree,
  worktreesEnabled,
  addMessage,
  setShowCompletionDots,
  abortControllerRef,
  currentRequestIdRef,
  isSubmittingByTabRef,
  onDevEvent,
}: UseStreamCancellationOptions): UseStreamCancellationReturn {
  // Ref for immediate guard (prevents double-click during same sync tick)
  const isStoppingRef = useRef(false)
  // State for external visibility (triggers re-renders for consumers)
  const [isStopping, setIsStopping] = useState(false)
  const streamingActions = useStreamingActions()
  const requestWorktree = worktreesEnabled ? worktree || undefined : undefined

  const stopStreaming = useCallback(() => {
    // Guard against double-clicks (ref for immediate check)
    if (isStoppingRef.current) return
    isStoppingRef.current = true
    setIsStopping(true)
    trackStreamStopped({ workspace })

    // Log to dev terminal if callback provided
    onDevEvent?.({
      type: "client.interrupt",
      data: {
        message: "Response interrupted by user",
        source: "client_cancel",
        tabId,
        timestamp: new Date().toISOString(),
      },
    })

    // Capture requestId BEFORE nulling it
    const requestIdToCancel = currentRequestIdRef.current

    // Helper to reset all states after cancellation handling completes.
    const finishCancellation = () => {
      if (tabId) isSubmittingByTabRef.current.set(tabId, false)
      isStoppingRef.current = false
      setIsStopping(false)
      setShowCompletionDots(false)
    }

    const addInterruptMessage = (message: string) => {
      if (!tabId) return
      const interruptMessage: UIMessage = {
        id: crypto.randomUUID(),
        type: "interrupt",
        content: {
          message,
          source: BridgeInterruptSource.CLIENT_CANCEL,
        },
        timestamp: new Date(),
      }
      addMessage(interruptMessage, tabId)
    }

    // Capture stack trace for debugging (helps identify where cancel originated)
    const clientStack = new Error().stack?.split("\n").slice(1, 6).join("\n") // First 5 frames

    const sendCancelRequest = async (): Promise<CancelApiResponse | null> => {
      // Send cancel request to backend and return typed status.
      try {
        if (requestIdToCancel) {
          const validatedRequest = validateRequest("claude/stream/cancel", {
            requestId: requestIdToCancel,
            clientStack,
          })
          return (await postty("claude/stream/cancel", validatedRequest)) as CancelApiResponse
        } else if (tabId.length > 0 && tabGroupId && workspace) {
          const validatedRequest = validateRequest("claude/stream/cancel", {
            tabGroupId,
            tabId,
            workspace,
            ...(requestWorktree ? { worktree: requestWorktree } : {}),
            clientStack,
          })
          return (await postty("claude/stream/cancel", validatedRequest)) as CancelApiResponse
        } else {
          console.warn("[useStreamCancellation] No requestId or tabId available - relying on abort() only")
          return null
        }
      } catch (error) {
        console.error("[useStreamCancellation] Cancel request failed:", error)
        return null
      }
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    const verifyStopState = async (): Promise<StopVerificationResult> => {
      if (!tabId || !tabGroupId || !workspace) {
        return { status: "unknown" }
      }

      const attempts = 6
      const retryDelayMs = 300
      let sawStreamingState = false
      let activeRequestId: string | undefined

      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          const response = await fetch("/api/claude/stream/reconnect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              tabGroupId,
              tabId,
              workspace,
              ...(requestWorktree ? { worktree: requestWorktree } : {}),
              acknowledge: false,
            }),
          })

          if (response.ok) {
            const probe = (await response.json()) as ReconnectProbeResponse

            if (!probe.hasStream) {
              return { status: "confirmed" }
            }

            if (probe.state === "complete" || probe.state === "error") {
              return { status: "confirmed" }
            }

            if (probe.state === "streaming") {
              sawStreamingState = true
              activeRequestId = probe.requestId
            }
          }
        } catch (error) {
          console.warn("[useStreamCancellation] Reconnect verification failed:", error)
        }

        if (attempt < attempts - 1) {
          await sleep(retryDelayMs)
        }
      }

      if (sawStreamingState) {
        return { status: "still_streaming", requestId: activeRequestId }
      }

      return { status: "unknown" }
    }

    const CANCEL_REQUEST_TIMEOUT_MS = 6000
    const CANCEL_TIMEOUT = Symbol("cancel-timeout")
    const sendCancelWithTimeout = async (): Promise<CancelApiResponse | null | typeof CANCEL_TIMEOUT> => {
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null
      const timeoutPromise = new Promise<typeof CANCEL_TIMEOUT>(resolve => {
        timeoutHandle = setTimeout(() => resolve(CANCEL_TIMEOUT), CANCEL_REQUEST_TIMEOUT_MS)
      })

      try {
        return await Promise.race([sendCancelRequest(), timeoutPromise])
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }
      }
    }

    const resolveStop = async () => {
      try {
        const cancelResponse = await sendCancelWithTimeout()

        if (cancelResponse === CANCEL_TIMEOUT) {
          console.warn(
            `[useStreamCancellation] Cancel request timed out after ${CANCEL_REQUEST_TIMEOUT_MS}ms, verifying state`,
          )
        }

        if (cancelResponse && cancelResponse !== CANCEL_TIMEOUT && cancelResponse.status === "cancelled") {
          addInterruptMessage("Response stopped.")
          finishCancellation()
          return
        }

        const verification = await verifyStopState()

        if (verification.status === "confirmed") {
          addInterruptMessage("Response stopped.")
          finishCancellation()
          return
        }

        if (verification.status === "still_streaming") {
          // Stream is still running on backend - reflect that truthfully in UI.
          if (verification.requestId) {
            currentRequestIdRef.current = verification.requestId
          }
          if (tabId) {
            streamingActions.startStream(tabId)
          }
          addInterruptMessage("Stop not confirmed. Response is still running. Press Stop again.")
          finishCancellation()
          return
        }

        addInterruptMessage("Could not confirm stop. Check whether the response is still updating.")
        finishCancellation()
      } catch (error) {
        console.error("[useStreamCancellation] Unexpected stop resolution error:", error)
        addInterruptMessage("Could not confirm stop due to an internal error. Please try stopping again.")
        finishCancellation()
      }
    }

    // Immediately abort the client-side stream
    // Use per-tab abort controller for tabs support
    const perTabController = tabId ? getAbortController(tabId) : null
    if (perTabController) {
      perTabController.abort()
      clearAbortController(tabId)
    }
    // Also clear the ref for backward compatibility
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    currentRequestIdRef.current = null

    // End stream tracking
    if (tabId) {
      streamingActions.endStream(tabId)
    }

    // Add completion message to mark thinking group as complete
    // CRITICAL: Pass tabId for tab isolation - without it,
    // this message could be added to the wrong tab if user switched tabs
    const interruptMessage: UIMessage = {
      id: crypto.randomUUID(),
      type: "complete",
      content: {},
      timestamp: new Date(),
    }
    addMessage(interruptMessage, tabId)

    // Show completion dots while waiting for backend confirmation
    setShowCompletionDots(true)

    // Resolve stop status asynchronously; UI remains in "stopping" state until then.
    void resolveStop()
  }, [
    tabId,
    tabGroupId,
    workspace,
    requestWorktree,
    addMessage,
    setShowCompletionDots,
    abortControllerRef,
    currentRequestIdRef,
    isSubmittingByTabRef,
    streamingActions,
    onDevEvent,
  ])

  return {
    stopStreaming,
    isStopping,
  }
}
