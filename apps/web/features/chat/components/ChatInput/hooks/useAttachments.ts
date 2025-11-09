"use client"

import { useCallback, useState } from "react"
import { createPreviewUrl, getAttachmentType, validateFile } from "@/features/chat/utils/file-validation"
import { useImageStore } from "@/lib/stores/imageStore"
import { hashFile } from "@/lib/utils/file-hash"
import type {
  Attachment,
  ChatInputConfig,
  FileUploadAttachment,
  LibraryImageAttachment,
  TemplateAttachment,
} from "../types"
import { isFileUpload, isLibraryImage, isTemplateAttachment } from "../types"

export function useAttachments(config: ChatInputConfig) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const images = useImageStore(state => state.images)

  const addAttachment = useCallback(
    async (file: File) => {
      // Validate file
      const validation = validateFile(file, {
        maxFileSize: config.maxFileSize,
        allowedFileTypes: config.allowedFileTypes,
      })

      if (!validation.valid) {
        config.onMessage?.(validation.error || "Invalid file", "error")
        return
      }

      // Hash file first to check duplicates
      const hash = await hashFile(file)

      // Check if same file already attached
      if (attachments.some(a => isFileUpload(a) && a.file.name === file.name && a.file.size === file.size)) {
        config.onMessage?.("File already attached", "error")
        return
      }

      // Check if this hash matches an already attached photobook image
      const existingImage = images.find(img => img.key.includes(hash))
      if (existingImage && attachments.some(a => isLibraryImage(a) && a.photobookKey === existingImage.key)) {
        config.onMessage?.("Image already attached", "error")
        return
      }

      // Check max attachments
      if (config.maxAttachments && attachments.length >= config.maxAttachments) {
        config.onMessage?.(`Maximum ${config.maxAttachments} attachments allowed`, "error")
        return
      }

      // Create attachment with blob preview first (instant display)
      const attachment: FileUploadAttachment = {
        kind: "file-upload",
        id: crypto.randomUUID(),
        file,
        category: getAttachmentType(file),
        preview: createPreviewUrl(file),
        uploadProgress: 0,
      }

      setAttachments(prev => [...prev, attachment])

      // If already exists in imageStore, mark as complete and skip upload
      if (existingImage) {
        setAttachments(prev => prev.map(a => (a.id === attachment.id ? { ...a, uploadProgress: 100 } : a)))
        return
      }

      // Upload new file
      if (config.onAttachmentUpload) {
        try {
          // Progress callback updates attachment progress in real-time
          const onProgress = (progress: number) => {
            setAttachments(prev => prev.map(a => (a.id === attachment.id ? { ...a, uploadProgress: progress } : a)))
          }

          const _imageKey = await config.onAttachmentUpload(file, onProgress)

          // Ensure 100% progress on completion
          setAttachments(prev => prev.map(a => (a.id === attachment.id ? { ...a, uploadProgress: 100 } : a)))
          config.onMessage?.(`Uploaded ${file.name}`, "success")
        } catch (error) {
          // Set error state on attachment
          setAttachments(prev =>
            prev.map(a =>
              a.id === attachment.id
                ? {
                    ...a,
                    error: error instanceof Error ? error.message : "Upload failed",
                    uploadProgress: 0,
                  }
                : a,
            ),
          )

          // Only show error toast if not aborted (user cancelled)
          const isAborted = error instanceof Error && error.message.includes("cancelled")
          if (!isAborted) {
            config.onMessage?.(error instanceof Error ? error.message : "Upload failed", "error")
          }
        }
      } else {
        // No upload handler, mark as complete immediately
        setAttachments(prev => prev.map(a => (a.id === attachment.id ? { ...a, uploadProgress: 100 } : a)))
      }
    },
    [attachments.length, config, images],
  )

  const addPhotobookImage = useCallback(
    (imageKey: string) => {
      // Check if already attached
      if (attachments.some(a => isLibraryImage(a) && a.photobookKey === imageKey)) {
        config.onMessage?.("Image already attached", "error")
        return
      }

      const image = images.find(img => img.key === imageKey)
      if (!image) {
        config.onMessage?.("Image not found", "error")
        return
      }

      // Check max attachments
      if (config.maxAttachments && attachments.length >= config.maxAttachments) {
        config.onMessage?.(`Maximum ${config.maxAttachments} attachments allowed`, "error")
        return
      }

      // Create attachment from photobook image
      const attachment: LibraryImageAttachment = {
        kind: "library-image",
        id: crypto.randomUUID(),
        photobookKey: imageKey,
        preview: image.variants.w640,
        uploadProgress: 100,
      }

      setAttachments(prev => [...prev, attachment])
    },
    [images, attachments, config],
  )

  const addTemplateAttachment = useCallback(
    (templateId: string, name: string, preview: string) => {
      // Check if already attached
      if (attachments.some(a => isTemplateAttachment(a) && a.templateId === templateId)) {
        config.onMessage?.("Template already attached", "error")
        return
      }

      // Check max attachments
      if (config.maxAttachments && attachments.length >= config.maxAttachments) {
        config.onMessage?.(`Maximum ${config.maxAttachments} attachments allowed`, "error")
        return
      }

      // Create template attachment
      const attachment: TemplateAttachment = {
        kind: "template",
        id: crypto.randomUUID(),
        templateId,
        name,
        preview,
        uploadProgress: 100, // Templates don't need uploading
      }

      setAttachments(prev => [...prev, attachment])
    },
    [attachments, config],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id)
      // Only revoke blob URLs for file uploads
      if (attachment && isFileUpload(attachment) && attachment.preview?.startsWith("blob:")) {
        URL.revokeObjectURL(attachment.preview)
      }
      return prev.filter(a => a.id !== id)
    })
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments(prev => {
      // Revoke all blob URLs for file uploads
      prev.forEach(attachment => {
        if (isFileUpload(attachment) && attachment.preview?.startsWith("blob:")) {
          URL.revokeObjectURL(attachment.preview)
        }
      })
      return []
    })
  }, [])

  return {
    attachments,
    addAttachment,
    addPhotobookImage,
    addTemplateAttachment,
    removeAttachment,
    clearAttachments,
  }
}
