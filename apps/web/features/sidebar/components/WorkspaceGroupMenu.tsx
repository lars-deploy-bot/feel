"use client"

import { Archive, Heart, HeartOff, MoreHorizontal, Plus } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

interface WorkspaceGroupMenuProps {
  workspace: string
  conversationCount: number
  onNewConversation: (workspace: string) => void
  onRemoveFavorite: (workspace: string) => void
  onArchiveAll: (workspace: string) => void
  onManageFavorites: () => void
}

export function WorkspaceGroupMenu({
  workspace,
  conversationCount,
  onNewConversation,
  onRemoveFavorite,
  onArchiveAll,
  onManageFavorites,
}: WorkspaceGroupMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 200),
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener("resize", updatePosition)
    return () => window.removeEventListener("resize", updatePosition)
  }, [open, updatePosition])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return
      if (menuRef.current?.contains(e.target)) return
      if (triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  const itemClass =
    "w-full flex items-center gap-3 px-3 py-2 text-[13px] text-black/60 dark:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors rounded-lg cursor-pointer"

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={e => {
          e.stopPropagation()
          setOpen(prev => !prev)
        }}
        className="size-5 rounded-md flex items-center justify-center text-black/25 dark:text-white/25 hover:text-black/50 dark:hover:text-white/50 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] opacity-0 group-hover/ws:opacity-100 transition-all duration-100 shrink-0"
        aria-label="Workspace options"
      >
        <MoreHorizontal size={13} strokeWidth={1.75} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-48 bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden py-1.5"
            style={{ top: pos.top, left: pos.left }}
          >
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpen(false)
                onNewConversation(workspace)
              }}
            >
              <Plus size={14} strokeWidth={1.5} />
              New conversation
            </button>

            <div className="border-t border-black/[0.06] dark:border-white/[0.06] my-1" />

            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpen(false)
                onRemoveFavorite(workspace)
              }}
            >
              <HeartOff size={14} strokeWidth={1.5} />
              Remove favorite
            </button>

            {conversationCount > 0 && (
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  setOpen(false)
                  onArchiveAll(workspace)
                }}
              >
                <Archive size={14} strokeWidth={1.5} />
                Archive all
              </button>
            )}

            <div className="border-t border-black/[0.06] dark:border-white/[0.06] my-1" />

            <button
              type="button"
              className={itemClass}
              onClick={() => {
                setOpen(false)
                onManageFavorites()
              }}
            >
              <Heart size={14} strokeWidth={1.5} />
              Manage favorites
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
