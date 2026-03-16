"use client"

import { useCallback, useRef, useState } from "react"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { BridgeInterruptSource, type InterruptDetails, InterruptStatus } from "@/features/chat/lib/streaming/ndjson"
import { trackStreamStopped } from "@/lib/analytics/events"
import { postty } from "@/lib/api/api-client"
import { validateRequest } from "@/lib/api/schemas"
import { useDexieMessageStore } from "@/lib/db/dexieMessageStore"
import { clearAbortController, getAbortController, useStreamingActions } from "@/lib/stores/streamingStore"
import { CANCEL_ENDPOINT_STATUS, type CancelEndpointStatus } from "@/lib/stream/cancel-status"

interface UseStreamCancellationOptions {
  /** Current tab ID (session key for Claude SDK). Null when no active session. */
  tabId: string | null
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
  status: CancelEndpointStatus
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
  | { status: "confirmed"; attempts: number }
  | { status: "still_streaming"; requestId?: string; attempts: number }
  | { status: "unknown"; attempts: number }

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
    // No tab = nothing to stop
    if (!tabId) return
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
    const stopId = crypto.randomUUID()
    const startedAt = new Date().toISOString()

    // Capture resume pin from last visible assistant state so next send
    // resumes from what user saw before Stop.
    void useDexieMessageStore
      .getState()
      .captureResumeSessionAtFromLatestAssistant(tabId)
      .catch(error => {
        console.warn("[useStreamCancellation] Failed to capture resume pin from latest assistant message:", error)
      })

    // Helper to reset all states after cancellation handling completes.
    const finishCancellation = () => {
      if (tabId) isSubmittingByTabRef.current.set(tabId, false)
      isStoppingRef.current = false
      setIsStopping(false)
      setShowCompletionDots(false)
    }

    const buildInterruptContent = (message: string, status: InterruptStatus, details: InterruptDetails = {}) => ({
      message,
      source: BridgeInterruptSource.CLIENT_CANCEL,
      status,
      details: {
        stopId,
        startedAt,
        stopRequestId: requestIdToCancel || undefined,
        ...details,
      },
    })

    // Stable ID for the interrupt message — allows update-in-place
    const interruptMessageId = `interrupt-${stopId}`

    const addInterruptMessage = (message: string, status: InterruptStatus, details: InterruptDetails = {}) => {
      if (!tabId) return
      const interruptMessage: UIMessage = {
        id: interruptMessageId,
        type: "interrupt",
        content: buildInterruptContent(message, status, details),
        timestamp: new Date(),
      }
      addMessage(interruptMessage, tabId)
    }

    /** Update the existing interrupt message in place (Dexie live query triggers re-render) */
    const resolveInterruptMessage = async (
      message: string,
      status: InterruptStatus,
      details: InterruptDetails = {},
    ) => {
      const nextContent = buildInterruptContent(message, status, details)
      const updated = await useDexieMessageStore.getState().updateMessageContent(interruptMessageId, nextContent)
      if (updated || !tabId) return

      // Race fallback: if initial add wasn't persisted yet, insert final state directly.
      addMessage(
        {
          id: interruptMessageId,
          type: "interrupt",
          content: nextContent,
          timestamp: new Date(),
        },
        tabId,
      )
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
        return { status: "unknown", attempts: 0 }
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
              return { status: "confirmed", attempts: attempt + 1 }
            }

            if (probe.state === "complete" || probe.state === "error") {
              return { status: "confirmed", attempts: attempt + 1 }
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
        return { status: "still_streaming", requestId: activeRequestId, attempts }
      }

      return { status: "unknown", attempts }
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

        if (
          cancelResponse &&
          cancelResponse !== CANCEL_TIMEOUT &&
          cancelResponse.status === CANCEL_ENDPOINT_STATUS.CANCELLED
        ) {
          await resolveInterruptMessage("Response stopped.", InterruptStatus.STOPPED, {
            resolvedAt: new Date().toISOString(),
            cancelStatus: CANCEL_ENDPOINT_STATUS.CANCELLED,
            verificationResult: "skipped",
            verificationAttempts: 0,
          })
          finishCancellation()
          return
        }

        if (
          cancelResponse &&
          cancelResponse !== CANCEL_TIMEOUT &&
          cancelResponse.status === CANCEL_ENDPOINT_STATUS.ALREADY_COMPLETE
        ) {
          await resolveInterruptMessage("Response already finished before stop.", InterruptStatus.FINISHED, {
            resolvedAt: new Date().toISOString(),
            cancelStatus: CANCEL_ENDPOINT_STATUS.ALREADY_COMPLETE,
            verificationResult: "skipped",
            verificationAttempts: 0,
            reason: "Stop arrived after the response had already completed.",
          })
          finishCancellation()
          return
        }

        const verification = await verifyStopState()

        if (verification.status === "confirmed") {
          await resolveInterruptMessage("Response is no longer running.", InterruptStatus.FINISHED, {
            resolvedAt: new Date().toISOString(),
            cancelStatus: cancelResponse === CANCEL_TIMEOUT ? "timeout" : (cancelResponse?.status ?? "failed"),
            verificationResult: "confirmed",
            verificationAttempts: verification.attempts,
            reason: "The stream is no longer active, but stop cause could not be proven as explicit cancellation.",
          })
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
            useDexieMessageStore.getState().clearResumeSessionAt(tabId)
          }
          await resolveInterruptMessage(
            "Stop not confirmed. Response is still running. Press Stop again.",
            InterruptStatus.STILL_RUNNING,
            {
              resolvedAt: new Date().toISOString(),
              activeRequestId: verification.requestId,
              cancelStatus: cancelResponse === CANCEL_TIMEOUT ? "timeout" : (cancelResponse?.status ?? "failed"),
              verificationResult: "still_streaming",
              verificationAttempts: verification.attempts,
              reason: "Backend still reports this stream as active.",
            },
          )
          finishCancellation()
          return
        }

        await resolveInterruptMessage(
          "Could not confirm stop. Check whether the response is still updating.",
          InterruptStatus.NOT_VERIFIED,
          {
            resolvedAt: new Date().toISOString(),
            cancelStatus: cancelResponse === CANCEL_TIMEOUT ? "timeout" : (cancelResponse?.status ?? "failed"),
            verificationResult: "unknown",
            verificationAttempts: verification.attempts,
            reason: "Stop status could not be verified after retries.",
          },
        )
        finishCancellation()
      } catch (error) {
        console.error("[useStreamCancellation] Unexpected stop resolution error:", error)
        await resolveInterruptMessage(
          "Could not confirm stop due to an internal error. Please try stopping again.",
          InterruptStatus.NOT_VERIFIED,
          {
            resolvedAt: new Date().toISOString(),
            cancelStatus: "failed",
            verificationResult: "unknown",
            reason: error instanceof Error ? error.message : "Unexpected stop resolution failure",
          },
        )
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

    addInterruptMessage("Stopping response...", InterruptStatus.STOPPING, {
      reason: "User pressed Stop. Waiting for backend confirmation.",
    })

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
