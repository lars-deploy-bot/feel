"use client"

import { Loader2, Mic, Square, X } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import { Tooltip } from "@/components/ui/Tooltip"
import type { VoiceState } from "./types/voice"

/** Minimum hold duration (ms) to distinguish hold-to-speak from tap-to-toggle */
const HOLD_THRESHOLD_MS = 200

const LABELS: Record<VoiceState, string> = {
  idle: "Voice input",
  recording: "Listening — stops when you pause",
  stopping: "Finishing up…",
  transcribing: "Transcribing — tap to cancel",
  error: "Voice input failed — tap to dismiss",
}

interface VoiceButtonProps {
  state: VoiceState
  /** Normalized audio level 0–1 */
  audioLevel: number
  /** Recording elapsed time in ms */
  elapsed: number
  /** Error message when state === "error" */
  errorMessage: string | null
  onToggle: () => void
  onStartRecording: () => void
  onStopRecording: () => void
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}:${sec.toString().padStart(2, "0")}` : `0:${sec.toString().padStart(2, "0")}`
}

export function VoiceButton({
  state,
  audioLevel,
  elapsed,
  errorMessage,
  onToggle,
  onStartRecording,
  onStopRecording,
}: VoiceButtonProps) {
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
      // Quick tap — toggle (start recording, cancel transcription, dismiss error)
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

  const isRecording = state === "recording"
  const isTranscribing = state === "transcribing"
  const isStopping = state === "stopping"
  const isError = state === "error"
  const isBusy = isTranscribing || isStopping

  // Scale the glow ring based on audio level when recording
  const ringScale = isRecording ? 1 + audioLevel * 1.2 : 1
  const ringOpacity = isRecording ? 0.15 + audioLevel * 0.35 : 0

  return (
    <div className="relative flex items-center">
      {/* Elapsed time while recording */}
      {(isRecording || isBusy) && (
        <div className="flex items-center gap-1.5 pr-1 animate-in fade-in slide-in-from-right-2 duration-200">
          <span className="text-[11px] tabular-nums font-medium text-black/40 dark:text-white/40">
            {isRecording ? formatElapsed(elapsed) : "…"}
          </span>
        </div>
      )}

      {/* Error message chip */}
      {isError && errorMessage && (
        <div className="flex items-center gap-1 pr-1 animate-in fade-in slide-in-from-right-2 duration-200">
          <span className="text-[11px] font-medium text-red-500 dark:text-red-400 max-w-[160px] truncate">
            {errorMessage}
          </span>
        </div>
      )}

      {/* Main button with audio-reactive glow */}
      <Tooltip content={LABELS[state]}>
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={e => e.preventDefault()}
          disabled={isStopping}
          className={`relative flex items-center justify-center size-8 rounded-full transition-colors select-none touch-none ${
            isError
              ? "bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-500/15"
              : isRecording
                ? "bg-red-500/15 text-red-500"
                : isBusy
                  ? "text-black/30 dark:text-white/30 cursor-wait"
                  : "hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          }`}
          aria-label={LABELS[state]}
        >
          {/* Audio level glow ring — scales with voice volume */}
          {isRecording && (
            <span
              className="absolute inset-0 rounded-full bg-red-500 pointer-events-none transition-transform duration-75"
              style={{
                transform: `scale(${ringScale})`,
                opacity: ringOpacity,
              }}
            />
          )}

          {/* Icon */}
          <span className="relative z-10">
            {isError ? (
              <X className="size-4" />
            ) : isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isRecording ? (
              <Square className="size-3 fill-current" />
            ) : (
              <Mic className="size-4" />
            )}
          </span>
        </button>
      </Tooltip>
    </div>
  )
}
