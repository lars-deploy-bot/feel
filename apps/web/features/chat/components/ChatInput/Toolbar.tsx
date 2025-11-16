"use client"

import { ClipboardList, Layers, Plus } from "lucide-react"
import type { RefObject } from "react"
import { useState } from "react"
import { useUserPrompts } from "@/lib/providers/UserPromptsStoreProvider"
import { useChatInput } from "./ChatInputContext"

interface ToolbarProps {
  fileInputRef: RefObject<HTMLInputElement | null>
  onOpenTemplates?: () => void
  onAddUserPrompt?: (promptType: string, data: any, displayName: string, userFacingDescription?: string) => void
}

export function Toolbar({ fileInputRef, onOpenTemplates, onAddUserPrompt }: ToolbarProps) {
  const { config } = useChatInput()
  const [showPromptMenu, setShowPromptMenu] = useState(false)
  const prompts = useUserPrompts()

  if (!config.enableCamera) {
    return null
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleAddPrompt = (promptType: string, data: any, displayName: string, userFacingDescription?: string) => {
    if (!onAddUserPrompt) return
    onAddUserPrompt(promptType, data, displayName, userFacingDescription)
    setShowPromptMenu(false)
  }

  return (
    <div className="absolute -top-12 right-0 flex items-center gap-2">
      {/* User Prompts Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPromptMenu(!showPromptMenu)}
          className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
          aria-label="User prompts"
          title="User prompts"
        >
          <ClipboardList className="size-5" />
        </button>

        {showPromptMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowPromptMenu(false)}
              onKeyDown={e => e.key === "Escape" && setShowPromptMenu(false)}
            />

            {/* Menu */}
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-white dark:bg-gray-900 border border-black/10 dark:border-white/10 rounded-lg shadow-lg overflow-hidden z-20 max-h-96 overflow-y-auto">
              <div className="p-2 space-y-1">
                {prompts.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-black/40 dark:text-white/40">
                    No saved prompts. Add some in Settings → Prompts
                  </div>
                ) : (
                  prompts.map(prompt => (
                    <button
                      key={prompt.id}
                      type="button"
                      onClick={() =>
                        handleAddPrompt(
                          prompt.promptType,
                          prompt.data,
                          prompt.displayName,
                          prompt.userFacingDescription,
                        )
                      }
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ClipboardList className="size-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-black dark:text-white truncate">
                            {prompt.displayName}
                          </div>
                          <div className="text-xs text-black/60 dark:text-white/60 truncate">
                            {prompt.userFacingDescription || prompt.data}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

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
