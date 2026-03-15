"use client"

import { Check, Copy, Image, Plus, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { DeleteModal } from "@/components/modals/DeleteModal"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useImageActions, useImages, useImagesLoading, useImagesUploading } from "@/lib/stores/imageStore"

export function WorkbenchPhotos() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { workspace, isTerminal, mounted } = useWorkspace({ allowEmpty: true })
  const images = useImages()
  const loading = useImagesLoading()
  const uploading = useImagesUploading()
  const { uploadImages, loadImages, deleteImage } = useImageActions()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (mounted && (!isTerminal || workspace)) {
      const workspaceParam = isTerminal && workspace ? workspace : undefined
      loadImages(workspaceParam)
    }
  }, [mounted, isTerminal, workspace, loadImages])

  const workspaceParam = isTerminal && workspace ? workspace : undefined

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    await uploadImages(files, workspaceParam)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

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

  return (
    <div className="h-full flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload images"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">
            Photos
          </h2>
          {!loading && images.length > 0 && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-600 tabular-nums">
              {images.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-[13px] text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors duration-100"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

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
            <p className="text-[12px] text-zinc-400 dark:text-zinc-600">Upload images to reference in chat</p>
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
          <div className="px-5 pb-5 grid grid-cols-3 gap-1.5">
            {images.map(image => (
              <div key={image.key} className="relative group">
                <div className="aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                  <img
                    src={image.variants.w640}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-90"
                  />
                </div>
                {/* Actions — appear on hover */}
                <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(image.key)}
                      className={`p-1.5 rounded-lg transition-colors duration-100 ${
                        copiedKey === image.key
                          ? "bg-emerald-500 text-white"
                          : "bg-black/50 text-white hover:bg-black/70"
                      }`}
                      aria-label="Copy image URL"
                    >
                      {copiedKey === image.key ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(image.key)}
                      className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-red-600 transition-colors duration-100"
                      aria-label="Delete image"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
