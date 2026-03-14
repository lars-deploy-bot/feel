"use client"

import { useCallback, useEffect, useRef } from "react"
import { createPreviewUrl, getAttachmentType, validateFile } from "@/features/chat/utils/file-validation"
import { useAttachmentStore, useTabAttachments } from "@/lib/stores/attachmentStore"
import { useImages } from "@/lib/stores/imageStore"
import { hashFile } from "@/lib/utils/file-hash"
import type {
  AddSkillFn,
  Attachment,
  ChatInputConfig,
  FileUploadAttachment,
  LibraryImageAttachment,
  UploadedFileAttachment,
} from "../types"
import {
  isFileUpload,
  isLibraryImage,
  isSkillAttachment,
  isSuperTemplateAttachment,
  isUploadedFile,
  isUserPromptAttachment,
} from "../types"

/**
 * Converts file-upload attachment to library-image attachment.
 * This ensures uploaded files are sent to Claude (prompt-builder only includes library-image).
 */
function convertToLibraryImage(
  fileUploadAttachment: FileUploadAttachment,
  photobookKey: string,
  preview: string,
): LibraryImageAttachment {
  return {
    kind: "library-image",
    id: fileUploadAttachment.id,
    photobookKey,
    preview,
    uploadProgress: 100,
  }
}

/**
 * Converts file-upload attachment to uploaded-file attachment.
 * Used when uploading files to workspace for Claude SDK Read tool access.
 */
function convertToUploadedFile(
  fileUploadAttachment: FileUploadAttachment,
  workspacePath: string,
  originalName: string,
  mimeType: string,
  size: number,
): UploadedFileAttachment {
  return {
    kind: "uploaded-file",
    id: fileUploadAttachment.id,
    workspacePath,
    originalName,
    mimeType,
    size,
    preview: fileUploadAttachment.preview, // Keep blob preview for UI
    uploadProgress: 100,
  }
}

/**
 * Safely revokes a blob URL if it's valid.
 */
function revokeBlobUrl(url: string | undefined): void {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

/**
 * Upload file to workspace for SDK Read tool access.
 * Returns the workspace-relative path on success.
 */
async function uploadToWorkspace(
  file: File,
  workspace: string | undefined,
  worktree: string | null | undefined,
): Promise<{ path: string; originalName: string; size: number; mimeType: string }> {
  const formData = new FormData()
  formData.append("file", file)
  if (workspace) {
    formData.append("workspace", workspace)
  }
  if (worktree) {
    formData.append("worktree", worktree)
  }

  const response = await fetch("/api/files/upload", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Upload failed" }))
    throw new Error(error.message || `Upload failed: ${response.status}`)
  }

  const result = await response.json()
  if (!result.ok) {
    throw new Error(result.message || "Upload failed")
  }

  return {
    path: result.path,
    originalName: result.originalName,
    size: result.size,
    mimeType: result.mimeType,
  }
}

export function useAttachments(config: ChatInputConfig, tabId: string | null) {
  const attachments = useTabAttachments(tabId)
  const images = useImages()

  // Store reference for imperative access in callbacks (always fresh state)
  const store = useAttachmentStore

  // Load draft attachments from IndexedDB when tab becomes active
  const loadedTabs = useRef(new Set<string>())
  useEffect(() => {
    if (!tabId) return
    // Only load once per tab per mount (avoid re-loading after user edits)
    if (loadedTabs.current.has(tabId)) return
    loadedTabs.current.add(tabId)

    // Skip if attachments already in memory (e.g. user just added them)
    if (store.getState().get(tabId).length > 0) return

    void store.getState().loadFromDexie(tabId)
  }, [tabId, store])

  /** Returns current attachments if the tab can accept more, null otherwise (shows error toast). */
  const canAddAttachment = (): Attachment[] | null => {
    if (!tabId) return null
    const current = store.getState().get(tabId)
    if (config.maxAttachments && current.length >= config.maxAttachments) {
      config.onMessage?.(`Maximum ${config.maxAttachments} attachments allowed`, "error")
      return null
    }
    return current
  }

  /** Append a single attachment to the current tab. */
  const appendAttachment = (attachment: Attachment): void => {
    if (!tabId) return
    store.getState().update(tabId, prev => [...prev, attachment])
  }

  const addAttachment = useCallback(
    async (file: File) => {
      if (!tabId) return

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

      const current = canAddAttachment()
      if (!current) return

      // Check if same file already attached
      if (current.some(a => isFileUpload(a) && a.file.name === file.name && a.file.size === file.size)) {
        config.onMessage?.("File already attached", "error")
        return
      }

      // Check if this hash matches an already attached photobook image
      const existingImage = images.find(img => img.key.includes(hash))
      if (existingImage && current.some(a => isLibraryImage(a) && a.photobookKey === existingImage.key)) {
        config.onMessage?.("Image already attached", "error")
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

      appendAttachment(attachment)

      // If already exists in imageStore, skip upload but convert to library-image
      if (existingImage) {
        revokeBlobUrl(attachment.preview)

        store
          .getState()
          .update(tabId, prev =>
            prev.map(a =>
              a.id === attachment.id && isFileUpload(a)
                ? convertToLibraryImage(a, existingImage.key, existingImage.variants.w640)
                : a,
            ),
          )
        return
      }

      // Upload new file
      if (config.onAttachmentUpload) {
        try {
          // Progress callback updates attachment progress in real-time
          const onProgress = (progress: number) => {
            store
              .getState()
              .update(tabId, prev => prev.map(a => (a.id === attachment.id ? { ...a, uploadProgress: progress } : a)))
          }

          const imageKey = await config.onAttachmentUpload(file, onProgress)

          // Convert file-upload → library-image after successful upload
          // This ensures the uploaded file is sent to Claude (prompt-builder only includes library-image)
          const [domain, hash] = imageKey.split("/", 2)
          if (!domain || !hash) {
            throw new Error(`Invalid image key format: ${imageKey}`)
          }
          const preview = `/_images/t/${domain}/o/${hash}/v/w640.webp`

          revokeBlobUrl(attachment.preview)

          store
            .getState()
            .update(tabId, prev =>
              prev.map(a =>
                a.id === attachment.id && isFileUpload(a) ? convertToLibraryImage(a, imageKey, preview) : a,
              ),
            )

          config.onMessage?.(`Uploaded ${file.name}`, "success")
        } catch (error) {
          // Set error state on attachment
          store.getState().update(tabId, prev =>
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
        store
          .getState()
          .update(tabId, prev => prev.map(a => (a.id === attachment.id ? { ...a, uploadProgress: 100 } : a)))
      }
    },
    [tabId, config, images, store],
  )

  const addPhotobookImage = useCallback(
    (imageKey: string) => {
      const current = canAddAttachment()
      if (!current) return

      if (current.some(a => isLibraryImage(a) && a.photobookKey === imageKey)) {
        config.onMessage?.("Image already attached", "error")
        return
      }

      const image = images.find(img => img.key === imageKey)
      if (!image) {
        config.onMessage?.("Image not found", "error")
        return
      }

      appendAttachment({
        kind: "library-image",
        id: crypto.randomUUID(),
        photobookKey: imageKey,
        preview: image.variants.w640,
        uploadProgress: 100,
      })
    },
    [tabId, images, config, store],
  )

  const addSuperTemplateAttachment = useCallback(
    (templateId: string, name: string, preview: string) => {
      const current = canAddAttachment()
      if (!current) return

      if (current.some(a => isSuperTemplateAttachment(a) && a.templateId === templateId)) {
        config.onMessage?.("SuperTemplate already attached", "error")
        return
      }

      appendAttachment({
        kind: "supertemplate",
        id: crypto.randomUUID(),
        templateId,
        name,
        preview,
        uploadProgress: 100,
      })
    },
    [tabId, config, store],
  )

  /** @deprecated Use addSkill instead */
  const addUserPrompt = useCallback(
    (promptType: string, data: string, displayName: string, userFacingDescription?: string) => {
      const current = canAddAttachment()
      if (!current) return

      if (current.some(a => isUserPromptAttachment(a) && a.promptType === promptType)) {
        config.onMessage?.(`"${displayName}" already attached`, "error")
        return
      }

      appendAttachment({
        kind: "user-prompt",
        id: crypto.randomUUID(),
        promptType,
        data,
        displayName,
        userFacingDescription,
        uploadProgress: 100,
      })
    },
    [tabId, config, store],
  )

  const addSkill: AddSkillFn = useCallback(
    (skillId, displayName, description, prompt, source) => {
      const current = canAddAttachment()
      if (!current) return

      if (current.some(a => isSkillAttachment(a) && a.skillId === skillId)) {
        config.onMessage?.(`"${displayName}" already attached`, "error")
        return
      }

      appendAttachment({
        kind: "skill",
        id: crypto.randomUUID(),
        skillId,
        displayName,
        description,
        prompt,
        source,
        uploadProgress: 100,
      })
    },
    [tabId, config, store],
  )

  /**
   * Add a file for Claude to analyze via SDK Read tool.
   * Uploads the file to the workspace's .uploads/ directory.
   */
  const addFileForAnalysis = useCallback(
    async (file: File, workspace?: string, worktree?: string | null) => {
      if (!tabId) return

      // Validate file (use same validation as regular attachments)
      const validation = validateFile(file, {
        maxFileSize: config.maxFileSize,
        allowedFileTypes: config.allowedFileTypes,
      })

      if (!validation.valid) {
        config.onMessage?.(validation.error || "Invalid file", "error")
        return
      }

      const current = canAddAttachment()
      if (!current) return

      // Check if same file already attached for analysis
      if (current.some(a => isUploadedFile(a) && a.originalName === file.name && a.size === file.size)) {
        config.onMessage?.("File already attached for analysis", "error")
        return
      }

      // Create temporary file-upload attachment for immediate UI feedback
      const tempAttachment: FileUploadAttachment = {
        kind: "file-upload",
        id: crypto.randomUUID(),
        file,
        category: getAttachmentType(file),
        preview: createPreviewUrl(file),
        uploadProgress: 0,
      }

      appendAttachment(tempAttachment)

      try {
        // Update progress to show upload started
        store
          .getState()
          .update(tabId, prev => prev.map(a => (a.id === tempAttachment.id ? { ...a, uploadProgress: 50 } : a)))

        // Upload to workspace
        const result = await uploadToWorkspace(file, workspace ?? config.workspace, worktree ?? config.worktree)

        // Convert to uploaded-file attachment
        store
          .getState()
          .update(tabId, prev =>
            prev.map(a =>
              a.id === tempAttachment.id && isFileUpload(a)
                ? convertToUploadedFile(a, result.path, result.originalName, result.mimeType, result.size)
                : a,
            ),
          )

        config.onMessage?.(`Uploaded ${file.name} for analysis`, "success")
      } catch (error) {
        // Set error state on attachment
        store.getState().update(tabId, prev =>
          prev.map(a =>
            a.id === tempAttachment.id
              ? {
                  ...a,
                  error: error instanceof Error ? error.message : "Upload failed",
                  uploadProgress: 0,
                }
              : a,
          ),
        )

        config.onMessage?.(error instanceof Error ? error.message : "Upload failed", "error")
      }
    },
    [tabId, config, store],
  )

  const removeAttachment = useCallback(
    (id: string) => {
      if (!tabId) return
      // Find and revoke blob URL before updating state
      const current = store.getState().get(tabId)
      const attachment = current.find(a => a.id === id)
      if (attachment && isFileUpload(attachment)) {
        revokeBlobUrl(attachment.preview)
      }

      store.getState().update(tabId, prev => prev.filter(a => a.id !== id))
    },
    [tabId, store],
  )

  const clearAttachments = useCallback(() => {
    if (!tabId) return
    // Revoke all blob URLs before clearing
    const current = store.getState().get(tabId)
    for (const attachment of current) {
      if (isFileUpload(attachment)) {
        revokeBlobUrl(attachment.preview)
      }
    }

    store.getState().clear(tabId)
  }, [tabId, store])

  /**
   * Toggle image mode between "website" (add to site) and "analyze" (Claude reads it)
   */
  const toggleImageMode = useCallback(
    (id: string) => {
      if (!tabId) return
      store.getState().update(tabId, prev =>
        prev.map(a => {
          if (a.id === id && isLibraryImage(a)) {
            const currentMode = a.mode ?? "website"
            return { ...a, mode: currentMode === "website" ? "analyze" : "website" }
          }
          return a
        }),
      )
    },
    [tabId, store],
  )

  return {
    attachments,
    addAttachment,
    addPhotobookImage,
    addSuperTemplateAttachment,
    addUserPrompt,
    addSkill,
    addFileForAnalysis,
    removeAttachment,
    clearAttachments,
    toggleImageMode,
  }
}
