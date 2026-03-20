"use client"

import { Archive, Heart, HeartOff, MoreHorizontal, Plus } from "lucide-react"
import { createPortal } from "react-dom"
import { usePortalMenu } from "../hooks/usePortalMenu"

interface WorkspaceGroupMenuProps {
  workspace: string
  isFavorite: boolean
  conversationCount: number
  onNewConversation: (workspace: string) => void
  onToggleFavorite: (workspace: string) => void
  onArchiveAll: (workspace: string) => void
}

export function WorkspaceGroupMenu({
  workspace,
  isFavorite,
  conversationCount,
  onNewConversation,
  onToggleFavorite,
  onArchiveAll,
}: WorkspaceGroupMenuProps) {
  const { open, pos, triggerRef, menuRef, toggle, close } = usePortalMenu("below")

  const itemClass =
    "w-full flex items-center gap-3 px-3 py-2 text-[13px] text-black/60 dark:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors rounded-lg cursor-pointer"

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
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
            style={pos}
          >
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                close()
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
                close()
                onToggleFavorite(workspace)
              }}
            >
              {isFavorite ? (
                <>
                  <HeartOff size={14} strokeWidth={1.5} />
                  Remove favorite
                </>
              ) : (
                <>
                  <Heart size={14} strokeWidth={1.5} />
                  Add to favorites
                </>
              )}
            </button>

            {conversationCount > 0 && (
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  close()
                  onArchiveAll(workspace)
                }}
              >
                <Archive size={14} strokeWidth={1.5} />
                Archive all
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
