"use client"

/**
 * MessageWrapper Component
 *
 * Wraps individual messages with hover actions like delete.
 * Button positioned to the right on desktop (hidden on mobile).
 * Uses opacity + pointer-events for smooth fade without layout shift.
 */

import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useDexieMessageActions } from "@/lib/db/dexieMessageStore"
import { cn } from "@/lib/utils"

interface MessageWrapperProps {
  messageId: string
  tabId: string
  /** Whether this message can be deleted (has previous assistant message) */
  canDelete: boolean
  children: React.ReactNode
}

export function MessageWrapper({ messageId, tabId, canDelete, children }: MessageWrapperProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { deleteMessagesAfter } = useDexieMessageActions()

  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)

    try {
      const resumeUuid = await deleteMessagesAfter(messageId, tabId)
      if (resumeUuid) {
        console.log("[MessageWrapper] Messages deleted, will resume at:", resumeUuid)
      } else {
        console.warn("[MessageWrapper] Could not delete messages (no previous assistant)")
      }
    } catch (error) {
      console.error("[MessageWrapper] Delete failed:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="group flex items-start gap-2 min-w-0 max-w-full overflow-visible">
      {/* Message content */}
      <div className="flex-1 min-w-0">{children}</div>

      {/* Delete button - to the right on desktop, hidden on mobile */}
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            "flex-shrink-0 p-2 rounded-lg",
            "text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400",
            "hover:bg-red-50 dark:hover:bg-red-950/20",
            // Desktop: hidden by default, shown on hover
            "opacity-0 pointer-events-none",
            "md:group-hover:opacity-100 md:group-hover:pointer-events-auto",
            "transition-opacity duration-200",
            // Mobile: completely hidden
            "hidden md:block",
            // Loading state
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          title="Delete this message and all messages after it"
          aria-label="Delete message"
        >
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}
