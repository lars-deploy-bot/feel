/**
 * Run Machine — what Claude is doing within a single stream.
 *
 * STATUS: ASPIRATIONAL. The real codebase tracks tools imperatively via
 * streamingStore (markToolPending/markToolComplete/updateToolProgress).
 * This machine defines the TARGET state model for when we wire the FSMs in.
 *
 * What the real code DOES track (streamingStore TabStreamState):
 * - pendingTools: Map<string, PendingTool> (toolUseId → {name, input, startedAt, elapsedSeconds})
 * - toolUseMap: Map<string, string> (toolUseId → toolName)
 * - toolInputMap: Map<string, unknown> (toolUseId → input)
 *
 * What's ASPIRATIONAL (marked with ★):
 * - ★ "waiting-approval" — SDK handles permission internally today. When we
 *   surface canUseTool callbacks or build our own permission UI, this state
 *   lets the UI show "waiting for your approval" with the tool name/input.
 * - ★ "generating" vs "tool-calling" distinction — both are "streaming" today.
 * - ★ Turn counting — no concept of turns in current streaming layer.
 *
 *   pending ──RunStarted──→ generating
 *     │                        │
 *     │ CancelRequested        ├─ TextReceived → generating (no-op)
 *     ▼                        ├─ ToolUseReceived → tool-calling
 *   cancelled                  ├─ ResultReceived → completing
 *                              ├─ CancelRequested → cancelled
 *                              └─ ErrorOccurred → error
 *
 *   tool-calling
 *     ├─ ApprovalRequired → waiting-approval  ★
 *     ├─ ToolResultReceived → generating
 *     ├─ ToolUseReceived → tool-calling (parallel tools)
 *     ├─ CancelRequested → cancelled
 *     └─ ErrorOccurred → error
 *
 *   waiting-approval  ★
 *     ├─ ApprovalGranted → tool-calling (tool executes)
 *     ├─ ApprovalDenied → generating (Claude gets rejection, continues)
 *     ├─ ApprovalTimeout → generating (auto-deny after timeout)
 *     ├─ CancelRequested → cancelled
 *     └─ ErrorOccurred → error
 *
 *   completing ──RunFinished──→ completed
 *     └─ ErrorOccurred → error
 */

import { err, ok, type TransitionResult } from "./types"

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export type RunState =
  | { tag: "pending"; requestId: string }
  | { tag: "generating"; requestId: string; turnCount: number; pendingToolIds: string[] }
  | {
      tag: "tool-calling"
      requestId: string
      turnCount: number
      activeToolId: string
      activeToolName: string
      pendingToolIds: string[]
    }
  | {
      /** ★ ASPIRATIONAL — SDK handles this internally today. */
      tag: "waiting-approval"
      requestId: string
      turnCount: number
      activeToolId: string
      activeToolName: string
      toolInput: unknown
      pendingToolIds: string[]
    }
  | { tag: "completing"; requestId: string; turnCount: number; summary?: string }
  | { tag: "completed"; requestId: string; turnCount: number; summary?: string }
  | { tag: "cancelled"; requestId: string; turnCount: number }
  | { tag: "error"; requestId: string; turnCount: number; code: RunErrorCode; message: string }

export type RunErrorCode = "sdk_error" | "timeout" | "process_crash" | "overloaded" | "rate_limit" | "unknown"

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type RunEvent =
  | { type: "RunStarted" }
  | { type: "TextReceived" }
  | { type: "ToolUseReceived"; toolId: string; toolName: string }
  | { type: "ApprovalRequired"; toolInput: unknown }
  | { type: "ApprovalGranted" }
  | { type: "ApprovalDenied" }
  | { type: "ApprovalTimeout" }
  | { type: "ToolResultReceived"; toolId: string }
  | { type: "ResultReceived"; summary?: string }
  | { type: "RunFinished" }
  | { type: "CancelRequested" }
  | { type: "ErrorOccurred"; code: RunErrorCode; message: string }

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export function runTransition(state: RunState, event: RunEvent): TransitionResult<RunState> {
  const t = event.type

  switch (state.tag) {
    case "pending": {
      if (t === "RunStarted")
        return ok({ tag: "generating", requestId: state.requestId, turnCount: 0, pendingToolIds: [] })
      if (t === "CancelRequested") return ok({ tag: "cancelled", requestId: state.requestId, turnCount: 0 })
      if (t === "ErrorOccurred")
        return ok({ tag: "error", requestId: state.requestId, turnCount: 0, code: event.code, message: event.message })
      return err(state.tag, t)
    }

    case "generating": {
      if (t === "TextReceived") return ok(state)
      if (t === "ToolUseReceived")
        return ok({
          tag: "tool-calling",
          requestId: state.requestId,
          turnCount: state.turnCount + 1,
          activeToolId: event.toolId,
          activeToolName: event.toolName,
          pendingToolIds: [...state.pendingToolIds, event.toolId],
        })
      if (t === "ResultReceived")
        return ok({ tag: "completing", requestId: state.requestId, turnCount: state.turnCount, summary: event.summary })
      if (t === "CancelRequested")
        return ok({ tag: "cancelled", requestId: state.requestId, turnCount: state.turnCount })
      if (t === "ErrorOccurred")
        return ok({
          tag: "error",
          requestId: state.requestId,
          turnCount: state.turnCount,
          code: event.code,
          message: event.message,
        })
      return err(state.tag, t)
    }

    case "tool-calling": {
      if (t === "ApprovalRequired")
        return ok({
          tag: "waiting-approval",
          requestId: state.requestId,
          turnCount: state.turnCount,
          activeToolId: state.activeToolId,
          activeToolName: state.activeToolName,
          toolInput: event.toolInput,
          pendingToolIds: state.pendingToolIds,
        })
      if (t === "ToolResultReceived")
        return ok({
          tag: "generating",
          requestId: state.requestId,
          turnCount: state.turnCount,
          pendingToolIds: state.pendingToolIds.filter(id => id !== event.toolId),
        })
      if (t === "ToolUseReceived")
        return ok({
          ...state,
          turnCount: state.turnCount + 1,
          activeToolId: event.toolId,
          activeToolName: event.toolName,
          pendingToolIds: [...state.pendingToolIds, event.toolId],
        })
      if (t === "CancelRequested")
        return ok({ tag: "cancelled", requestId: state.requestId, turnCount: state.turnCount })
      if (t === "ErrorOccurred")
        return ok({
          tag: "error",
          requestId: state.requestId,
          turnCount: state.turnCount,
          code: event.code,
          message: event.message,
        })
      return err(state.tag, t)
    }

    case "waiting-approval": {
      if (t === "ApprovalGranted")
        return ok({
          tag: "tool-calling",
          requestId: state.requestId,
          turnCount: state.turnCount,
          activeToolId: state.activeToolId,
          activeToolName: state.activeToolName,
          pendingToolIds: state.pendingToolIds,
        })
      if (t === "ApprovalDenied" || t === "ApprovalTimeout")
        return ok({
          tag: "generating",
          requestId: state.requestId,
          turnCount: state.turnCount,
          pendingToolIds: state.pendingToolIds.filter(id => id !== state.activeToolId),
        })
      if (t === "CancelRequested")
        return ok({ tag: "cancelled", requestId: state.requestId, turnCount: state.turnCount })
      if (t === "ErrorOccurred")
        return ok({
          tag: "error",
          requestId: state.requestId,
          turnCount: state.turnCount,
          code: event.code,
          message: event.message,
        })
      return err(state.tag, t)
    }

    case "completing": {
      if (t === "RunFinished")
        return ok({ tag: "completed", requestId: state.requestId, turnCount: state.turnCount, summary: state.summary })
      if (t === "ErrorOccurred")
        return ok({
          tag: "error",
          requestId: state.requestId,
          turnCount: state.turnCount,
          code: event.code,
          message: event.message,
        })
      return err(state.tag, t)
    }

    case "completed":
      return err(state.tag, t, "run complete — terminal")
    case "cancelled":
      return err(state.tag, t, "run cancelled — terminal")
    case "error":
      return err(state.tag, t, "run errored — terminal")
  }
}

export function runPending(requestId: string): RunState {
  return { tag: "pending", requestId }
}
