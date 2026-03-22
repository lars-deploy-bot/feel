/**
 * Reconnect Machine — catching up on missed messages after disconnect.
 *
 * Owns: "we came back — did we miss anything?"
 * Source of truth: apps/web/features/chat/hooks/useStreamReconnect.ts
 *
 * Triggered by: TabVisible from connection.machine, or component mount (page refresh).
 * Talks to: POST /api/claude/stream/reconnect
 *
 * The reconnect endpoint is multi-mode:
 *   { acknowledge: false } → returns buffered messages
 *   { acknowledge: true }  → deletes buffer
 *   { lastSeenSeq }        → cursor-based, returns only new messages
 *
 * Real behavior:
 * - 2s debounce between visibility checks (prevents rapid tab switching spam)
 * - 500ms delay on mount before first check (let page settle)
 * - Polling is a sequential for-loop: 1s sleep, fetch, repeat (max 300 polls = 5 min)
 * - visibilitychange is the ONLY trigger (not navigator.onLine)
 *
 *   debouncing ──DebounceExpired──→ probing
 *     └─ AlreadyRecent ──────────→ done
 *
 *   probing ──ProbeNoStream──→ done
 *     ├─ ProbeComplete ──────→ replaying
 *     ├─ ProbeStreaming ─────→ polling
 *     ├─ ProbeAmbiguous ─────→ done
 *     └─ ProbeError ─────────→ done {error}
 *
 *   replaying ──AckSent──→ done {hadBuffered}
 *
 *   polling ──PollComplete──→ replaying
 *     ├─ PollStreaming ─────→ polling {count++}
 *     ├─ PollNoStream ──────→ done
 *     ├─ PollMaxReached ────→ done {timedOut}
 *     ├─ TabHidden ─────────→ done {suspended}
 *     └─ UserPressesStop ──→ done {userStopped}
 */

import { err, ok, type TransitionResult } from "./types"

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export type ReconnectState =
  | { tag: "debouncing"; tabId: string; lastKnownSeq: number }
  | { tag: "probing"; tabId: string; lastKnownSeq: number }
  | { tag: "replaying"; requestId?: string; messagesReplayed: number }
  | { tag: "polling"; requestId: string; pollCount: number; maxPolls: number }
  | {
      tag: "done"
      hadBuffered?: boolean
      timedOut?: boolean
      suspended?: boolean
      userStopped?: boolean
      error?: boolean
    }

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type ReconnectEvent =
  | { type: "DebounceExpired" }
  | { type: "AlreadyRecent" }
  | { type: "ProbeNoStream" }
  | { type: "ProbeComplete"; messagesCount: number; requestId?: string }
  | { type: "ProbeStreaming"; requestId: string; messagesCount: number }
  | { type: "ProbeAmbiguous" }
  | { type: "ProbeError" }
  | { type: "AckSent" }
  | { type: "PollComplete"; newMessages: number }
  | { type: "PollStreaming"; newMessages: number }
  | { type: "PollNoStream" }
  | { type: "PollMaxReached" }
  | { type: "TabHidden" }
  | { type: "UserPressesStop" }

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export function reconnectTransition(state: ReconnectState, event: ReconnectEvent): TransitionResult<ReconnectState> {
  const t = event.type

  switch (state.tag) {
    case "debouncing": {
      if (t === "DebounceExpired") return ok({ tag: "probing", tabId: state.tabId, lastKnownSeq: state.lastKnownSeq })
      if (t === "AlreadyRecent") return ok({ tag: "done" })
      return err(state.tag, t)
    }

    case "probing": {
      if (t === "ProbeNoStream") return ok({ tag: "done" })
      if (t === "ProbeComplete")
        return ok({ tag: "replaying", requestId: event.requestId, messagesReplayed: event.messagesCount })
      if (t === "ProbeStreaming") return ok({ tag: "polling", requestId: event.requestId, pollCount: 0, maxPolls: 300 })
      if (t === "ProbeAmbiguous") return ok({ tag: "done" })
      if (t === "ProbeError") return ok({ tag: "done", error: true })
      return err(state.tag, t)
    }

    case "replaying": {
      if (t === "AckSent") return ok({ tag: "done", hadBuffered: true })
      return err(state.tag, t)
    }

    case "polling": {
      if (t === "PollComplete")
        return ok({ tag: "replaying", requestId: state.requestId, messagesReplayed: event.newMessages })
      if (t === "PollStreaming") return ok({ ...state, pollCount: state.pollCount + 1 })
      if (t === "PollNoStream") return ok({ tag: "done" })
      if (t === "PollMaxReached") return ok({ tag: "done", timedOut: true })
      if (t === "TabHidden") return ok({ tag: "done", suspended: true })
      if (t === "UserPressesStop") return ok({ tag: "done", userStopped: true })
      return err(state.tag, t)
    }

    case "done":
      return err(state.tag, t, "reconnect complete — terminal state")
  }
}

export function reconnectStart(tabId: string, lastKnownSeq: number): ReconnectState {
  return { tag: "debouncing", tabId, lastKnownSeq }
}
