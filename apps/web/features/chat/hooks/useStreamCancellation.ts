"use client"

import { useCallback, useRef, useState } from "react"
import { postty } from "@/lib/api/api-client"
import { validateRequest } from "@/lib/api/schemas"
import type { UIMessage } from "@/features/chat/lib/message-parser"
import { useStreamingActions, getAbortController, clearAbortController } from "@/lib/stores/streamingStore"

interface UseStreamCancellationOptions {
  /** Current conversation ID */
  conversationId: string
  /** Current workspace */
  workspace: string | null
  /**
   * Callback to add message to chat.
   * IMPORTANT: targetConversationId is REQUIRED for tab isolation.
   * Without it, interrupt messages could be added to the wrong tab.
   */
  addMessage: (message: UIMessage, targetConversationId: string) => void
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

    // Capture requestId BEFORE nulling it
    const requestIdToCancel = currentRequestIdRef.current
    console.log(
      "[useStreamCancellation] requestIdToCancel:",
      requestIdToCancel,
      "conversationId:",
      conversationId,
      "workspace:",
      workspace,
    )

    // Helper to reset all states after cancellation completes
    // No delay needed - cancel endpoint now waits for lock release before responding
    // Note: busy state is derived from streamingStore.isStreamActive, no need to set it
    const finishCancellation = () => {
      isSubmittingRef.current = false
      isStoppingRef.current = false
      setIsStopping(false)
      setShowCompletionDots(false)
      console.log("[useStreamCancellation] Cancellation complete, states reset")
    }

    // Send cancel request and wait for confirmation
    // Backend now waits for cleanup to complete before responding, so response = safe to send new message
    const sendCancelRequest = async () => {
      try {
        if (requestIdToCancel) {
          // Primary path: Cancel by requestId
          console.log("[useStreamCancellation] Sending cancel with requestId:", requestIdToCancel)
          const validatedRequest = validateRequest("claude/stream/cancel", { requestId: requestIdToCancel })
          const response = await postty("claude/stream/cancel", validatedRequest)
          console.log("[useStreamCancellation] Cancel response:", JSON.stringify(response))
        } else if (conversationId.length > 0 && workspace) {
          // Fallback path: Cancel by tabId (super-early Stop)
          // Note: conversationId variable is now used as tabId for the API
          console.log("[useStreamCancellation] Sending cancel with tabId fallback:", conversationId)
          const validatedRequest = validateRequest("claude/stream/cancel", { tabId: conversationId, workspace })
          const response = await postty("claude/stream/cancel", validatedRequest)
          console.log("[useStreamCancellation] Cancel response (fallback):", JSON.stringify(response))
        } else {
          console.warn("[useStreamCancellation] No requestId or tabId available - relying on abort() only")
        }
      } catch (error) {
        console.error("[useStreamCancellation] Cancel request failed:", error)
        // Continue anyway - the abort() should have worked
      }

      // Backend confirmed (or failed) - finish cancellation
      finishCancellation()
    }

    // Immediately abort the client-side stream
    // Use per-conversation abort controller for tabs support
    const perConvoController = conversationId ? getAbortController(conversationId) : null
    if (perConvoController) {
      perConvoController.abort()
      clearAbortController(conversationId)
    }
    // Also clear the ref for backward compatibility
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
    // CRITICAL: Pass conversationId for tab isolation - without it,
    // this message could be added to the wrong tab if user switched tabs
    const interruptMessage: UIMessage = {
      id: crypto.randomUUID(),
      type: "complete",
      content: {},
      timestamp: new Date(),
    }
    addMessage(interruptMessage, conversationId)

    // Show completion dots while waiting for backend confirmation
    setShowCompletionDots(true)

    // Send cancel request (async, but we don't await in the callback)
    // Use timeout as fallback in case request hangs
    const timeoutId = setTimeout(() => {
      console.warn("[useStreamCancellation] Cancel request timed out after 5s, forcing finish")
      finishCancellation()
    }, 5000)

    sendCancelRequest().finally(() => {
      clearTimeout(timeoutId)
    })
  }, [
    conversationId,
    workspace,
    addMessage,
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
