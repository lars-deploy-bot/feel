"use client"

import { ArrowUp, Loader2, Square } from "lucide-react"
import { useChatInput } from "./ChatInputContext"

export function SendButton() {
  const { busy, isStopping, canSubmit, onSubmit, onStop } = useChatInput()

  // Show Stop button while streaming (can be interrupted)
  // busy is per-conversation from streamingStore, no need to check abortControllerRef
  if (busy && !isStopping) {
    return (
      <button
        type="button"
        onClick={onStop}
        className="shrink-0 size-8 rounded-full text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:brightness-[0.85] active:brightness-75 transition-all duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-ring flex items-center justify-center"
        data-testid="stop-button"
      >
        <Square size={14} fill="currentColor" />
      </button>
    )
  }

  // Show "Stopping..." spinner while cleanup is in progress
  if (isStopping) {
    return (
      <button
        type="button"
        disabled
        className="shrink-0 size-8 rounded-full text-xs font-medium bg-black/50 dark:bg-white/50 text-white dark:text-black transition-all duration-150 ease-in-out focus:outline-none flex items-center justify-center cursor-not-allowed"
        data-testid="stopping-button"
      >
        <Loader2 size={14} className="animate-spin" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={!canSubmit}
      className="shrink-0 size-8 rounded-full font-medium bg-black dark:bg-white text-white dark:text-black hover:brightness-[0.85] active:brightness-75 transition-all duration-150 ease-in-out disabled:opacity-30 disabled:hover:brightness-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring flex items-center justify-center"
      data-testid="send-button"
    >
      <ArrowUp size={18} strokeWidth={2.5} />
    </button>
  )
}
