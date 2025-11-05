"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { AttachmentsGrid } from "./AttachmentsGrid"
import { ChatInputProvider } from "./ChatInputContext"
import { useAttachments } from "./hooks/useAttachments"
import { InputArea } from "./InputArea"
import { InputContainer } from "./InputContainer"
import { SendButton } from "./SendButton"
import { Toolbar } from "./Toolbar"
import type { ChatInputConfig, ChatInputContextValue, ChatInputProps } from "./types"

/**
 * ChatInput - Clean, accessible chat input component
 *
 * Architecture patterns:
 * - CSS Grid layout with named areas
 * - Data attributes for component state
 * - React Context for shared state
 * - Proper accessibility (ARIA labels, keyboard shortcuts)
 *
 * Features:
 * - File drag & drop and paste support
 * - Image attachments with previews
 * - Photo library upload (mobile camera icon)
 * - Error feedback with animated toasts
 * - Keyboard shortcuts (Cmd/Ctrl+K to focus)
 */
export function ChatInput({
  message,
  setMessage,
  busy,
  abortControllerRef,
  onSubmit,
  onStop,
  config: userConfig = {},
}: Omit<ChatInputProps, "children">) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const config: ChatInputConfig = useMemo(
    () => ({
      enableAttachments: true,
      enableCamera: false,
      maxAttachments: 10,
      maxFileSize: 10 * 1024 * 1024,
      placeholder: "Tell me what to change...",
      minHeight: "80px",
      maxHeight: "100px",
      onMessage: (msg, type) => {
        if (type === "error") {
          toast.error(msg)
        }
      },
      ...userConfig,
    }),
    [userConfig],
  )

  const { attachments, addAttachment, removeAttachment } = useAttachments(config)

  const canSubmit = useMemo(() => {
    if (busy) return false
    const hasMessage = message.trim().length > 0
    const hasAttachments = attachments.length > 0
    const attachmentsValid = attachments.every(a => !a.error && a.uploadProgress === 100)
    return (hasMessage || hasAttachments) && attachmentsValid
  }, [busy, message, attachments])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        document.querySelector<HTMLTextAreaElement>('[data-testid="message-input"]')?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const contextValue: ChatInputContextValue = useMemo(
    () => ({
      message,
      setMessage,
      attachments,
      addAttachment,
      removeAttachment,
      isDragging,
      setIsDragging,
      busy,
      abortControllerRef,
      canSubmit,
      onSubmit,
      onStop,
      config,
    }),
    [
      message,
      setMessage,
      attachments,
      addAttachment,
      removeAttachment,
      isDragging,
      busy,
      abortControllerRef,
      canSubmit,
      onSubmit,
      onStop,
      config,
    ],
  )

  // Drag & drop - improved detection
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current = 0
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      for (const file of files) addAttachment(file)
    },
    [addAttachment],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items)
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) addAttachment(file)
        }
      }
    },
    [addAttachment],
  )

  return (
    <ChatInputProvider value={contextValue}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={config.allowedFileTypes?.join(",") || "image/*,.pdf,.txt,.md"}
        onChange={e => {
          const files = Array.from(e.target.files || [])
          for (const file of files) addAttachment(file)
          if (fileInputRef.current) fileInputRef.current.value = ""
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <section
        className="relative flex-shrink-0 p-4 safe-area-inset-bottom"
        aria-label="Chat input"
        data-dragging={isDragging ? "" : undefined}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        <div className="relative">
          {/* Camera button above input */}
          <Toolbar fileInputRef={fileInputRef} />

          <InputContainer isDragging={isDragging}>
            {/* Attachments */}
            <AttachmentsGrid />

            {/* Input area */}
            <InputArea />

            {/* Send button */}
            <SendButton />
          </InputContainer>
        </div>
      </section>
    </ChatInputProvider>
  )
}
