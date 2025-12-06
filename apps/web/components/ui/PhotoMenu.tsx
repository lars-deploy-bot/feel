"use client"

import { Check, Copy, Plus, Trash2, X } from "lucide-react"
import type { RefObject } from "react"
import { useEffect, useRef, useState } from "react"
import { DeleteModal } from "@/components/modals/DeleteModal"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useImages, useImagesLoading, useImagesUploading, useImageActions } from "@/lib/stores/imageStore"

interface PhotoMenuProps {
  isOpen: boolean
  onClose: () => void
  onSelectImage?: (imageKey: string) => void
  triggerRef?: RefObject<HTMLButtonElement | null>
}

export function PhotoMenu({ isOpen, onClose, onSelectImage, triggerRef }: PhotoMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { workspace, isTerminal, mounted } = useWorkspace({ allowEmpty: true })
  const images = useImages()
  const loading = useImagesLoading()
  const uploading = useImagesUploading()
  const { uploadImages, loadImages, deleteImage } = useImageActions()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Desktop: click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target instanceof Node)) return

      const clickedMenu = menuRef.current?.contains(event.target)
      const clickedTrigger = triggerRef?.current?.contains(event.target)

      if (!clickedMenu && !clickedTrigger) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose, triggerRef])

  // Prevent body scroll on mobile when open
  useEffect(() => {
    if (isOpen) {
      const isMobile = window.innerWidth < 640
      if (isMobile) {
        document.body.style.overflow = "hidden"
      }
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && mounted && (!isTerminal || workspace)) {
      const workspaceParam = isTerminal && workspace ? workspace : undefined
      loadImages(workspaceParam)
    }
  }, [isOpen, mounted, isTerminal, workspace, loadImages])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const workspaceParam = isTerminal && workspace ? workspace : undefined

    await uploadImages(files, workspaceParam)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      const workspaceParam = isTerminal && workspace ? workspace : undefined
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

  if (!isOpen) return null

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      multiple
      onChange={handleFileSelect}
      className="hidden"
      aria-label="Upload images"
    />
  )

  const uploadButton = (
    <button
      type="button"
      onClick={handleUploadClick}
      disabled={uploading}
      className="w-full h-12 border border-black/10 dark:border-white/10 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 active:bg-black/15 dark:active:bg-white/15 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      aria-label={uploading ? "Uploading images" : "Upload new images"}
    >
      <Plus className="w-4 h-4 text-black/60 dark:text-white/60" />
      <span className="text-sm font-medium text-black/80 dark:text-white/80">Add photos</span>
    </button>
  )

  const handleImageClick = (imageKey: string) => {
    if (onSelectImage) {
      onSelectImage(imageKey)
      onClose()
    }
  }

  const imageGrid = (
    <>
      {images.map(image => (
        <div key={image.key} className="relative group">
          <button
            type="button"
            className="w-full border-0 p-0 bg-transparent cursor-pointer"
            onClick={() => handleImageClick(image.key)}
            draggable
            onDragStart={e => {
              e.dataTransfer.effectAllowed = "copy"
              e.dataTransfer.setData("application/x-photobook-image", image.key)
            }}
          >
            <img
              src={image.variants.thumb}
              alt=""
              className="w-full h-auto rounded hover:opacity-80 active:opacity-60 transition-opacity pointer-events-none"
            />
          </button>
          {/* Action buttons: always visible on mobile, hover on desktop */}
          <div className="absolute top-1 right-1 flex flex-col gap-1">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setDeleteConfirm(image.key)
              }}
              className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 cursor-pointer border border-black/5 dark:border-white/10"
              aria-label="Delete image"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                handleCopyUrl(image.key)
              }}
              className={`p-1.5 rounded shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 cursor-pointer border ${
                copiedKey === image.key
                  ? "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                  : "bg-white dark:bg-zinc-900 hover:bg-blue-50 dark:hover:bg-blue-950 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 border-black/5 dark:border-white/10"
              }`}
              aria-label="Copy image URL"
            >
              {copiedKey === image.key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      ))}
    </>
  )

  const loadingState = (
    <div className="flex items-center justify-center py-8">
      <p className="text-sm text-black/60 dark:text-white/60">Loading images...</p>
    </div>
  )

  const deleteModal = deleteConfirm && (
    <DeleteModal
      title="Delete this image?"
      message="This action cannot be undone."
      confirmText="Delete"
      cancelText="Cancel"
      onConfirm={handleDeleteConfirm}
      onCancel={() => setDeleteConfirm(null)}
    />
  )

  return (
    <>
      {/* Shared file input - only one instance */}
      {fileInput}

      {/* Mobile: Bottom sheet */}
      <div className="sm:hidden fixed inset-0 z-50">
        {/* Backdrop */}
        <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />

        {/* Bottom sheet */}
        <div className="absolute bottom-0 left-0 right-0 h-[85vh] bg-white dark:bg-[#1a1a1a] rounded-t-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
            <h2 className="text-base font-medium text-black dark:text-white">Photos</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? loadingState : <div className="grid grid-cols-3 gap-3">{imageGrid}</div>}
          </div>

          {/* Sticky upload button */}
          <div className="p-4 border-t border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a]">
            {uploadButton}
            {uploading && <p className="text-sm text-black/60 dark:text-white/60 mt-2 text-center">Uploading...</p>}
          </div>
        </div>

        {deleteModal}
      </div>

      {/* Desktop: Dropdown */}
      <div
        ref={menuRef}
        className="hidden sm:block absolute top-full right-0 mt-2 bg-white dark:bg-[#2a2a2a] border border-black/10 dark:border-white/10 shadow-lg z-50 overflow-hidden"
        style={{
          width: "400px",
          borderRadius: "2px",
        }}
      >
        <div className="max-h-[400px] overflow-y-auto p-4">
          {loading ? loadingState : <div className="grid grid-cols-4 gap-3">{imageGrid}</div>}
        </div>

        {/* Sticky upload button */}
        <div className="p-4 border-t border-black/10 dark:border-white/10">
          {uploadButton}
          {uploading && <p className="text-sm text-black/60 dark:text-white/60 mt-2 text-center">Uploading...</p>}
        </div>

        {deleteModal}
      </div>
    </>
  )
}
