"use client"

import { useCallback, useRef, useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"

/**
 * Archive confirm/cancel state and handlers.
 * Two-click archive: first click shows confirm, second click archives.
 */
export function useArchiveActions(
  conversations: DbConversation[],
  onArchiveTabGroup: (tabGroupId: string) => void | Promise<void>,
) {
  const [archiveConfirmingId, setArchiveConfirmingId] = useState<string | null>(null)

  const archiveConfirmingRef = useRef(archiveConfirmingId)
  archiveConfirmingRef.current = archiveConfirmingId

  const handleArchiveClick = useCallback(
    (e: React.MouseEvent, conversation: DbConversation) => {
      e.stopPropagation()
      if (archiveConfirmingRef.current === conversation.id) {
        onArchiveTabGroup(conversation.id)
        setArchiveConfirmingId(null)
      } else {
        setArchiveConfirmingId(conversation.id)
      }
    },
    [onArchiveTabGroup],
  )

  const handleCancelArchive = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setArchiveConfirmingId(null)
  }, [])

  const handleArchiveAllInWorkspace = useCallback(
    async (ws: string) => {
      const wsConversations = conversations.filter(c => c.workspace === ws)
      // Archive sequentially to avoid race conditions in tab state management.
      // Each archive may change the active tab, so they must not interleave.
      for (const c of wsConversations) {
        await onArchiveTabGroup(c.id)
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
