"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import toast from "react-hot-toast"
import { AttachmentsGrid } from "./AttachmentsGrid"
import { ChatInputProvider } from "./ChatInputContext"
import { useAttachments } from "./hooks/useAttachments"
import { InputArea } from "./InputArea"
import { InputContainer } from "./InputContainer"
import { SendButton } from "./SendButton"
import { Toolbar } from "./Toolbar"
import type { ChatInputConfig, ChatInputContextValue, ChatInputHandle, ChatInputProps } from "./types"

/**
 * ChatInput - Clean, accessible chat input component
 *
 * Features:
 * - File paste support
 * - Image attachments with previews
 * - Photo library upload (camera icon)
 * - Error feedback with toasts
 * - Keyboard shortcuts (Cmd/Ctrl+K to focus)
 * - Exposes addAttachment via ref for parent drag handling
 */
export const ChatInput = forwardRef<ChatInputHandle, Omit<ChatInputProps, "children">>(function ChatInput(
  { message, setMessage, busy, abortControllerRef, onSubmit, onStop, config: userConfig = {} },
  ref,
) {
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

  const { attachments, addAttachment, addPhotobookImage, removeAttachment, clearAttachments } = useAttachments(config)

  // Expose methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      addAttachment,
      addPhotobookImage,
      getAttachments: () => attachments,
      clearLibraryImages: () => {
        const libraryImages = attachments.filter(a => a.kind === "library-image")
        libraryImages.forEach(img => removeAttachment(img.id))
      },
    }),
    [addAttachment, addPhotobookImage, attachments, removeAttachment],
  )

  const canSubmit = useMemo(() => {
    if (busy) return false
    const hasMessage = message.trim().length > 0
    const hasAttachments = attachments.length > 0
    const attachmentsValid = attachments.every(a => !a.error && a.uploadProgress === 100)
    return (hasMessage || hasAttachments) && attachmentsValid
  }, [busy, message, attachments])

  // Just call parent onSubmit directly (prompt building happens in parent now)
  const handleSubmit = useCallback(() => {
    onSubmit()
  }, [onSubmit])

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
      busy,
      abortControllerRef,
      canSubmit,
      onSubmit: handleSubmit,
      onStop,
      config,
    }),
    [
      message,
      setMessage,
      attachments,
      addAttachment,
      removeAttachment,
      busy,
      abortControllerRef,
      canSubmit,
      handleSubmit,
      onStop,
      config,
    ],
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
        onPaste={handlePaste}
      >
        <div className="relative">
          {/* Camera button above input */}
          <Toolbar fileInputRef={fileInputRef} />

          <InputContainer>
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
})
