"use client"

import { ChevronDown, GitBranch, MessageSquare } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { styles } from "../sidebar-styles"

export function NewChatDropdown({
  onNewChat,
  onNewWorktree,
  worktreeEnabled,
}: {
  onNewChat: () => void
  onNewWorktree: () => void
  worktreeEnabled: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Close on Escape (stop propagation so sidebar handler doesn't also fire)
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setIsOpen(false)
      }
    }
    document.addEventListener("keydown", handleEscape, true)
    return () => document.removeEventListener("keydown", handleEscape, true)
  }, [isOpen])

  const handleSelect = (action: () => void) => {
    setIsOpen(false)
    action()
  }

  // Simple button when worktrees are disabled
  if (!worktreeEnabled) {
    return (
      <button
        type="button"
        onClick={onNewChat}
        className={`w-full flex items-center justify-center py-2 px-3 rounded-lg text-sm ${styles.activeFill} ${styles.hoverFillStrong} ${styles.transition} ${styles.textPrimary}`}
      >
        New Chat
      </button>
    )
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm ${styles.activeFill} ${styles.hoverFillStrong} ${styles.transition} ${styles.textPrimary}`}
      >
        <span>New Chat</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`${styles.textMuted} transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown menu */}
      <div
        className={`absolute left-0 right-0 mt-1 bg-white dark:bg-neutral-800 rounded-lg border ${styles.border} shadow-lg overflow-hidden z-50 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
        } ${styles.transitionAll}`}
      >
        <button
          type="button"
          onClick={() => handleSelect(onNewChat)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left ${styles.textPrimary} ${styles.hoverFill} ${styles.transition}`}
        >
          <MessageSquare size={16} strokeWidth={1.75} className={styles.textMuted} />
          <span>Chat</span>
        </button>
        <div className={`border-t ${styles.borderSubtle}`} />
        <button
          type="button"
          onClick={() => handleSelect(onNewWorktree)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left ${styles.textPrimary} ${styles.hoverFill} ${styles.transition}`}
        >
          <GitBranch size={16} strokeWidth={1.75} className={styles.textMuted} />
          <span>Worktree</span>
        </button>
      </div>
    </div>
  )
}
