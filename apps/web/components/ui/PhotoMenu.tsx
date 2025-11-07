"use client"

import { Plus, Trash2 } from "lucide-react"
import type { RefObject } from "react"
import { useEffect, useRef, useState } from "react"
import { DeleteModal } from "@/components/modals/DeleteModal"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useImageStore } from "@/lib/stores/imageStore"

interface PhotoMenuProps {
  isOpen: boolean
  onClose: () => void
  triggerRef?: RefObject<HTMLButtonElement | null>
}

export function PhotoMenu({ isOpen, onClose, triggerRef }: PhotoMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { workspace, isTerminal, mounted } = useWorkspace()
  const { images, loading, uploading, uploadImages, loadImages, deleteImage } = useImageStore()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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

    // Reset input so same files can be selected again
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

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className="absolute top-full right-0 mt-2 bg-white dark:bg-[#2a2a2a] border border-black/10 dark:border-white/10 shadow-lg z-50 overflow-y-auto overflow-x-hidden"
      style={{
        width: "400px",
        minWidth: "400px",
        maxWidth: "400px",
        maxHeight: "400px",
        borderRadius: "2px",
      }}
    >
      <div className="p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload images"
        />
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-black/60 dark:text-white/60">Loading images...</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 items-start">
            {images.map(image => (
              <div key={image.key} className="relative group">
                <button
                  type="button"
                  className="w-full border-0 p-0 bg-transparent cursor-pointer"
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.effectAllowed = "copy"
                    e.dataTransfer.setData("application/x-photobook-image", image.key)
                  }}
                >
                  <img
                    src={image.variants.thumb}
                    alt=""
                    className="w-full h-auto rounded hover:opacity-80 transition-opacity pointer-events-none"
                  />
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setDeleteConfirm(image.key)
                  }}
                  className="absolute top-1 right-1 p-1.5 bg-white/90 dark:bg-black/90 hover:bg-red-50 dark:hover:bg-red-900/50 text-black/40 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  aria-label="Delete image"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              className="col-span-4 w-full h-12 border border-black/10 dark:border-white/10 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label={uploading ? "Uploading images" : "Upload new images"}
            >
              <Plus className="w-4 h-4 text-black/60 dark:text-white/60" />
              <span className="text-sm font-medium text-black/80 dark:text-white/80">Add photos</span>
            </button>
          </div>
        )}
        {uploading && <p className="text-sm text-black/60 dark:text-white/60 mt-3 text-center">Uploading...</p>}
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
