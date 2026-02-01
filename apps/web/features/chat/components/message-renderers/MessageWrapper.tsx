"use client"

/**
 * MessageWrapper Component
 *
 * Wraps individual messages with hover actions like delete.
 * Uses CSS-only hover for accessibility (no JS hover state needed).
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
    <div className="group relative min-w-0 max-w-full overflow-hidden">
      {children}

      {/* Delete button - appears on CSS hover (group-hover) */}
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            "absolute -right-2 top-0 p-1.5 rounded-md",
            "bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700",
            "text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          title="Delete this message and all messages after it"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
