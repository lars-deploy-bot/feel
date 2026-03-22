/**
 * Connection Machine — transport layer health for a single tab.
 *
 * Owns: "can we receive bytes from the server?"
 * Source of truth: apps/web/features/chat/hooks/useChatMessaging.ts (fetch + reader),
 *                  apps/web/features/chat/hooks/useStreamReconnect.ts (visibility)
 *
 * IMPORTANT: The real code does NOT retry mid-stream. Once the reader throws,
 * the stream is dead. Retry only happens for the initial fetch() (via retryAsync,
 * 3 attempts, 1-5s delay). The backoff/reconnecting states are for initial
 * connection only, not for recovery during streaming.
 *
 * The real heartbeat mechanism:
 * - Server sends PingReceived every 30s to keep Cloudflare alive
 * - Client does NOT detect heartbeat timeouts — there is no client-side timer
 * - Client has two phase-specific timeouts instead:
 *     PRE_RESPONSE_TIMEOUT_MS = 120s (fetch → headers)
 *     FIRST_MESSAGE_TIMEOUT_MS = 60s (headers → first NDJSON line)
 *
 * Tab visibility:
 * - TabHidden: client stops consuming, server buffers to Redis
 * - TabVisible: client probes reconnect endpoint (→ reconnect.machine)
 * - visibilitychange is the ONLY reconnect trigger (not navigator.onLine)
 *
 *   idle ──FetchStarted──→ fetching
 *     │                      │
 *     │                      ├─ ResponseReceived → reading
 *     │                      ├─ FetchError → failed-fetch
 *     │                      └─ PreResponseTimeout → failed-fetch
 *     │
 *     │                   reading
 *     │                      ├─ FirstMessageReceived → connected
 *     │                      ├─ FirstMessageTimeout → disconnected
 *     │                      └─ ReaderError → disconnected
 *     │
 *     │                   connected
 *     │                      ├─ TabHidden → suspended
 *     │                      ├─ ReaderError → disconnected
 *     │                      └─ ReaderDone → idle (normal end)
 *     │
 *     │                   suspended
 *     │                      ├─ TabVisible → (reconnect.machine)
 *     │                      └─ ReaderError → disconnected
 *     │
 *     │                   disconnected
 *     │                      └─ TabVisible → (reconnect.machine)
 *     │
 *     └── failed-fetch
 *            ├─ RetryAttempt → fetching
 *            └─ MaxRetries → failed
 */

import { err, ok, type TransitionResult } from "./types"

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export type ConnectionState =
  | { tag: "idle" }
  | { tag: "fetching"; tabId: string; startedAt: number; attempt: number }
  | { tag: "reading"; tabId: string; responseAt: number }
  | { tag: "connected"; tabId: string; connectedAt: number }
  | { tag: "suspended"; tabId: string; suspendedAt: number }
  | { tag: "disconnected"; tabId: string; disconnectedAt: number; reason: DisconnectReason }
  | { tag: "failed-fetch"; tabId: string; attempt: number; maxAttempts: number }
  | { tag: "failed"; tabId: string; reason: string }

export type DisconnectReason = "reader_error" | "first_message_timeout" | "parse_errors"

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type ConnectionEvent =
  | { type: "FetchStarted"; tabId: string; timestamp: number }
  | { type: "ResponseReceived"; timestamp: number }
  | { type: "FirstMessageReceived"; timestamp: number }
  | { type: "FetchError" }
  | { type: "PreResponseTimeout" }
  | { type: "FirstMessageTimeout"; timestamp: number }
  | { type: "ReaderError"; timestamp: number }
  | { type: "ReaderDone" }
  | { type: "TabHidden"; timestamp: number }
  | { type: "TabVisible" }
  | { type: "MaxParseErrors"; timestamp: number }
  | { type: "RetryAttempt"; timestamp: number }
  | { type: "MaxRetries"; reason: string }

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export function connectionTransition(
  state: ConnectionState,
  event: ConnectionEvent,
): TransitionResult<ConnectionState> {
  const t = event.type

  switch (state.tag) {
    case "idle": {
      if (t === "FetchStarted")
        return ok({ tag: "fetching", tabId: event.tabId, startedAt: event.timestamp, attempt: 1 })
      return err(state.tag, t)
    }

    case "fetching": {
      if (t === "ResponseReceived") return ok({ tag: "reading", tabId: state.tabId, responseAt: event.timestamp })
      if (t === "FetchError" || t === "PreResponseTimeout")
        return ok({ tag: "failed-fetch", tabId: state.tabId, attempt: state.attempt, maxAttempts: 3 })
      return err(state.tag, t)
    }

    case "reading": {
      if (t === "FirstMessageReceived")
        return ok({ tag: "connected", tabId: state.tabId, connectedAt: event.timestamp })
      if (t === "FirstMessageTimeout")
        return ok({
          tag: "disconnected",
          tabId: state.tabId,
          disconnectedAt: event.timestamp,
          reason: "first_message_timeout",
        })
      if (t === "ReaderError")
        return ok({ tag: "disconnected", tabId: state.tabId, disconnectedAt: event.timestamp, reason: "reader_error" })
      return err(state.tag, t)
    }

    case "connected": {
      if (t === "TabHidden") return ok({ tag: "suspended", tabId: state.tabId, suspendedAt: event.timestamp })
      if (t === "ReaderError")
        return ok({ tag: "disconnected", tabId: state.tabId, disconnectedAt: event.timestamp, reason: "reader_error" })
      if (t === "MaxParseErrors")
        return ok({ tag: "disconnected", tabId: state.tabId, disconnectedAt: event.timestamp, reason: "parse_errors" })
      if (t === "ReaderDone") return ok({ tag: "idle" })
      return err(state.tag, t)
    }

    case "suspended": {
      // TabVisible triggers reconnect.machine, not connection state change
      if (t === "TabVisible") return ok(state)
      if (t === "ReaderError")
        return ok({ tag: "disconnected", tabId: state.tabId, disconnectedAt: event.timestamp, reason: "reader_error" })
      return err(state.tag, t)
    }

    case "disconnected": {
      // Recovery is via reconnect.machine, triggered by TabVisible
      if (t === "TabVisible") return ok(state)
      return err(state.tag, t)
    }

    case "failed-fetch": {
      if (t === "RetryAttempt")
        return ok({ tag: "fetching", tabId: state.tabId, startedAt: event.timestamp, attempt: state.attempt + 1 })
      if (t === "MaxRetries") return ok({ tag: "failed", tabId: state.tabId, reason: event.reason })
      return err(state.tag, t)
    }

    case "failed":
      return err(state.tag, t, "connection permanently failed — page refresh required")
  }
}

export function connectionIdle(): ConnectionState {
  return { tag: "idle" }
}
