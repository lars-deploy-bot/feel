"use client"

import { Archive, Check, Pencil, X } from "lucide-react"
import { useRef, useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"
import { styles } from "../sidebar-styles"
import { formatTimestamp } from "../utils"

function StreamingDot() {
  return (
    <span className="relative flex size-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
    </span>
  )
}

export function ConversationItem({
  conversation,
  isActive,
  isStreaming,
  isConfirming,
  onClick,
  onArchive,
  onCancelArchive,
  onRename,
}: {
  conversation: DbConversation
  isActive: boolean
  isStreaming: boolean
  isConfirming: boolean
  onClick: () => void
  onArchive: (e: React.MouseEvent, conversation: DbConversation) => void
  onCancelArchive: (e: React.MouseEvent) => void
  onRename: (id: string, title: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(conversation.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(conversation.title)
    setIsEditing(true)
    // Focus input after state update
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleSaveEdit = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== conversation.title) {
      onRename(conversation.id, trimmed)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditValue(conversation.title)
    setIsEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleCancelEdit()
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Interactive when not editing
    <div
      className="border-b border-black/[0.06] dark:border-white/[0.06] last:border-b-0 group"
      onClick={isEditing ? undefined : onClick}
      tabIndex={isEditing ? undefined : 0}
      onKeyDown={e => {
        if (!isEditing && (e.key === "Enter" || e.key === " ")) {
          onClick?.()
        }
      }}
    >
      <div
        className={`
          w-full px-4 py-3 flex items-start justify-between gap-3
          text-left ${styles.transitionAll} cursor-pointer
          ${isActive ? "bg-black/[0.02] dark:bg-white/[0.02]" : "hover:bg-black/[0.01] dark:hover:bg-white/[0.01]"}
        `}
      >
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleEditKeyDown}
              onClick={e => e.stopPropagation()}
              className={`
                w-full text-sm font-medium ${styles.textPrimary}
                bg-transparent outline-none
                ${styles.transitionAll}
              `}
            />
          ) : (
            <div className={`text-sm font-medium ${styles.textPrimary} line-clamp-2 flex items-center gap-2`}>
              {isStreaming && <StreamingDot />}
              <span className="flex-1 min-w-0 truncate">{conversation.title}</span>
            </div>
          )}
          <div className={`text-xs ${styles.textMuted} mt-1 flex items-center gap-1.5`}>
            <span>{formatTimestamp(conversation.updatedAt)}</span>
            <span className={styles.textSubtle}>·</span>
            <span>{conversation.messageCount ?? 0} messages</span>
          </div>
        </div>

        {!isEditing && (
          <div
            className={`
            flex items-center gap-2 shrink-0 -mx-2 px-2
            opacity-40 md:opacity-0 md:group-hover:opacity-100
            transition-opacity duration-150
          `}
          >
            {/* Cancel archive button */}
            {isConfirming && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onCancelArchive(e)
                }}
                className={`
                  size-6 rounded flex items-center justify-center
                  text-black/50 dark:text-white/50
                  hover:text-black/70 dark:hover:text-white/70
                  hover:bg-black/[0.05] dark:hover:bg-white/[0.08]
                  ${styles.transitionAll}
                  active:scale-90
                `}
                aria-label="Cancel archive"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            )}

            {/* Rename button */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                handleStartEdit(e)
              }}
              className={`
                ${isConfirming ? "hidden" : ""}
                size-6 rounded flex items-center justify-center
                text-black/40 dark:text-white/40
                hover:text-black/60 dark:hover:text-white/60
                hover:bg-black/[0.05] dark:hover:bg-white/[0.08]
                ${styles.transitionAll}
                active:scale-90
              `}
              aria-label="Rename conversation"
            >
              <Pencil size={13} strokeWidth={1.75} />
            </button>

            {/* Archive button */}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onArchive(e, conversation)
              }}
              className={`
                size-6 rounded flex items-center justify-center
                ${styles.transitionAll}
                active:scale-90
                ${
                  isConfirming
                    ? "bg-black/[0.15] dark:bg-white/[0.15] text-black dark:text-white hover:bg-black/[0.2] dark:hover:bg-white/[0.2]"
                    : `text-black/40 dark:text-white/40
                       hover:text-black/60 dark:hover:text-white/60
                       hover:bg-black/[0.05] dark:hover:bg-white/[0.08]`
                }
              `}
              aria-label={isConfirming ? "Confirm archive" : "Archive conversation"}
            >
              {isConfirming ? <Check size={13} strokeWidth={3} /> : <Archive size={13} strokeWidth={1.75} />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
