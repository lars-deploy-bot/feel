"use client"

import { Plus } from "lucide-react"
import type { RefObject } from "react"
import { useChatInput } from "./ChatInputContext"
import { isDevelopment, useDebugStore } from "@/lib/stores/debug-store"

interface ToolbarProps {
  fileInputRef: RefObject<HTMLInputElement | null>
}

export function Toolbar({ fileInputRef }: ToolbarProps) {
  const { config } = useChatInput()
  const toggleSSETerminal = useDebugStore((state) => state.toggleSSETerminal)

  if (!config.enableCamera) {
    return null
  }

  const handleClick = () => {
    if (isDevelopment()) {
      toggleSSETerminal()
    } else {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className="absolute -top-10 right-0">
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
        aria-label={isDevelopment() ? "Toggle SSE terminal" : "Upload photo"}
      >
        <Plus className="size-5" />
      </button>
    </div>
  )
}
