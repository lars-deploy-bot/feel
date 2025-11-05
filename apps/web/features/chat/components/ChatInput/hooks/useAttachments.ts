"use client"

import { useCallback, useState } from "react"
import type { Attachment, ChatInputConfig } from "../types"
import { createPreviewUrl, getAttachmentType, validateFile } from "../utils/file-validation"

export function useAttachments(config: ChatInputConfig) {
  const [attachments, setAttachments] = useState<Attachment[]>([])

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

      // Check max attachments
      if (config.maxAttachments && attachments.length >= config.maxAttachments) {
        config.onMessage?.(`Maximum ${config.maxAttachments} attachments allowed`, "error")
        return
      }

      // Create attachment
      const attachment: Attachment = {
        id: crypto.randomUUID(),
        file,
        type: getAttachmentType(file),
        preview: createPreviewUrl(file),
        uploadProgress: 0,
      }

      setAttachments(prev => [...prev, attachment])

      // Simulate upload (replace with actual upload logic)
      if (config.onAttachmentUpload) {
        try {
          const _url = await config.onAttachmentUpload(file)
          setAttachments(prev => prev.map(a => (a.id === attachment.id ? { ...a, uploadProgress: 100 } : a)))
          config.onMessage?.(`Uploaded ${file.name}`, "success")
        } catch (error) {
          setAttachments(prev =>
            prev.map(a =>
              a.id === attachment.id
                ? {
                    ...a,
                    error: error instanceof Error ? error.message : "Upload failed",
                  }
                : a,
            ),
          )
          config.onMessage?.(`Failed to upload ${file.name}`, "error")
        }
      } else {
        // No upload handler, mark as complete immediately
        setAttachments(prev => prev.map(a => (a.id === attachment.id ? { ...a, uploadProgress: 100 } : a)))
      }
    },
    [attachments.length, config],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id)
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview)
      }
      return prev.filter(a => a.id !== id)
    })
  }, [])

  return {
    attachments,
    addAttachment,
    removeAttachment,
  }
}
