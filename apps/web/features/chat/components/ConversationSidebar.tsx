"use client"

import { AnimatePresence, motion } from "framer-motion"
import { MessageSquare, Plus, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useSidebarActions, useSidebarOpen } from "@/lib/stores/conversationSidebarStore"
import type { Conversation } from "@/lib/stores/messageStore"
import { useConversations, useCurrentConversationId } from "@/lib/stores/messageStore"

interface ConversationSidebarProps {
  workspace: string | null
  onNewConversation: () => void
  onConversationSelect: (conversationId: string) => void
  onDeleteConversation: (conversationId: string) => void
}

/**
 * ConversationSidebar - Shows past conversations (desktop only)
 *
 * Features:
 * - List of conversations sorted by last activity
 * - Click to switch conversations
 * - Delete conversations with confirmation modal
 * - New conversation button
 * - Escape key to close
 * - Static layout (non-overlay) with smooth width animation
 */
export function ConversationSidebar({
  workspace,
  onNewConversation,
  onConversationSelect,
  onDeleteConversation,
}: ConversationSidebarProps) {
  const isOpen = useSidebarOpen()
  const { closeSidebar } = useSidebarActions()
  // IMPORTANT: Only show conversations for current workspace (domain-scoped)
  // Pass workspace to filter, or undefined to show empty (safer than showing all)
  const allConversations = useConversations(workspace || "")
  const conversations = workspace ? allConversations : []
  const currentConversationId = useCurrentConversationId()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null)

  // Wait for client-side hydration to avoid mismatch with persisted data
  useEffect(() => {
    setMounted(true)
  }, [])

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

  const handleConversationClick = (conversationId: string) => {
    onConversationSelect(conversationId)
  }

  const handleDeleteClick = (e: React.MouseEvent, conversation: Conversation) => {
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
      onDeleteConversation(conversationToDelete.id)
    }
    setDeleteModalOpen(false)
    setConversationToDelete(null)
  }

  const handleCancelDelete = () => {
    setDeleteModalOpen(false)
    setConversationToDelete(null)
  }

  const handleNewConversation = () => {
    onNewConversation()
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
        aria-label="Conversation history"
      >
        <div className="flex flex-col h-full min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-black/10 dark:border-white/10">
            <h2 className="text-sm font-medium text-black dark:text-white flex items-center gap-2">
              <MessageSquare size={16} />
              <span>Conversations</span>
            </h2>
            <button
              type="button"
              onClick={closeSidebar}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
              aria-label="Close sidebar"
            >
              <X size={16} className="text-black/60 dark:text-white/60" />
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {!mounted ? (
              <div className="px-4 py-8 text-center text-sm text-black/40 dark:text-white/40">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-black/40 dark:text-white/40">No conversations yet</div>
            ) : (
              <div className="py-2">
                <AnimatePresence mode="popLayout">
                  {conversations.map(conversation => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={conversation.id === currentConversationId}
                      onClick={() => handleConversationClick(conversation.id)}
                      onDelete={e => handleDeleteClick(e, conversation)}
                      formatTimestamp={formatTimestamp}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* New conversation button */}
          <div className="border-t border-black/10 dark:border-white/10 p-3">
            <button
              type="button"
              onClick={handleNewConversation}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white dark:bg-white dark:text-black hover:bg-black/90 dark:hover:bg-white/90 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              <span>New conversation</span>
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
                Delete conversation
              </h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-black/70 dark:text-white/70 mb-2">
                Are you sure you want to delete this conversation?
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
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent, conversation: Conversation) => void
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
            <span>{formatTimestamp(conversation.lastActivity)}</span>
            <span>•</span>
            <span>{conversation.messages.length} messages</span>
          </div>
        </div>
        {!isActive && (
          <button
            type="button"
            onClick={e => onDelete(e, conversation)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
            aria-label="Delete conversation"
          >
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
