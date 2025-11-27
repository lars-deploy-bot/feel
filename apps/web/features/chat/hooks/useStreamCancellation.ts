"use client"

import { useCallback, useRef, useState } from "react"
import { postty } from "@/lib/api/api-client"
import { validateRequest } from "@/lib/api/schemas"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { useStreamingActions } from "@/lib/stores/streamingStore"

interface UseStreamCancellationOptions {
  /** Current conversation ID */
  conversationId: string
  /** Current workspace */
  workspace: string | null
  /** Callback to add message to chat */
  addMessage: (message: UIMessage) => void
  /** Callback to set busy state */
  setBusy: (busy: boolean) => void
  /** Callback to show completion dots */
  setShowCompletionDots: (show: boolean) => void
  /** Ref to the abort controller for the current request */
  abortControllerRef: React.MutableRefObject<AbortController | null>
  /** Ref to the current request ID */
  currentRequestIdRef: React.MutableRefObject<string | null>
  /** Ref to track if currently submitting */
  isSubmittingRef: React.MutableRefObject<boolean>
  /** Optional callback for dev terminal events */
  onDevEvent?: (event: { type: string; data: unknown }) => void
}

interface UseStreamCancellationReturn {
  /** Call to stop the current stream */
  stopStreaming: () => void
  /** Whether currently in the process of stopping */
  isStopping: boolean
}

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
 *   conversationId,
 *   workspace,
 *   addMessage,
 *   setBusy,
 *   setShowCompletionDots,
 *   abortControllerRef,
 *   currentRequestIdRef,
 *   isSubmittingRef,
 * })
 *
 * <button onClick={stopStreaming}>Stop</button>
 * ```
 */
export function useStreamCancellation({
  conversationId,
  workspace,
  addMessage,
  setBusy,
  setShowCompletionDots,
  abortControllerRef,
  currentRequestIdRef,
  isSubmittingRef,
  onDevEvent,
}: UseStreamCancellationOptions): UseStreamCancellationReturn {
  // Ref for immediate guard (prevents double-click during same sync tick)
  const isStoppingRef = useRef(false)
  // State for external visibility (triggers re-renders for consumers)
  const [isStopping, setIsStopping] = useState(false)
  const streamingActions = useStreamingActions()

  const stopStreaming = useCallback(() => {
    // Guard against double-clicks (ref for immediate check)
    if (isStoppingRef.current) {
      console.log("[useStreamCancellation] Already stopping, ignoring")
      return
    }
    isStoppingRef.current = true
    setIsStopping(true)

    console.log("[useStreamCancellation] Stopping stream, requestId:", currentRequestIdRef.current)

    // Log to dev terminal if callback provided
    onDevEvent?.({
      type: "client.interrupt",
      data: {
        message: "Response interrupted by user",
        source: "client_cancel",
        conversationId,
        timestamp: new Date().toISOString(),
      },
    })

    // Fire-and-forget cancel request (non-blocking)
    const requestIdToCancel = currentRequestIdRef.current

    if (requestIdToCancel) {
      // Primary path: Cancel by requestId
      console.log("[useStreamCancellation] Firing cancel with requestId:", requestIdToCancel)
      try {
        const validatedRequest = validateRequest("claude/stream/cancel", { requestId: requestIdToCancel })
        void postty("claude/stream/cancel", validatedRequest).catch(error => {
          console.error("[useStreamCancellation] Cancel request failed (non-blocking):", error)
        })
      } catch (validationError) {
        console.error("[useStreamCancellation] Request validation failed:", validationError)
      }
    } else if (conversationId.length > 0 && workspace) {
      // Fallback path: Cancel by conversationId (super-early Stop)
      console.log("[useStreamCancellation] Firing cancel with conversationId fallback:", conversationId)
      try {
        const validatedRequest = validateRequest("claude/stream/cancel", { conversationId, workspace })
        void postty("claude/stream/cancel", validatedRequest).catch(error => {
          console.error("[useStreamCancellation] Cancel request failed (non-blocking):", error)
        })
      } catch (validationError) {
        console.error("[useStreamCancellation] Request validation failed:", validationError)
      }
    } else {
      console.warn("[useStreamCancellation] No requestId or conversationId available - relying on abort() only")
    }

    // Immediately abort and reset UI (don't wait for cancel endpoint)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    currentRequestIdRef.current = null

    // End stream tracking
    if (conversationId) {
      streamingActions.endStream(conversationId)
    }

    // Add completion message to mark thinking group as complete
    const interruptMessage: UIMessage = {
      id: crypto.randomUUID(),
      type: "complete",
      content: {},
      timestamp: new Date(),
    }
    addMessage(interruptMessage)

    // Reset UI state
    setBusy(false)
    setShowCompletionDots(true)
    isSubmittingRef.current = false
    isStoppingRef.current = false
    setIsStopping(false)
  }, [
    conversationId,
    workspace,
    addMessage,
    setBusy,
    setShowCompletionDots,
    abortControllerRef,
    currentRequestIdRef,
    isSubmittingRef,
    streamingActions,
    onDevEvent,
  ])

  return {
    stopStreaming,
    isStopping,
  }
}
