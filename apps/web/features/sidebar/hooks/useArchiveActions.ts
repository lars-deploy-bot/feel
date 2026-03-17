"use client"

import { useCallback, useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"

/**
 * Archive confirm/cancel state and handlers.
 * Two-click archive: first click shows confirm, second click archives.
 */
export function useArchiveActions(conversations: DbConversation[], onArchiveTabGroup: (tabGroupId: string) => void) {
  const [archiveConfirmingId, setArchiveConfirmingId] = useState<string | null>(null)

  const handleArchiveClick = useCallback(
    (e: React.MouseEvent, conversation: DbConversation) => {
      e.stopPropagation()
      if (archiveConfirmingId === conversation.id) {
        onArchiveTabGroup(conversation.id)
        setArchiveConfirmingId(null)
      } else {
        setArchiveConfirmingId(conversation.id)
      }
    },
    [archiveConfirmingId, onArchiveTabGroup],
  )

  const handleCancelArchive = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setArchiveConfirmingId(null)
  }, [])

  const handleArchiveAllInWorkspace = useCallback(
    (ws: string) => {
      const wsConversations = conversations.filter(c => c.workspace === ws)
      for (const c of wsConversations) {
        onArchiveTabGroup(c.id)
      }
    },
    [conversations, onArchiveTabGroup],
  )

  return {
    archiveConfirmingId,
    handleArchiveClick,
    handleCancelArchive,
    handleArchiveAllInWorkspace,
  }
}
