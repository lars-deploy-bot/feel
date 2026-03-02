import { useCallback, useRef, useState } from "react"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"

interface UseChatDragDropOptions {
  chatInputRef: React.RefObject<ChatInputHandle | null>
  disabled?: boolean
}

interface UseChatDragDropReturn {
  isDragging: boolean
  handleChatDragEnter: (e: React.DragEvent) => void
  handleChatDragLeave: (e: React.DragEvent) => void
  handleChatDragOver: (e: React.DragEvent) => void
  handleChatDrop: (e: React.DragEvent) => Promise<void>
}

/**
 * Handles drag & drop for the chat area.
 * Supports file drops and photobook image drops.
 * When disabled, all handlers just preventDefault/stopPropagation.
 */
export function useChatDragDrop({ chatInputRef, disabled }: UseChatDragDropOptions): UseChatDragDropReturn {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const handleChatDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      dragCounter.current++
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true)
      }
    },
    [disabled],
  )

  const handleChatDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      dragCounter.current--
      if (dragCounter.current === 0) {
        setIsDragging(false)
      }
    },
    [disabled],
  )

  const handleChatDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      e.dataTransfer.dropEffect = "copy"
    },
    [disabled],
  )

  const handleChatDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled) return
      dragCounter.current = 0
      setIsDragging(false)

      // Check if it's a photobook image
      const imageKey = e.dataTransfer.getData("application/x-photobook-image")
      if (imageKey) {
        chatInputRef.current?.addPhotobookImage(imageKey)
        return
      }

      // Otherwise, handle file drops
      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      for (const file of files) {
        chatInputRef.current?.addAttachment(file)
      }
    },
    [chatInputRef, disabled],
  )

  return {
    isDragging,
    handleChatDragEnter,
    handleChatDragLeave,
    handleChatDragOver,
    handleChatDrop,
  }
}
