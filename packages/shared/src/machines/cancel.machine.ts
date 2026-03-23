/**
 * Cancel Machine — the full stop/verify/confirm flow.
 *
 * Owns: "user pressed Stop — what happened?"
 * Source of truth: apps/web/features/chat/hooks/useStreamCancellation.ts (client),
 *                  apps/web/app/api/claude/stream/cancel/route.ts (server endpoint),
 *                  apps/web/lib/stream/cancel-intent-registry.ts (cross-process)
 *
 * The cancel endpoint returns one of 5 statuses:
 *   cancelled        → confirmed
 *   already_complete  → confirmed {wasComplete}
 *   cancel_timed_out  → confirmed {timedOut} (server forced cleanup anyway)
 *   cancel_queued     → verifying (cross-process intent queued, poll to confirm)
 *   ignored_unload_beacon → not a real cancel, machine is never entered
 *
 *   stopping ──AbortSent──→ stopping {abortSent: true}
 *     │
 *     ├─ CancelConfirmed ─────→ confirmed
 *     ├─ AlreadyComplete ─────→ confirmed {wasComplete}
 *     ├─ CancelTimedOut ──────→ confirmed {timedOut}  (server cleaned up)
 *     ├─ CancelQueued ────────→ verifying  (cross-process, poll needed)
 *     ├─ CancelFailed ────────→ verifying  (endpoint error, poll needed)
 *     ├─ CancelRequestTimeout → verifying  (HTTP timeout, poll needed)
 *     ├─ StreamCompleted ─────→ confirmed {wasComplete}
 *     ├─ StreamErrorReceived ─→ confirmed {wasError}
 *     ├─ StreamAlreadyDead ───→ confirmed {wasError}  (stream errored before Stop was pressed)
 *     └─ (no NetworkLost — cancel always resolves or times out)
 *
 *   verifying ──VerifyConfirmed──→ confirmed
 *     ├─ VerifyStillStreaming ───→ still-running
 *     ├─ VerifyUnknown ──────────→ confirmed {uncertain}
 *     └─ StreamCompleted ────────→ confirmed {wasComplete}
 *
 *   still-running ──RetryStop──→ stopping (retry)
 *     └─ StreamCompleted ──────→ confirmed {wasComplete}
 */

import { err, ok, type TransitionResult } from "./types.js"

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export type CancelState =
  | { tag: "stopping"; stopId: string; requestIdAtStop: string; abortSent: boolean }
  | { tag: "verifying"; stopId: string; requestIdAtStop: string; attempts: number; maxAttempts: number }
  | { tag: "still-running"; stopId: string; activeRequestId: string }
  | { tag: "confirmed"; wasComplete?: boolean; wasError?: boolean; timedOut?: boolean; uncertain?: boolean }

// ---------------------------------------------------------------------------
// Events — matches CANCEL_ENDPOINT_STATUS + verification outcomes
// ---------------------------------------------------------------------------

export type CancelEvent =
  | { type: "AbortSent" }
  | { type: "CancelConfirmed" }
  | { type: "AlreadyComplete" }
  | { type: "CancelTimedOut" }
  | { type: "CancelQueued" }
  | { type: "CancelFailed" }
  | { type: "CancelRequestTimeout" }
  | { type: "StreamCompleted" }
  | { type: "StreamErrorReceived" }
  | { type: "StreamAlreadyDead" }
  | { type: "VerifyConfirmed" }
  | { type: "VerifyStillStreaming"; activeRequestId?: string }
  | { type: "VerifyUnknown" }
  | { type: "RetryStop"; stopId: string }

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export function cancelTransition(state: CancelState, event: CancelEvent): TransitionResult<CancelState> {
  const t = event.type

  switch (state.tag) {
    case "stopping": {
      if (t === "AbortSent") return ok({ ...state, abortSent: true })
      if (t === "CancelConfirmed") return ok({ tag: "confirmed" })
      if (t === "AlreadyComplete") return ok({ tag: "confirmed", wasComplete: true })
      if (t === "CancelTimedOut") return ok({ tag: "confirmed", timedOut: true })
      if (t === "StreamCompleted") return ok({ tag: "confirmed", wasComplete: true })
      if (t === "StreamErrorReceived") return ok({ tag: "confirmed", wasError: true })
      if (t === "StreamAlreadyDead") return ok({ tag: "confirmed", wasError: true })
      if (t === "CancelQueued" || t === "CancelFailed" || t === "CancelRequestTimeout")
        return ok({
          tag: "verifying",
          stopId: state.stopId,
          requestIdAtStop: state.requestIdAtStop,
          attempts: 0,
          maxAttempts: 6,
        })
      return err(state.tag, t)
    }

    case "verifying": {
      if (t === "VerifyConfirmed") return ok({ tag: "confirmed" })
      if (t === "VerifyStillStreaming")
        return ok({
          tag: "still-running",
          stopId: state.stopId,
          activeRequestId: event.activeRequestId ?? state.requestIdAtStop,
        })
      if (t === "VerifyUnknown") return ok({ tag: "confirmed", uncertain: true })
      if (t === "StreamCompleted") return ok({ tag: "confirmed", wasComplete: true })
      return err(state.tag, t)
    }

    case "still-running": {
      if (t === "RetryStop")
        return ok({ tag: "stopping", stopId: event.stopId, requestIdAtStop: state.activeRequestId, abortSent: false })
      if (t === "StreamCompleted") return ok({ tag: "confirmed", wasComplete: true })
      return err(state.tag, t)
    }

    case "confirmed":
      return err(state.tag, t, "cancel resolved — terminal state")
  }
}

export function cancelStopping(stopId: string, requestIdAtStop: string): CancelState {
  return { tag: "stopping", stopId, requestIdAtStop, abortSent: false }
}
