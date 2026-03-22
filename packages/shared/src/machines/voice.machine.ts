/**
 * Voice Machine — microphone recording + transcription lifecycle.
 *
 * Owns: "what state is the voice input in, and what can happen next?"
 * Source of truth: apps/web/features/chat/components/ChatInput/hooks/useVoiceInput.ts
 *
 *   idle ──TapStart / HoldStart──→ recording
 *     │                               │
 *     │                               ├─ TapStop / HoldRelease / SilenceDetected / MaxDuration → stopping
 *     │                               └─ RecorderError → error
 *     │
 *     │                           stopping
 *     │                               │
 *     │                               ├─ BlobReady (size ≥ min) → transcribing
 *     │                               ├─ BlobTooSmall → error
 *     │                               └─ RecorderError → idle (cleanup)
 *     │
 *     │                           transcribing
 *     │                               │
 *     │                               ├─ TranscribeSuccess → idle
 *     │                               ├─ TranscribeEmpty → error
 *     │                               ├─ TranscribeFailed → error
 *     │                               └─ CancelTranscription → idle
 *     │
 *     │                           error
 *     │                               │
 *     │                               ├─ DismissError → idle
 *     │                               └─ ErrorTimeout → idle
 *     │
 *     └───────────────────────────────┘
 *
 * The "stopping" state is transient — MediaRecorder.onstop fires asynchronously.
 * No user interaction is accepted during stopping (button disabled, toggle is no-op).
 *
 * Guard: Toggle is state-aware. Each state has exactly one toggle behavior:
 *   idle         → start recording
 *   recording    → stop recording
 *   stopping     → no-op (wait for MediaRecorder)
 *   transcribing → cancel transcription
 *   error        → dismiss error
 */

import { err, ok, type TransitionResult } from "./types"

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export type VoiceStateTag = "idle" | "recording" | "stopping" | "transcribing" | "error"

export type VoiceState =
  | { tag: "idle" }
  | { tag: "recording"; startedAt: number; holdMode: boolean }
  | { tag: "stopping" }
  | { tag: "transcribing" }
  | { tag: "error"; message: string }

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type VoiceEvent =
  | { type: "TapStart" }
  | { type: "HoldStart" }
  | { type: "TapStop" }
  | { type: "HoldRelease" }
  | { type: "SilenceDetected" }
  | { type: "MaxDuration" }
  | { type: "RecorderError"; message: string }
  | { type: "BlobReady" }
  | { type: "BlobTooSmall"; message: string }
  | { type: "TranscribeSuccess" }
  | { type: "TranscribeEmpty"; message: string }
  | { type: "TranscribeFailed"; message: string }
  | { type: "CancelTranscription" }
  | { type: "DismissError" }
  | { type: "ErrorTimeout" }
  | { type: "MicDenied"; message: string }
  | { type: "Toggle" }

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export function voiceTransition(state: VoiceState, event: VoiceEvent): TransitionResult<VoiceState> {
  const t = event.type

  switch (state.tag) {
    case "idle": {
      if (t === "TapStart") return ok({ tag: "recording", startedAt: Date.now(), holdMode: false })
      if (t === "HoldStart") return ok({ tag: "recording", startedAt: Date.now(), holdMode: true })
      if (t === "MicDenied") return ok({ tag: "error", message: event.message })
      if (t === "Toggle") return ok({ tag: "recording", startedAt: Date.now(), holdMode: false })
      return err(state.tag, t)
    }

    case "recording": {
      if (t === "TapStop" || t === "HoldRelease" || t === "SilenceDetected" || t === "MaxDuration")
        return ok({ tag: "stopping" })
      if (t === "RecorderError") return ok({ tag: "error", message: event.message })
      if (t === "Toggle") return ok({ tag: "stopping" })
      return err(state.tag, t)
    }

    case "stopping": {
      if (t === "BlobReady") return ok({ tag: "transcribing" })
      if (t === "BlobTooSmall") return ok({ tag: "error", message: event.message })
      if (t === "RecorderError") return ok({ tag: "idle" })
      // Toggle is a no-op during stopping — wait for MediaRecorder
      if (t === "Toggle") return ok(state)
      return err(state.tag, t)
    }

    case "transcribing": {
      if (t === "TranscribeSuccess") return ok({ tag: "idle" })
      if (t === "TranscribeEmpty") return ok({ tag: "error", message: event.message })
      if (t === "TranscribeFailed") return ok({ tag: "error", message: event.message })
      if (t === "CancelTranscription") return ok({ tag: "idle" })
      if (t === "Toggle") return ok({ tag: "idle" }) // cancel via toggle
      return err(state.tag, t)
    }

    case "error": {
      if (t === "DismissError" || t === "ErrorTimeout") return ok({ tag: "idle" })
      if (t === "Toggle") return ok({ tag: "idle" }) // dismiss via toggle
      return err(state.tag, t)
    }
  }
}

export function voiceIdle(): VoiceState {
  return { tag: "idle" }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** What does Toggle do in this state? Used by UI to pick icon/label. */
export type ToggleAction = "start" | "stop" | "wait" | "cancel" | "dismiss"

export function toggleAction(state: VoiceState): ToggleAction {
  switch (state.tag) {
    case "idle":
      return "start"
    case "recording":
      return "stop"
    case "stopping":
      return "wait"
    case "transcribing":
      return "cancel"
    case "error":
      return "dismiss"
  }
}
