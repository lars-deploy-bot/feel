"use client"

import type { DbConversation } from "@/lib/db/messageDb"
import { ConversationItem } from "./ConversationItem"

export interface ConversationListProps {
  conversations: DbConversation[]
  activeTabGroupId: string | null
  streamingConversationIds: ReadonlySet<string>
  archiveConfirmingId: string | null
  onTabGroupClick: (id: string) => void
  onArchiveClick: (e: React.MouseEvent, conversation: DbConversation) => void
  onCancelArchive: (e: React.MouseEvent) => void
  onRenameTabGroup: (id: string, title: string) => void
}

/**
 * Renders a list of ConversationItem components with consistent props.
 * Single implementation used by both FavoritesList and the ungrouped list.
 */
export function ConversationList({
  conversations,
  activeTabGroupId,
  streamingConversationIds,
  archiveConfirmingId,
  onTabGroupClick,
  onArchiveClick,
  onCancelArchive,
  onRenameTabGroup,
}: ConversationListProps) {
  return (
    <>
      {conversations.map(conversation => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          isActive={conversation.id === activeTabGroupId}
          isStreaming={streamingConversationIds.has(conversation.id)}
          isConfirming={archiveConfirmingId === conversation.id}
          onClick={() => onTabGroupClick(conversation.id)}
          onArchive={onArchiveClick}
          onCancelArchive={onCancelArchive}
          onRename={(id, title) => onRenameTabGroup(id, title)}
        />
      ))}
    </>
  )
}
