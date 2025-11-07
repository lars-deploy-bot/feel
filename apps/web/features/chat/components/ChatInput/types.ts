import type { MutableRefObject, ReactNode } from "react"
import type { FileCategory } from "./types/file-types"

// Base properties for all attachments
interface BaseAttachment {
  id: string
  preview?: string
  uploadProgress?: number
  error?: string
}

// File being uploaded (new or duplicate detection in progress)
export interface FileUploadAttachment extends BaseAttachment {
  kind: "file-upload"
  file: File
  category: FileCategory
}

// Image from photobook library (already uploaded)
export interface LibraryImageAttachment extends BaseAttachment {
  kind: "library-image"
  photobookKey: string
}

export type Attachment = FileUploadAttachment | LibraryImageAttachment

// Type guards
export function isFileUpload(attachment: Attachment): attachment is FileUploadAttachment {
  return attachment.kind === "file-upload"
}

export function isLibraryImage(attachment: Attachment): attachment is LibraryImageAttachment {
  return attachment.kind === "library-image"
}

export function isImageAttachment(attachment: Attachment): boolean {
  return attachment.kind === "library-image" || (attachment.kind === "file-upload" && attachment.category === "image")
}

export function isDocumentAttachment(attachment: Attachment): boolean {
  return attachment.kind === "file-upload" && attachment.category === "document"
}

export interface ChatInputState {
  // Text input
  message: string
  setMessage: (msg: string) => void

  // Attachments
  attachments: Attachment[]
  addAttachment: (file: File) => Promise<void>
  removeAttachment: (id: string) => void

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

export type UploadProgressCallback = (attachmentId: string, progress: number) => void

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
  onAttachmentUpload?: (file: File, onProgress?: (progress: number) => void) => Promise<string> // Returns image key
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

export interface ChatInputHandle {
  addAttachment: (file: File) => Promise<void>
  addPhotobookImage: (imageKey: string) => void
  getAttachments: () => Attachment[]
  clearLibraryImages: () => void
}
