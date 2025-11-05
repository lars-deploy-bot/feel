import type { MutableRefObject, ReactNode } from "react"

export interface Attachment {
  id: string
  file: File
  type: "image" | "document"
  preview?: string // URL for image preview
  uploadProgress?: number // 0-100
  error?: string
}

export interface ChatInputState {
  // Text input
  message: string
  setMessage: (msg: string) => void

  // Attachments
  attachments: Attachment[]
  addAttachment: (file: File) => Promise<void>
  removeAttachment: (id: string) => void

  // Drag & drop
  isDragging: boolean
  setIsDragging: (dragging: boolean) => void

  // Loading states
  busy: boolean
  abortControllerRef: MutableRefObject<AbortController | null>

  // Validation
  canSubmit: boolean
}

export interface ChatInputActions {
  onSubmit: () => void
  onStop: () => void
}

export interface ChatInputConfig {
  // Feature flags
  enableAttachments?: boolean
  enableCamera?: boolean

  // Validation
  maxAttachments?: number
  maxFileSize?: number // bytes
  allowedFileTypes?: string[] // MIME types

  // UI customization
  placeholder?: string
  minHeight?: string
  maxHeight?: string

  // Callbacks
  onMessage?: (message: string, type: "info" | "error" | "success") => void
  onAttachmentUpload?: (file: File) => Promise<string> // Returns URL
}

export interface ChatInputContextValue extends ChatInputState, ChatInputActions {
  config: ChatInputConfig
}

export interface ChatInputProps extends ChatInputActions {
  message: string
  setMessage: (msg: string) => void
  busy: boolean
  abortControllerRef: MutableRefObject<AbortController | null>
  config?: ChatInputConfig
  children?: ReactNode
}
