"use client"

import { Archive, Bot, Check, Pencil, X } from "lucide-react"
import { useRef, useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"
import { AUTOMATION_RUN_SOURCE } from "@/lib/db/messageDb"
import { formatTimestamp } from "../utils"

function StreamingDot() {
  return (
    <span className="relative flex size-1.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
    </span>
  )
}

function ActionButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: (e: React.MouseEvent) => void
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`size-6 rounded-lg flex items-center justify-center transition-colors duration-100 ${
        active
          ? "bg-black/[0.06] dark:bg-white/[0.06] text-black/60 dark:text-white/60"
          : "text-black/20 dark:text-white/20 hover:text-black/50 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
      }`}
      aria-label={label}
    >
      {children}
    </button>
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

  const isAutomation = conversation.source === AUTOMATION_RUN_SOURCE

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Interactive when not editing
    <div
      onClick={isEditing ? undefined : onClick}
      tabIndex={isEditing ? undefined : 0}
      onKeyDown={e => {
        if (!isEditing && (e.key === "Enter" || e.key === " ")) {
          onClick?.()
        }
      }}
      className="group"
    >
      <div
        className={`
          flex items-center gap-2 pl-4 pr-2 h-8 cursor-pointer
          transition-colors duration-100
          ${isActive ? "bg-black/[0.04] dark:bg-white/[0.04]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"}
        `}
      >
        {/* Left indicator */}
        <div className="w-3.5 flex items-center justify-center shrink-0">
          {isStreaming ? (
            <StreamingDot />
          ) : isAutomation ? (
            <Bot size={13} strokeWidth={1.5} className="text-black/20 dark:text-white/20" />
          ) : null}
        </div>

        {/* Title — inline editable, no visible input chrome */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleEditKeyDown}
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 text-[13px] text-black dark:text-white bg-transparent outline-none caret-black/50 dark:caret-white/50 selection:bg-black/10 dark:selection:bg-white/10"
          />
        ) : (
          <span
            className={`text-[13px] truncate flex-1 min-w-0 ${
              isActive ? "text-black dark:text-white" : "text-black/50 dark:text-white/50"
            }`}
          >
            {conversation.title}
          </span>
        )}

        {/* Right side: timestamp or actions */}
        {!isEditing && (
          <>
            <span className="text-[11px] text-black/15 dark:text-white/15 shrink-0 tabular-nums group-hover:hidden">
              {formatTimestamp(conversation.updatedAt)}
            </span>
            <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
              {isConfirming ? (
                <>
                  <ActionButton
                    onClick={e => {
                      e.stopPropagation()
                      onCancelArchive(e)
                    }}
                    label="Cancel"
                  >
                    <X size={12} strokeWidth={2} />
                  </ActionButton>
                  <ActionButton
                    onClick={e => {
                      e.stopPropagation()
                      onArchive(e, conversation)
                    }}
                    label="Confirm archive"
                    active
                  >
                    <Check size={12} strokeWidth={2} />
                  </ActionButton>
                </>
              ) : (
                <>
                  <ActionButton onClick={handleStartEdit} label="Rename">
                    <Pencil size={11} strokeWidth={1.75} />
                  </ActionButton>
                  <ActionButton
                    onClick={e => {
                      e.stopPropagation()
                      onArchive(e, conversation)
                    }}
                    label="Archive"
                  >
                    <Archive size={11} strokeWidth={1.75} />
                  </ActionButton>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
