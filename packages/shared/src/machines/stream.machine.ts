/**
 * Stream Machine — top-level lifecycle of a single chat request.
 *
 * Owns: "where are we from fetch() to cleanup?"
 * Source of truth: apps/web/app/api/claude/stream/route.ts (server),
 *                  apps/web/lib/stream/ndjson-stream-handler.ts (NDJSON processing),
 *                  apps/web/features/chat/hooks/useChatMessaging.ts (client fetch loop)
 *
 *   idle ──UserSendsMessage──→ queued? ──→ fetching ──→ reading ──→ streaming
 *                                                                      │
 *                                      ┌───────────────────────────────┘
 *                                      │
 *                                      ├─ CompleteReceived → draining → closed
 *                                      ├─ CancelRequested → cancelling → closed
 *                                      ├─ ErrorOccurred → error
 *                                      └─ PingReceived → streaming (no-op)
 *
 * "queued" is optional — only entered when worker pool has no available workers.
 * "fetching" = fetch() called, waiting for HTTP response headers.
 * "reading" = headers received, waiting for first NDJSON line from child.
 * "streaming" = messages flowing. Carries tokens for billing.
 *
 * Note: "session-received" from the Rust model is NOT a state here.
 * In reality, the session event is a side-effect (stored in Supabase)
 * processed during streaming — it doesn't change the stream's lifecycle.
 */

import { err, ok, type TransitionResult } from "./types"

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export type StreamState =
  | { tag: "idle"; lastRequestId?: string }
  | { tag: "queued"; requestId: string; reason: QueueReason; position?: number }
  | { tag: "fetching"; requestId: string; tabId: string; workspace: string; fetchedAt: number }
  | { tag: "reading"; requestId: string; tabId: string; workspace: string; responseAt: number }
  | {
      tag: "streaming"
      requestId: string
      streamSeq: number
      inputTokens: number
      outputTokens: number
      pendingToolIds: string[]
      messageCount: number
      isResume: boolean
      tokenSource: TokenSource
    }
  | {
      tag: "cancelling"
      requestId: string
      cancelSource: CancelSource
      inputTokens: number
      outputTokens: number
    }
  | {
      tag: "draining"
      requestId: string
      inputTokens: number
      outputTokens: number
      creditsCharged: boolean
    }
  | { tag: "closed"; outcome: Outcome; inputTokens: number; outputTokens: number }
  | { tag: "error"; errorCode: ErrorCode; lastGoodSeq: number; recoverable: boolean }

export type QueueReason = "user_limit" | "workspace_limit"
export type TokenSource = "workspace" | "user_provided"
export type CancelSource = "user" | "abort" | "shared-intent"
export type Outcome = "completed" | "cancelled" | "errored"
export type ErrorCode =
  | "sdk_error"
  | "process_crash"
  | "timeout"
  | "pre_response_timeout"
  | "first_message_timeout"
  | "auth_failure"
  | "rate_limit"
  | "buffer_overflow"
  | "session_corrupt"
  | "insufficient_credits"
  | "max_parse_errors"
  | "unknown"

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type StreamEvent =
  | { type: "UserSendsMessage"; requestId: string; tabId: string; workspace: string }
  | { type: "Queued"; reason: QueueReason; position?: number }
  | { type: "FetchResponseReceived"; timestamp: number }
  | { type: "FirstMessageReceived"; streamSeq: number; isResume: boolean; tokenSource: TokenSource }
  | { type: "MessageReceived"; streamSeq: number }
  | { type: "ToolUseStarted"; toolUseId: string }
  | { type: "ToolResultReceived"; toolUseId: string }
  | { type: "TokensAccumulated"; inputTokens: number; outputTokens: number }
  | { type: "CompleteReceived"; totalMessages: number }
  | { type: "DoneReceived" }
  | { type: "PingReceived" }
  | { type: "ErrorOccurred"; errorCode: ErrorCode }
  | { type: "CancelRequested"; source: CancelSource }
  | { type: "ReaderDone" }
  | { type: "CreditsCharged" }
  | { type: "CleanupDone" }
  | { type: "Retry" }

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export function streamTransition(state: StreamState, event: StreamEvent): TransitionResult<StreamState> {
  const t = event.type

  switch (state.tag) {
    case "idle": {
      if (t === "UserSendsMessage")
        return ok({
          tag: "fetching",
          requestId: event.requestId,
          tabId: event.tabId,
          workspace: event.workspace,
          fetchedAt: Date.now(),
        })
      return err(state.tag, t)
    }

    case "queued": {
      if (t === "FetchResponseReceived")
        return ok({ tag: "reading", requestId: state.requestId, tabId: "", workspace: "", responseAt: event.timestamp })
      if (t === "ErrorOccurred")
        return ok({ tag: "error", errorCode: event.errorCode, lastGoodSeq: 0, recoverable: true })
      if (t === "CancelRequested")
        return ok({
          tag: "cancelling",
          requestId: state.requestId,
          cancelSource: event.source,
          inputTokens: 0,
          outputTokens: 0,
        })
      return err(state.tag, t)
    }

    case "fetching": {
      if (t === "Queued")
        return ok({ tag: "queued", requestId: state.requestId, reason: event.reason, position: event.position })
      if (t === "FetchResponseReceived")
        return ok({
          tag: "reading",
          requestId: state.requestId,
          tabId: state.tabId,
          workspace: state.workspace,
          responseAt: event.timestamp,
        })
      if (t === "ErrorOccurred")
        return ok({ tag: "error", errorCode: event.errorCode, lastGoodSeq: 0, recoverable: true })
      if (t === "CancelRequested")
        return ok({
          tag: "cancelling",
          requestId: state.requestId,
          cancelSource: event.source,
          inputTokens: 0,
          outputTokens: 0,
        })
      return err(state.tag, t)
    }

    case "reading": {
      if (t === "FirstMessageReceived")
        return ok({
          tag: "streaming",
          requestId: state.requestId,
          streamSeq: event.streamSeq,
          inputTokens: 0,
          outputTokens: 0,
          pendingToolIds: [],
          messageCount: 1,
          isResume: event.isResume,
          tokenSource: event.tokenSource,
        })
      if (t === "ErrorOccurred")
        return ok({ tag: "error", errorCode: event.errorCode, lastGoodSeq: 0, recoverable: true })
      if (t === "CancelRequested")
        return ok({
          tag: "cancelling",
          requestId: state.requestId,
          cancelSource: event.source,
          inputTokens: 0,
          outputTokens: 0,
        })
      return err(state.tag, t)
    }

    case "streaming": {
      if (t === "MessageReceived")
        return ok({ ...state, streamSeq: event.streamSeq, messageCount: state.messageCount + 1 })
      if (t === "ToolUseStarted") {
        if (state.pendingToolIds.includes(event.toolUseId)) return ok(state)
        return ok({ ...state, pendingToolIds: [...state.pendingToolIds, event.toolUseId] })
      }
      if (t === "ToolResultReceived")
        return ok({ ...state, pendingToolIds: state.pendingToolIds.filter(id => id !== event.toolUseId) })
      if (t === "TokensAccumulated")
        return ok({
          ...state,
          inputTokens: state.inputTokens + event.inputTokens,
          outputTokens: state.outputTokens + event.outputTokens,
        })
      if (t === "CompleteReceived")
        return ok({
          tag: "draining",
          requestId: state.requestId,
          inputTokens: state.inputTokens,
          outputTokens: state.outputTokens,
          creditsCharged: false,
        })
      if (t === "CancelRequested")
        return ok({
          tag: "cancelling",
          requestId: state.requestId,
          cancelSource: event.source,
          inputTokens: state.inputTokens,
          outputTokens: state.outputTokens,
        })
      if (t === "ErrorOccurred")
        return ok({ tag: "error", errorCode: event.errorCode, lastGoodSeq: state.streamSeq, recoverable: true })
      if (t === "PingReceived" || t === "DoneReceived") return ok(state)
      return err(state.tag, t)
    }

    case "cancelling": {
      if (t === "ReaderDone" || t === "CleanupDone")
        return ok({
          tag: "closed",
          outcome: "cancelled",
          inputTokens: state.inputTokens,
          outputTokens: state.outputTokens,
        })
      if (t === "ErrorOccurred")
        return ok({
          tag: "closed",
          outcome: "errored",
          inputTokens: state.inputTokens,
          outputTokens: state.outputTokens,
        })
      return err(state.tag, t)
    }

    case "draining": {
      if (t === "CreditsCharged") return ok({ ...state, creditsCharged: true })
      if (t === "CleanupDone")
        return ok({
          tag: "closed",
          outcome: "completed",
          inputTokens: state.inputTokens,
          outputTokens: state.outputTokens,
        })
      if (t === "ErrorOccurred")
        return ok({ tag: "error", errorCode: event.errorCode, lastGoodSeq: 0, recoverable: false })
      return err(state.tag, t)
    }

    case "closed":
      return err(state.tag, t, "stream is closed — terminal state")

    case "error": {
      if (t === "CleanupDone") return ok({ tag: "closed", outcome: "errored", inputTokens: 0, outputTokens: 0 })
      if (t === "Retry" && state.recoverable) return ok({ tag: "idle" })
      if (t === "UserSendsMessage")
        return ok({
          tag: "fetching",
          requestId: event.requestId,
          tabId: event.tabId,
          workspace: event.workspace,
          fetchedAt: Date.now(),
        })
      return err(state.tag, t)
    }
  }
}

export function streamIdle(lastRequestId?: string): StreamState {
  return { tag: "idle", lastRequestId }
}
