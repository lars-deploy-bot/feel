import { describe, expect, it } from "vitest"
import { toggleAction, type VoiceState, voiceIdle, voiceTransition } from "./voice.machine"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function recording(holdMode = false): VoiceState {
  return { tag: "recording", startedAt: 1000, holdMode }
}

function stopping(): VoiceState {
  return { tag: "stopping" }
}

function transcribing(): VoiceState {
  return { tag: "transcribing" }
}

function error(message = "Something went wrong"): VoiceState {
  return { tag: "error", message }
}

function expectOk(result: ReturnType<typeof voiceTransition>, tag: VoiceState["tag"]) {
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.state.tag).toBe(tag)
  return result
}

function expectErr(result: ReturnType<typeof voiceTransition>) {
  expect(result.ok).toBe(false)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("voice.machine", () => {
  // =========================================================================
  // idle
  // =========================================================================

  describe("idle", () => {
    it("TapStart → recording (tap mode)", () => {
      const result = voiceTransition(voiceIdle(), { type: "TapStart" })
      expectOk(result, "recording")
      if (result.ok) expect(result.state.tag === "recording" && result.state.holdMode).toBe(false)
    })

    it("HoldStart → recording (hold mode)", () => {
      const result = voiceTransition(voiceIdle(), { type: "HoldStart" })
      expectOk(result, "recording")
      if (result.ok) expect(result.state.tag === "recording" && result.state.holdMode).toBe(true)
    })

    it("Toggle → recording", () => {
      expectOk(voiceTransition(voiceIdle(), { type: "Toggle" }), "recording")
    })

    it("MicDenied → error", () => {
      const result = voiceTransition(voiceIdle(), { type: "MicDenied", message: "denied" })
      expectOk(result, "error")
      if (result.ok && result.state.tag === "error") {
        expect(result.state.message).toBe("denied")
      }
    })

    it("rejects invalid events", () => {
      expectErr(voiceTransition(voiceIdle(), { type: "TapStop" }))
      expectErr(voiceTransition(voiceIdle(), { type: "BlobReady" }))
      expectErr(voiceTransition(voiceIdle(), { type: "TranscribeSuccess" }))
    })
  })

  // =========================================================================
  // recording
  // =========================================================================

  describe("recording", () => {
    it("TapStop → stopping", () => {
      expectOk(voiceTransition(recording(), { type: "TapStop" }), "stopping")
    })

    it("HoldRelease → stopping", () => {
      expectOk(voiceTransition(recording(true), { type: "HoldRelease" }), "stopping")
    })

    it("SilenceDetected → stopping", () => {
      expectOk(voiceTransition(recording(), { type: "SilenceDetected" }), "stopping")
    })

    it("MaxDuration → stopping", () => {
      expectOk(voiceTransition(recording(), { type: "MaxDuration" }), "stopping")
    })

    it("Toggle → stopping", () => {
      expectOk(voiceTransition(recording(), { type: "Toggle" }), "stopping")
    })

    it("RecorderError → error", () => {
      const result = voiceTransition(recording(), { type: "RecorderError", message: "mic busy" })
      expectOk(result, "error")
      if (result.ok && result.state.tag === "error") {
        expect(result.state.message).toBe("mic busy")
      }
    })

    it("rejects invalid events", () => {
      expectErr(voiceTransition(recording(), { type: "BlobReady" }))
      expectErr(voiceTransition(recording(), { type: "TranscribeSuccess" }))
    })
  })

  // =========================================================================
  // stopping
  // =========================================================================

  describe("stopping", () => {
    it("BlobReady → transcribing", () => {
      expectOk(voiceTransition(stopping(), { type: "BlobReady" }), "transcribing")
    })

    it("BlobTooSmall → error", () => {
      const result = voiceTransition(stopping(), { type: "BlobTooSmall", message: "too short" })
      expectOk(result, "error")
    })

    it("RecorderError → idle (cleanup fallback)", () => {
      expectOk(voiceTransition(stopping(), { type: "RecorderError", message: "" }), "idle")
    })

    it("Toggle → no-op (stays in stopping)", () => {
      const result = voiceTransition(stopping(), { type: "Toggle" })
      expectOk(result, "stopping")
    })

    it("rejects invalid events", () => {
      expectErr(voiceTransition(stopping(), { type: "TapStart" }))
      expectErr(voiceTransition(stopping(), { type: "TranscribeSuccess" }))
    })
  })

  // =========================================================================
  // transcribing
  // =========================================================================

  describe("transcribing", () => {
    it("TranscribeSuccess → idle", () => {
      expectOk(voiceTransition(transcribing(), { type: "TranscribeSuccess" }), "idle")
    })

    it("TranscribeEmpty → error", () => {
      const result = voiceTransition(transcribing(), { type: "TranscribeEmpty", message: "no speech" })
      expectOk(result, "error")
      if (result.ok && result.state.tag === "error") {
        expect(result.state.message).toBe("no speech")
      }
    })

    it("TranscribeFailed → error", () => {
      const result = voiceTransition(transcribing(), { type: "TranscribeFailed", message: "timeout" })
      expectOk(result, "error")
    })

    it("CancelTranscription → idle", () => {
      expectOk(voiceTransition(transcribing(), { type: "CancelTranscription" }), "idle")
    })

    it("Toggle → idle (cancel via toggle)", () => {
      expectOk(voiceTransition(transcribing(), { type: "Toggle" }), "idle")
    })

    it("rejects invalid events", () => {
      expectErr(voiceTransition(transcribing(), { type: "TapStart" }))
      expectErr(voiceTransition(transcribing(), { type: "BlobReady" }))
    })
  })

  // =========================================================================
  // error
  // =========================================================================

  describe("error", () => {
    it("DismissError → idle", () => {
      expectOk(voiceTransition(error(), { type: "DismissError" }), "idle")
    })

    it("ErrorTimeout → idle", () => {
      expectOk(voiceTransition(error(), { type: "ErrorTimeout" }), "idle")
    })

    it("Toggle → idle (dismiss via toggle)", () => {
      expectOk(voiceTransition(error(), { type: "Toggle" }), "idle")
    })

    it("rejects invalid events", () => {
      expectErr(voiceTransition(error(), { type: "TapStart" }))
      expectErr(voiceTransition(error(), { type: "BlobReady" }))
      expectErr(voiceTransition(error(), { type: "TranscribeSuccess" }))
    })
  })

  // =========================================================================
  // toggleAction
  // =========================================================================

  describe("toggleAction", () => {
    it("idle → start", () => expect(toggleAction(voiceIdle())).toBe("start"))
    it("recording → stop", () => expect(toggleAction(recording())).toBe("stop"))
    it("stopping → wait", () => expect(toggleAction(stopping())).toBe("wait"))
    it("transcribing → cancel", () => expect(toggleAction(transcribing())).toBe("cancel"))
    it("error → dismiss", () => expect(toggleAction(error())).toBe("dismiss"))
  })

  // =========================================================================
  // Full flows
  // =========================================================================

  describe("full flows", () => {
    it("tap-to-toggle: idle → recording → stopping → transcribing → idle", () => {
      let state: VoiceState = voiceIdle()

      // Tap to start
      let r = voiceTransition(state, { type: "Toggle" })
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
      expect(state.tag).toBe("recording")

      // Tap to stop
      r = voiceTransition(state, { type: "Toggle" })
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
      expect(state.tag).toBe("stopping")

      // Blob ready
      r = voiceTransition(state, { type: "BlobReady" })
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
      expect(state.tag).toBe("transcribing")

      // Transcription succeeds
      r = voiceTransition(state, { type: "TranscribeSuccess" })
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
      expect(state.tag).toBe("idle")
    })

    it("cancel during transcription: idle → recording → stopping → transcribing → idle", () => {
      let state: VoiceState = voiceIdle()

      state = voiceTransition(state, { type: "TapStart" }).ok
        ? (voiceTransition(state, { type: "TapStart" }) as { ok: true; state: VoiceState }).state
        : state

      state = voiceTransition(state, { type: "TapStop" }).ok
        ? (voiceTransition(state, { type: "TapStop" }) as { ok: true; state: VoiceState }).state
        : state
      expect(state.tag).toBe("stopping")

      state = voiceTransition(state, { type: "BlobReady" }).ok
        ? (voiceTransition(state, { type: "BlobReady" }) as { ok: true; state: VoiceState }).state
        : state
      expect(state.tag).toBe("transcribing")

      // Cancel via toggle
      const r = voiceTransition(state, { type: "Toggle" })
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
      expect(state.tag).toBe("idle")
    })

    it("toggle during stopping is a no-op", () => {
      let state: VoiceState = stopping()

      const r = voiceTransition(state, { type: "Toggle" })
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
      expect(state.tag).toBe("stopping") // unchanged
    })

    it("error auto-clears via ErrorTimeout", () => {
      let state: VoiceState = error("test error")

      const r = voiceTransition(state, { type: "ErrorTimeout" })
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
      expect(state.tag).toBe("idle")
    })
  })
})
