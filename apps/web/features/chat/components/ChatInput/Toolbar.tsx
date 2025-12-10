"use client"

import { Camera, ClipboardList, Copy } from "lucide-react"
import type { RefObject } from "react"
import { useState } from "react"
import toast from "react-hot-toast"
import { formatMessagesAsText } from "@/features/chat/utils/format-messages"
import { useUserPrompts } from "@/lib/providers/UserPromptsStoreProvider"
import { useMessages } from "@/lib/stores/messageStore"
import { useChatInput } from "./ChatInputContext"

interface ToolbarProps {
  fileInputRef: RefObject<HTMLInputElement | null>
  onOpenTemplates?: () => void
  onAddUserPrompt?: (promptType: string, data: any, displayName: string, userFacingDescription?: string) => void
}

export function Toolbar({ fileInputRef, onAddUserPrompt }: ToolbarProps) {
  const { config } = useChatInput()
  const [showPromptMenu, setShowPromptMenu] = useState(false)
  const prompts = useUserPrompts()
  const messages = useMessages()

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

  const handleCopyMessages = async () => {
    if (messages.length === 0) {
      toast.error("No messages to copy")
      return
    }

    const formatted = formatMessagesAsText(messages)

    try {
      await navigator.clipboard.writeText(formatted)
      toast.success("Messages copied")
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <div className="absolute -top-12 right-0 flex items-center gap-2">
      {/* Copy Messages - hidden for now */}
      <button
        type="button"
        onClick={handleCopyMessages}
        className="hidden items-center justify-center w-10 h-10 rounded-md hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
        aria-label="Copy messages"
        title="Copy messages"
      >
        <Copy className="size-5" />
      </button>

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
            <button
              type="button"
              className="fixed inset-0 z-10 bg-transparent border-0 p-0 cursor-default"
              onClick={() => setShowPromptMenu(false)}
              onKeyDown={e => e.key === "Escape" && setShowPromptMenu(false)}
              aria-label="Close menu"
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

      <button
        type="button"
        onClick={handleClick}
        className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
        aria-label="Upload photo"
      >
        <Camera className="size-5" />
      </button>
    </div>
  )
}
