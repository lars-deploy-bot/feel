"use client"

import { useEffect, useRef } from "react"
import { EXPLICIT_STOP_UNLOAD_BEACON_MARKER } from "@/lib/stream/cancel-markers"

interface UseBrowserCleanupOptions {
  /** Current tab ID */
  tabId: string | null
  /** Current tab group ID */
  tabGroupId: string | null
  /** Current workspace */
  workspace: string | null
  /** Current worktree */
  worktree?: string | null
  /** Whether worktrees are enabled for this workspace */
  worktreesEnabled: boolean
  /** Last stream sequence seen by client (for cursor ack) */
  lastSeenStreamSeq: number | null
  /** Whether we're currently streaming */
  isStreaming: boolean
  /** Whether an explicit stop is in progress */
  isStopping: boolean
}

/**
 * Hook that sends unload-time stream cursor acknowledgements.
 *
 * Uses navigator.sendBeacon() which is the only reliable way to send requests
 * during page unload.
 *
 * Important behavior:
 * - DO NOT cancel active streams on unload. Reloads trigger unload too, and
 *   cancelling there breaks background processing + reconnect.
 * - We only send a best-effort cursor acknowledgement to reduce replay bursts.
 */
export function useBrowserCleanup({
  tabId,
  tabGroupId,
  workspace,
  worktree,
  worktreesEnabled,
  lastSeenStreamSeq,
  isStreaming,
  isStopping,
}: UseBrowserCleanupOptions): void {
  // Track streaming state in ref so handler sees current value
  const isStreamingRef = useRef(isStreaming)
  isStreamingRef.current = isStreaming
  const isStoppingRef = useRef(isStopping)
  isStoppingRef.current = isStopping
  const lastSeenSeqRef = useRef(lastSeenStreamSeq)
  lastSeenSeqRef.current = lastSeenStreamSeq
  const requestWorktree = worktreesEnabled ? worktree || undefined : undefined

  useEffect(() => {
    const handleBeforeUnload = () => {
      const shouldAckStreamCursor = isStreamingRef.current
      const shouldSendExplicitStop = isStoppingRef.current
      if (!shouldAckStreamCursor && !shouldSendExplicitStop) return

      // Best-effort cursor ack to prevent replay bursts on reconnect.
      // Intentionally no cancel beacon here: reload must keep stream alive.
      if (shouldAckStreamCursor && tabId && tabGroupId && workspace && typeof lastSeenSeqRef.current === "number") {
        navigator.sendBeacon(
          "/api/claude/stream/reconnect",
          new Blob(
            [
              JSON.stringify({
                tabId,
                tabGroupId,
                workspace,
                ...(requestWorktree ? { worktree: requestWorktree } : {}),
                ackOnly: true,
                lastSeenSeq: lastSeenSeqRef.current,
              }),
            ],
            { type: "application/json" },
          ),
        )
      } else if (shouldAckStreamCursor) {
        console.warn("[useBrowserCleanup] Cannot send reconnect ack beacon - missing identifiers")
      }

      // If user already pressed Stop, preserve that explicit intent on unload.
      // This is separate from generic unload behavior which should not cancel.
      if (shouldSendExplicitStop && tabId && tabGroupId && workspace) {
        navigator.sendBeacon(
          "/api/claude/stream/cancel",
          new Blob(
            [
              JSON.stringify({
                tabId,
                tabGroupId,
                workspace,
                ...(requestWorktree ? { worktree: requestWorktree } : {}),
                clientStack: `${EXPLICIT_STOP_UNLOAD_BEACON_MARKER} beforeunload while stop is in progress`,
              }),
            ],
            { type: "application/json" },
          ),
        )
      }
    }

    // Listen for page unload events
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [tabId, tabGroupId, workspace, requestWorktree])
}
