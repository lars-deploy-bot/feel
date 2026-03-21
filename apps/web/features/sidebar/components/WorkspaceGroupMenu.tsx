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

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="size-[22px] rounded-md flex items-center justify-center text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors duration-100 shrink-0"
        aria-label="Workspace options"
      >
        <MoreHorizontal size={13} strokeWidth={1.75} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-[200px] bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] overflow-hidden py-1"
            style={pos}
          >
            <MenuItem
              icon={<Plus size={14} strokeWidth={1.5} />}
              label="New conversation"
              onClick={() => {
                close()
                onNewConversation(workspace)
              }}
            />

            <div className="mx-2 my-0.5 border-t border-black/[0.06] dark:border-white/[0.06]" />

            <MenuItem
              icon={isFavorite ? <HeartOff size={14} strokeWidth={1.5} /> : <Heart size={14} strokeWidth={1.5} />}
              label={isFavorite ? "Remove favorite" : "Add to favorites"}
              onClick={() => {
                close()
                onToggleFavorite(workspace)
              }}
            />

            {conversationCount > 0 && (
              <MenuItem
                icon={<Archive size={14} strokeWidth={1.5} />}
                label="Archive all"
                onClick={() => {
                  close()
                  onArchiveAll(workspace)
                }}
              />
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-black/60 dark:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
    >
      <span className="shrink-0 text-black/35 dark:text-white/35">{icon}</span>
      {label}
    </button>
  )
}
