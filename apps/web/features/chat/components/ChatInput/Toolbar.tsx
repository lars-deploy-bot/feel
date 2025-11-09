"use client"

import { Layers, Plus } from "lucide-react"
import type { RefObject } from "react"
import { useChatInput } from "./ChatInputContext"

interface ToolbarProps {
  fileInputRef: RefObject<HTMLInputElement | null>
  onOpenTemplates?: () => void
}

export function Toolbar({ fileInputRef, onOpenTemplates }: ToolbarProps) {
  const { config } = useChatInput()

  if (!config.enableCamera) {
    return null
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="absolute -top-12 right-0 flex items-center gap-2">
      {onOpenTemplates && (
        <button
          type="button"
          onClick={onOpenTemplates}
          className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
          aria-label="Components"
          title="Components"
        >
          <Layers className="size-5" />
        </button>
      )}
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
        aria-label="Upload photo"
      >
        <Plus className="size-5" />
      </button>
    </div>
  )
}
