"use client"

import { Check, Copy, Image, Plus, Trash2, Upload, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { DeleteModal } from "@/components/modals/DeleteModal"
import type { WorkbenchViewProps } from "@/features/chat/lib/workbench-context"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useImageActions, useImages, useImagesLoading, useImagesUploading } from "@/lib/stores/imageStore"

export function WorkbenchPhotos({ workspace: workspaceProp }: WorkbenchViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Photos view needs isTerminal/mounted from useWorkspace for conditional loading,
  // but uses workspace from props (the shared contract)
  const { isTerminal, mounted } = useWorkspace({ allowEmpty: true })
  const workspace = workspaceProp
  const images = useImages()
  const loading = useImagesLoading()
  const uploading = useImagesUploading()
  const { uploadImages, loadImages, deleteImage } = useImageActions()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    if (mounted && (!isTerminal || workspace)) {
      const workspaceParam = isTerminal && workspace ? workspace : undefined
      loadImages(workspaceParam)
    }
  }, [mounted, isTerminal, workspace, loadImages])

  const workspaceParam = isTerminal && workspace ? workspace : undefined

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileList =
        files instanceof FileList
          ? files
          : (() => {
              const dt = new DataTransfer()
              for (const f of files) dt.items.add(f)
              return dt.files
            })()
      if (fileList.length === 0) return
      await uploadImages(fileList, workspaceParam)
    },
    [uploadImages, workspaceParam],
  )

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    await handleFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))
      if (files.length > 0) handleFiles(files)
    },
    [handleFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteImage(deleteConfirm, workspaceParam)
      setDeleteConfirm(null)
    }
  }

  const handleCopyUrl = async (imageKey: string) => {
    const image = images.find(img => img.key === imageKey)
    if (!image) return
    const fullUrl = `${window.location.origin}${image.variants.orig}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedKey(imageKey)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const lightboxImage = lightbox ? images.find(img => img.key === lightbox) : null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop zone for photo uploads
    <div
      className="h-full flex flex-col relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload images"
      />

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 bg-white/90 dark:bg-black/90 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} strokeWidth={1.5} className="text-zinc-400 dark:text-zinc-500" />
            <p className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">Drop images here</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] text-zinc-400 dark:text-zinc-600">Loading...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-5">
            <div className="w-10 h-10 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
              <Image size={16} strokeWidth={1.5} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">No photos</p>
            <p className="text-[12px] text-zinc-400 dark:text-zinc-600">Drag images here or click to upload</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-1 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900
                text-[13px] font-medium
                hover:bg-zinc-800 dark:hover:bg-zinc-200
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors duration-100
                flex items-center gap-2"
            >
              <Plus size={14} strokeWidth={1.5} />
              Add photos
            </button>
          </div>
        ) : (
          <div className="p-3">
            {/* Grid — auto-fill columns based on panel width */}
            <div className="flex flex-wrap gap-1.5">
              {/* Add button as first tile */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-[160px] w-[100px] rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800
                  hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/50
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors duration-100
                  flex items-center justify-center shrink-0"
              >
                <Plus
                  size={20}
                  strokeWidth={1.5}
                  className={`${uploading ? "animate-spin text-zinc-300 dark:text-zinc-700" : "text-zinc-300 dark:text-zinc-700"}`}
                />
              </button>
              {images.map(image => (
                <div key={image.key} className="relative group h-[160px] shrink-0">
                  {/* biome-ignore lint/a11y/useSemanticElements: image thumbnail click-to-lightbox */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="h-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900 cursor-pointer"
                    onClick={() => setLightbox(image.key)}
                    onKeyDown={e => e.key === "Enter" && setLightbox(image.key)}
                  >
                    <img src={image.variants.w640} alt="" loading="lazy" className="h-full w-auto object-contain" />
                  </div>
                  {/* Actions — frosted pill, top-right */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                    <div
                      className="flex items-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl
                      border border-black/[0.06] dark:border-white/[0.06] rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          handleCopyUrl(image.key)
                        }}
                        className={`p-2 transition-colors duration-100 ${
                          copiedKey === image.key
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                        }`}
                        aria-label="Copy URL"
                      >
                        {copiedKey === image.key ? (
                          <Check size={15} strokeWidth={1.5} />
                        ) : (
                          <Copy size={15} strokeWidth={1.5} />
                        )}
                      </button>
                      <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06]" />
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setDeleteConfirm(image.key)
                        }}
                        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-100"
                        aria-label="Delete"
                      >
                        <Trash2 size={15} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        // biome-ignore lint/a11y/useSemanticElements: lightbox backdrop dismiss
        <div
          role="button"
          tabIndex={0}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setLightbox(null)}
          onKeyDown={e => e.key === "Escape" && setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-100"
            aria-label="Close"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stops lightbox close on image click */}
          <img
            src={lightboxImage.variants.w1280}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {deleteConfirm && (
        <DeleteModal
          title="Delete this image?"
          message="This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
