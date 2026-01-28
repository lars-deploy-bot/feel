"use client"

import { REFERRAL } from "@webalive/shared"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronRight, Heart, PanelLeftClose, Settings2, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useDexieConversations, useDexieCurrentConversationId, useDexieSession } from "@/lib/db/dexieMessageStore"
import type { DbConversation } from "@/lib/db/messageDb"
import { useSidebarActions, useSidebarOpen } from "@/lib/stores/conversationSidebarStore"
import { useAppHydrated } from "@/lib/stores/HydrationBoundary"

interface ConversationSidebarProps {
  workspace: string | null
  onTabGroupSelect: (tabGroupId: string) => void
  onDeleteTabGroup: (tabGroupId: string) => void
  onOpenSettings: () => void
  onOpenInvite: () => void
}

/**
 * ConversationSidebar - Shows past tab groups (desktop only)
 *
 * Features:
 * - List of tab groups sorted by last activity
 * - Click to switch tab groups
 * - Delete tab groups with confirmation modal
 * - Escape key to close
 * - Static layout (non-overlay) with smooth width animation
 */
export function ConversationSidebar({
  workspace,
  onTabGroupSelect,
  onDeleteTabGroup,
  onOpenSettings,
  onOpenInvite,
}: ConversationSidebarProps) {
  const isOpen = useSidebarOpen()
  const { closeSidebar } = useSidebarActions()
  // Wait for all persisted stores to hydrate before showing conversations
  // This prevents hydration mismatch with persisted data
  const isHydrated = useAppHydrated()
  // IMPORTANT: Only show conversations for current workspace (domain-scoped)
  // Pass workspace to filter, or undefined to show empty (safer than showing all)
  const session = useDexieSession()
  const allConversations = useDexieConversations(workspace || "", session)
  const conversations = workspace ? allConversations : []
  const currentConversationId = useDexieCurrentConversationId()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<DbConversation | null>(null)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSidebar()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, closeSidebar])

  const handleTabGroupClick = (tabGroupId: string) => {
    onTabGroupSelect(tabGroupId)
  }

  const handleDeleteClick = (e: React.MouseEvent, conversation: DbConversation) => {
    e.stopPropagation()

    // Don't allow deleting current conversation
    if (conversation.id === currentConversationId) {
      return
    }

    setConversationToDelete(conversation)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = () => {
    if (conversationToDelete) {
      onDeleteTabGroup(conversationToDelete.id)
    }
    setDeleteModalOpen(false)
    setConversationToDelete(null)
  }

  const handleCancelDelete = () => {
    setDeleteModalOpen(false)
    setConversationToDelete(null)
  }

  // Format timestamp as relative time
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <>
      {/* Sidebar - desktop only, static layout */}
      <aside
        ref={sidebarRef}
        className={`hidden md:flex flex-col h-full bg-white dark:bg-[#1a1a1a] border-r border-black/10 dark:border-white/10 transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? "w-[280px]" : "w-0 border-r-0"
        }`}
        aria-label="Tab group history"
      >
        <div className="flex flex-col h-full min-w-[280px]">
          {/* Header - h-14 matches chat header height */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-black/10 dark:border-white/10">
            <h2 className="text-sm font-medium text-black dark:text-white">Tab groups</h2>
            <button
              type="button"
              onClick={closeSidebar}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
              aria-label="Close sidebar"
            >
              <PanelLeftClose size={18} className="text-black/40 dark:text-white/40" />
            </button>
          </div>

          {/* Tab group list */}
          <div className="flex-1 overflow-y-auto">
            {!isHydrated ? (
              <div className="px-4 py-8 text-center text-sm text-black/40 dark:text-white/40">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-black/40 dark:text-white/40">No tab groups yet</div>
            ) : (
              <div className="py-2">
                <AnimatePresence mode="popLayout">
                  {conversations.map(conversation => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={conversation.id === currentConversationId}
                      onClick={() => handleTabGroupClick(conversation.id)}
                      onDelete={e => handleDeleteClick(e, conversation)}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Share section */}
          <div className="border-t border-black/10 dark:border-white/10 px-3 pt-3 pb-2.5 space-y-2.5">
            {REFERRAL.ENABLED && (
              <button
                type="button"
                onClick={onOpenInvite}
                className="w-full flex items-center gap-3 px-3 py-2.5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
              >
                <Heart
                  size={18}
                  className="text-black/40 dark:text-white/40 group-hover:text-black/60 dark:group-hover:text-white/60 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm text-black dark:text-white truncate">Share Alive</div>
                  <div className="text-xs text-black/40 dark:text-white/40 truncate">with someone you love</div>
                </div>
                <ChevronRight size={14} className="text-black/30 dark:text-white/30 flex-shrink-0" />
              </button>
            )}

            {/* Settings button */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center size-8 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
              aria-label="Settings"
            >
              <Settings2 size={18} className="text-black/40 dark:text-white/40" />
            </button>
          </div>
        </div>
      </aside>

      {/* Delete confirmation modal */}
      {deleteModalOpen && conversationToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[60] flex items-center justify-center"
          onClick={handleCancelDelete}
          onKeyDown={e => e.key === "Escape" && handleCancelDelete()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-black/10 dark:border-white/10">
              <h3 id="delete-dialog-title" className="text-lg font-medium text-black dark:text-white">
                Delete tab group
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-black/70 dark:text-white/70 mb-2">
                Are you sure you want to delete this tab group?
              </p>
              <p className="text-sm font-medium text-black dark:text-white line-clamp-2 bg-black/5 dark:bg-white/5 px-3 py-2 rounded">
                {conversationToDelete.title}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm font-medium text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 transition-colors rounded"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  )
}

interface ConversationItemProps {
  conversation: DbConversation
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent, conversation: DbConversation) => void
  formatTimestamp: (timestamp: number) => string
}

function ConversationItem({ conversation, isActive, onClick, onDelete, formatTimestamp }: ConversationItemProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`w-full text-left px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-l-2 group cursor-pointer ${
        isActive ? "border-black dark:border-white bg-black/5 dark:bg-white/5" : "border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-black dark:text-white line-clamp-2">{conversation.title}</div>
          <div className="text-xs text-black/40 dark:text-white/40 mt-1 flex items-center gap-1.5">
            <span>{formatTimestamp(conversation.updatedAt)}</span>
            <span>•</span>
            <span>{conversation.messageCount ?? 0} messages</span>
          </div>
        </div>
        {!isActive && (
          <button
            type="button"
            onClick={e => onDelete(e, conversation)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
            aria-label="Delete tab group"
          >
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
