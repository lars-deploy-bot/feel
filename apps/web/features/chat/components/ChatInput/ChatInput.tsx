"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react"
import toast from "react-hot-toast"
import { ChatInputProvider } from "./ChatInputContext"
import { useAttachments } from "./hooks/useAttachments"
import { useSuperTemplateDetection } from "./hooks/useTemplateDetection"
import { InputArea } from "./InputArea"
import { InputContainer } from "./InputContainer"
import { PromptBarAttachmentGrid } from "./PromptBarAttachmentGrid"
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
  { message, setMessage, busy, abortControllerRef, onSubmit, onStop, config: userConfig = {}, onOpenTemplates },
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

  const {
    attachments,
    addAttachment,
    addPhotobookImage,
    addSuperTemplateAttachment,
    addUserPrompt,
    removeAttachment,
    clearAttachments,
  } = useAttachments(config)

  // Detect supertemplate JSON in message and convert to attachments
  useSuperTemplateDetection(message, setMessage, attachments, addSuperTemplateAttachment)

  // Expose methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      addAttachment,
      addPhotobookImage,
      addSuperTemplateAttachment,
      addUserPrompt,
      getAttachments: () => attachments,
      clearLibraryImages: () => {
        const libraryImages = attachments.filter(a => a.kind === "library-image")
        for (const img of libraryImages) {
          removeAttachment(img.id)
        }
      },
      clearAllAttachments: clearAttachments,
    }),
    [
      addAttachment,
      addPhotobookImage,
      addSuperTemplateAttachment,
      addUserPrompt,
      attachments,
      removeAttachment,
      clearAttachments,
    ],
  )

  const canSubmit = useMemo(() => {
    if (busy) return false
    const hasMessage = message.trim().length > 0
    const hasUserPrompt = attachments.some(a => a.kind === "user-prompt")
    const attachmentsValid = attachments.every(a => !a.error && a.uploadProgress === 100)

    // User prompts can be sent alone without a message
    // Other attachments (images, templates) require a message
    if (hasUserPrompt && attachmentsValid) return true
    return hasMessage && attachmentsValid
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
          <Toolbar fileInputRef={fileInputRef} onOpenTemplates={onOpenTemplates} onAddUserPrompt={addUserPrompt} />

          <InputContainer>
            {/* Attachments */}
            <PromptBarAttachmentGrid />

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
