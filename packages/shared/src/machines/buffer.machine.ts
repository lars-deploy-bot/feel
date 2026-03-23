/**
 * Buffer Machine — server-side Redis message buffering.
 *
 * Owns: "what's in the Redis buffer for this stream?"
 * Source of truth: apps/web/lib/stream/stream-buffer.ts,
 *                  apps/web/app/api/claude/stream/reconnect/route.ts
 *
 * Redis StreamBufferEntry.state is: "streaming" | "complete" | "error"
 * There is no "cancelled" state in Redis — cancel calls completeStreamBuffer().
 *
 * Buffer lifecycle:
 *   1. Created at stream start (createStreamBuffer) — may be skipped if no Redis
 *   2. Messages appended atomically via Lua script (max 1000)
 *   3. Completed when stream finishes (completeStreamBuffer)
 *   4. Read by client via cursor (getUnreadMessages, Lua script)
 *   5. Deleted when client acknowledges (deleteStreamBuffer)
 *   6. Auto-expires via Redis TTL (30 min)
 *
 *   active ──MessageAppended──→ active {count++}
 *     │
 *     ├─ StreamCompleted ──────→ complete
 *     ├─ StreamErrored ────────→ errored
 *     ├─ BufferFull ───────────→ errored {overflow}
 *     ├─ StaleDetected ────────→ complete (auto-completed by hasActiveStream)
 *     └─ CursorAdvanced ──────→ active {lastReadSeq updated}
 *
 *   complete ──ClientAcked──→ deleted
 *     └─ Expired ──────────→ expired
 *
 *   errored ──ClientAcked──→ deleted
 *     └─ Expired ──────────→ expired
 *
 *   skipped — Redis unavailable, no buffer created
 */

import { err, ok, type TransitionResult } from "./types.js"

// ---------------------------------------------------------------------------
// States — matches Redis StreamBufferEntry.state + lifecycle
// ---------------------------------------------------------------------------

export type BufferState =
  | {
      tag: "active"
      requestId: string
      tabKey: string
      userId: string
      messageCount: number
      lastReadSeq: number
      startedAt: number
      lastMessageAt: number
    }
  | { tag: "complete"; messageCount: number; completedAt: number }
  | { tag: "errored"; reason: string }
  | { tag: "deleted" }
  | { tag: "expired" }
  | { tag: "skipped" }

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type BufferEvent =
  | { type: "MessageAppended"; streamSeq: number; timestamp: number }
  | { type: "StreamCompleted"; timestamp: number }
  | { type: "StreamErrored"; reason: string }
  | { type: "BufferFull" }
  | { type: "StaleDetected" }
  | { type: "CursorAdvanced"; lastReadSeq: number }
  | { type: "ClientAcked" }
  | { type: "Expired" }

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export function bufferTransition(state: BufferState, event: BufferEvent): TransitionResult<BufferState> {
  const t = event.type

  switch (state.tag) {
    case "active": {
      if (t === "MessageAppended")
        return ok({ ...state, messageCount: state.messageCount + 1, lastMessageAt: event.timestamp })
      if (t === "CursorAdvanced") return ok({ ...state, lastReadSeq: event.lastReadSeq })
      if (t === "StreamCompleted")
        return ok({ tag: "complete", messageCount: state.messageCount, completedAt: event.timestamp })
      if (t === "StreamErrored") return ok({ tag: "errored", reason: event.reason })
      if (t === "BufferFull") return ok({ tag: "errored", reason: "buffer_full" })
      if (t === "StaleDetected")
        return ok({ tag: "complete", messageCount: state.messageCount, completedAt: Date.now() })
      if (t === "Expired") return ok({ tag: "expired" })
      return err(state.tag, t)
    }

    case "complete": {
      if (t === "ClientAcked") return ok({ tag: "deleted" })
      if (t === "Expired") return ok({ tag: "expired" })
      return err(state.tag, t)
    }

    case "errored": {
      if (t === "ClientAcked") return ok({ tag: "deleted" })
      if (t === "Expired") return ok({ tag: "expired" })
      return err(state.tag, t)
    }

    case "deleted":
      return err(state.tag, t, "buffer deleted — terminal")
    case "expired":
      return err(state.tag, t, "buffer expired — terminal")
    case "skipped":
      return err(state.tag, t, "buffer was skipped (no Redis) — terminal")
  }
}

export function bufferActive(requestId: string, tabKey: string, userId: string, timestamp: number): BufferState {
  return {
    tag: "active",
    requestId,
    tabKey,
    userId,
    messageCount: 0,
    lastReadSeq: 0,
    startedAt: timestamp,
    lastMessageAt: timestamp,
  }
}

export function bufferSkipped(): BufferState {
  return { tag: "skipped" }
}
