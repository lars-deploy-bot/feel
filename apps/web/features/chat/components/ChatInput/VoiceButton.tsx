"use client"

import { Loader2, Mic } from "lucide-react"
import type { VoiceState } from "./types/voice"

const LABELS: Record<VoiceState, string> = {
  idle: "Voice input",
  recording: "Stop recording",
  transcribing: "Transcribing...",
}

const STYLES: Record<VoiceState, string> = {
  idle: "hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70",
  recording: "bg-red-500/15 text-red-500",
  transcribing: "text-black/30 dark:text-white/30 cursor-wait",
}

export function VoiceButton({ state, onToggle }: { state: VoiceState; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={state === "transcribing"}
      className={`flex items-center justify-center size-8 rounded-full transition-colors ${STYLES[state]}`}
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
