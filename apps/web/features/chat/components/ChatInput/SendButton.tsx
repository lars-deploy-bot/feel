"use client"

import { Loader2, Square } from "lucide-react"
import { useChatInput } from "./ChatInputContext"

export function SendButton() {
  const { busy, isStopping, canSubmit, onSubmit, onStop, abortControllerRef } = useChatInput()

  // Show Stop button while streaming (can be interrupted)
  if (busy && abortControllerRef.current && !isStopping) {
    return (
      <button
        type="button"
        onClick={onStop}
        className="absolute top-2 right-2 bottom-2 w-11 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors focus:outline-none flex items-center justify-center"
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
        className="absolute top-2 right-2 bottom-2 w-11 text-xs font-medium bg-black/50 dark:bg-white/50 text-white dark:text-black transition-colors focus:outline-none flex items-center justify-center cursor-not-allowed"
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
      className="absolute top-2 right-2 bottom-2 w-11 text-lg font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 focus:outline-none flex items-center justify-center"
      data-testid="send-button"
    >
      →
    </button>
  )
}
