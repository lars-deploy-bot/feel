"use client"

import type { RefObject } from "react"
import { useEffect, useRef } from "react"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
import { useImageStore } from "@/lib/stores/imageStore"

interface PhotoMenuProps {
  isOpen: boolean
  onClose: () => void
  triggerRef?: RefObject<HTMLButtonElement | null>
}

export function PhotoMenu({ isOpen, onClose, triggerRef }: PhotoMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { workspace, isTerminal, mounted } = useWorkspace()
  const { images, loading, loadImages } = useImageStore()

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
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-black/60 dark:text-white/60">Loading images...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-black/60 dark:text-white/60">No images yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {images.map(image => (
              <button
                key={image.key}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
