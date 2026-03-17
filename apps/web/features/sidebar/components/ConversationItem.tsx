"use client"

import { Archive, Bot, Check, Pencil, X } from "lucide-react"
import { useRef, useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"
import { formatTimestamp, workspaceSlug } from "../utils"

function StreamingDot() {
  return (
    <span className="relative flex size-1.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
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
      draggable={!isEditing}
      onDragStart={e => {
        e.dataTransfer.setData("text/plain", conversation.id)
        e.dataTransfer.effectAllowed = "move"
      }}
      onClick={isEditing ? undefined : onClick}
      tabIndex={isEditing ? undefined : 0}
      onKeyDown={e => {
        if (!isEditing && (e.key === "Enter" || e.key === " ")) {
          onClick?.()
        }
      }}
      className="group px-0 py-px"
    >
      <div
        className={`
          flex items-start gap-2 px-3 py-2 mx-2 rounded-lg cursor-pointer
          transition-colors duration-100
          ${isActive ? "bg-black/[0.04] dark:bg-white/[0.04]" : "hover:bg-black/[0.025] dark:hover:bg-white/[0.025]"}
        `}
      >
        {isStreaming && (
          <span className="mt-1.5">
            <StreamingDot />
          </span>
        )}
        {conversation.source === "automation_run" && (
          <Bot size={13} strokeWidth={1.75} className="shrink-0 mt-[3px] text-black/20 dark:text-white/20" />
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleEditKeyDown}
              onClick={e => e.stopPropagation()}
              className="w-full text-[13px] text-black dark:text-white bg-transparent outline-none"
            />
          ) : (
            <span
              className={`text-[13px] truncate ${
                isActive ? "text-black dark:text-white font-medium" : "text-black/40 dark:text-white/40"
              }`}
            >
              {conversation.title}
            </span>
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] text-black/20 dark:text-white/20 truncate">
              {workspaceSlug(conversation.workspace)}
            </span>
            <span className="text-[11px] text-black/15 dark:text-white/15 shrink-0 tabular-nums">
              {formatTimestamp(conversation.updatedAt)}
            </span>
          </div>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-0.5 shrink-0 mt-px opacity-0 group-hover:opacity-100 transition-opacity duration-100">
            {isConfirming && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onCancelArchive(e)
                }}
                className="size-5 rounded-lg flex items-center justify-center text-black/25 dark:text-white/25 hover:text-black/50 dark:hover:text-white/50 active:scale-90 transition-colors duration-100"
                aria-label="Cancel archive"
              >
                <X size={12} strokeWidth={2} />
              </button>
            )}

            {!isConfirming && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="size-5 rounded-lg flex items-center justify-center text-black/25 dark:text-white/25 hover:text-black/50 dark:hover:text-white/50 active:scale-90 transition-colors duration-100"
                aria-label="Rename"
              >
                <Pencil size={11} strokeWidth={1.75} />
              </button>
            )}

            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onArchive(e, conversation)
              }}
              className={`size-5 rounded-lg flex items-center justify-center active:scale-90 transition-colors duration-100 ${
                isConfirming
                  ? "bg-black/[0.06] dark:bg-white/[0.06] text-black/70 dark:text-white/70"
                  : "text-black/25 dark:text-white/25 hover:text-black/50 dark:hover:text-white/50"
              }`}
              aria-label={isConfirming ? "Confirm archive" : "Archive"}
            >
              {isConfirming ? <Check size={11} strokeWidth={2} /> : <Archive size={11} strokeWidth={1.75} />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
