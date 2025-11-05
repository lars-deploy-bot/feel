"use client"

import { Square } from "lucide-react"
import { useChatInput } from "./ChatInputContext"

export function SendButton() {
  const { busy, canSubmit, onSubmit, onStop, abortControllerRef } = useChatInput()

  if (busy && abortControllerRef.current) {
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

  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={!canSubmit}
      className="absolute top-2 right-2 bottom-2 w-11 text-lg font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 focus:outline-none flex items-center justify-center"
      data-testid="send-button"
    >
      {busy ? "•••" : "→"}
    </button>
  )
}
