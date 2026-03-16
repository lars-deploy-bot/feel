"use client"

import { Loader2, Mic } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import type { VoiceState } from "./types/voice"

/** Minimum hold duration (ms) to distinguish hold-to-speak from tap-to-toggle */
const HOLD_THRESHOLD_MS = 200

const LABELS: Record<VoiceState, string> = {
  idle: "Hold to speak, tap to toggle",
  recording: "Release to send",
  transcribing: "Transcribing...",
}

const STYLES: Record<VoiceState, string> = {
  idle: "hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70",
  recording: "bg-red-500/15 text-red-500",
  transcribing: "text-black/30 dark:text-white/30 cursor-wait",
}

interface VoiceButtonProps {
  state: VoiceState
  onToggle: () => void
  onStartRecording: () => void
  onStopRecording: () => void
}

export function VoiceButton({ state, onToggle, onStartRecording, onStopRecording }: VoiceButtonProps) {
  const pointerDownAt = useRef(0)
  const isHolding = useRef(false)
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [])

  const handlePointerDown = useCallback(() => {
    if (state !== "idle") return
    pointerDownAt.current = Date.now()
    isHolding.current = false

    // After threshold, start recording (hold-to-speak)
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null
      isHolding.current = true
      onStartRecording()
    }, HOLD_THRESHOLD_MS)
  }, [state, onStartRecording])

  const handlePointerUp = useCallback(() => {
    // Cancel hold timer if released before threshold
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }

    if (isHolding.current) {
      // Was hold-to-speak — stop on release
      onStopRecording()
      isHolding.current = false
    } else if (state === "recording") {
      // Tap to stop — pointerDown was blocked so use state directly
      onStopRecording()
    } else if (Date.now() - pointerDownAt.current < HOLD_THRESHOLD_MS) {
      // Quick tap while idle — start recording
      onToggle()
    }
  }, [state, onToggle, onStopRecording])

  const handlePointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (isHolding.current) {
      onStopRecording()
      isHolding.current = false
    }
  }, [onStopRecording])

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={e => e.preventDefault()}
      disabled={state === "transcribing"}
      className={`flex items-center justify-center size-8 rounded-full transition-colors select-none touch-none ${STYLES[state]}`}
      aria-label={LABELS[state]}
      title={LABELS[state]}
    >
      {state === "transcribing" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "recording" ? (
        <span className="relative flex size-3">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-50" />
          <span className="relative inline-flex size-3 rounded-full bg-red-500" />
        </span>
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  )
}
