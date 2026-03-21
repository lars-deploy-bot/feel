"use client"

import { ChevronRight, Plus } from "lucide-react"
import type { WorkspaceGroup } from "../types"
import { deriveProjectName } from "../utils"
import type { ConversationListProps } from "./ConversationList"
import { ConversationList } from "./ConversationList"
import { WorkspaceGroupMenu } from "./WorkspaceGroupMenu"

interface WorkspaceGroupsListProps extends Omit<ConversationListProps, "conversations"> {
  workspaceGroups: WorkspaceGroup[]
  expandedWorkspaces: ReadonlySet<string>
  activeWorkspace: string | null
  onToggleExpanded: (ws: string) => void
  onNewConversationInWorkspace: (workspace: string) => void
  onToggleFavorite: (workspace: string) => void
  onArchiveAllInWorkspace: (workspace: string) => void
}

export function WorkspaceGroupsList({
  workspaceGroups,
  expandedWorkspaces,
  activeWorkspace,
  onToggleExpanded,
  onNewConversationInWorkspace,
  onToggleFavorite,
  onArchiveAllInWorkspace,
  ...listProps
}: WorkspaceGroupsListProps) {
  // Split: active workspace conversations at top, everything else below
  const activeGroup = activeWorkspace ? workspaceGroups.find(g => g.workspace === activeWorkspace) : null
  const otherGroups = workspaceGroups.filter(g => g.workspace !== activeWorkspace)

  return (
    <div className="flex flex-col">
      {/* Active workspace conversations — no header, just the list */}
      {activeGroup && activeGroup.conversations.length > 0 && (
        <div className="pb-1">
          <ConversationList conversations={activeGroup.conversations} {...listProps} />
        </div>
      )}

      {/* Other workspaces */}
      {otherGroups.length > 0 && (
        <>
          {activeGroup && activeGroup.conversations.length > 0 && (
            <div className="mx-3 my-1 border-b border-black/[0.06] dark:border-white/[0.06]" />
          )}

          {otherGroups.map(({ workspace: ws, isFavorite, conversations: wsConversations }) => (
            <WorkspaceGroupRow
              key={ws}
              workspace={ws}
              isFavorite={isFavorite}
              conversations={wsConversations}
              isExpanded={expandedWorkspaces.has(ws)}
              onToggleExpanded={onToggleExpanded}
              onNewConversation={onNewConversationInWorkspace}
              onToggleFavorite={onToggleFavorite}
              onArchiveAll={onArchiveAllInWorkspace}
              listProps={listProps}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ── Workspace group row ──────────────────────────────────────────────────────

function WorkspaceGroupRow({
  workspace,
  isFavorite,
  conversations,
  isExpanded,
  onToggleExpanded,
  onNewConversation,
  onToggleFavorite,
  onArchiveAll,
  listProps,
}: {
  workspace: string
  isFavorite: boolean
  conversations: WorkspaceGroup["conversations"]
  isExpanded: boolean
  onToggleExpanded: (ws: string) => void
  onNewConversation: (ws: string) => void
  onToggleFavorite: (ws: string) => void
  onArchiveAll: (ws: string) => void
  listProps: Omit<ConversationListProps, "conversations">
}) {
  const totalCount = conversations.length
  const hasConversations = totalCount > 0

  return (
    <div className="group/ws">
      {/* Header row */}
      <div className="flex items-center h-[30px] pr-1.5">
        <button
          type="button"
          onClick={() => hasConversations && onToggleExpanded(workspace)}
          className={`flex-1 flex items-center gap-1.5 pl-3 pr-2 h-full text-[13px] min-w-0 ${
            hasConversations ? "cursor-pointer" : "cursor-default"
          }`}
        >
          <ChevronRight
            size={10}
            strokeWidth={2}
            className={`shrink-0 text-black/20 dark:text-white/20 transition-transform duration-150 ease-out ${
              isExpanded && hasConversations ? "rotate-90" : ""
            } ${hasConversations ? "" : "opacity-0"}`}
          />
          <span className="truncate font-medium text-black/45 dark:text-white/45">{deriveProjectName(workspace)}</span>
        </button>

        {/* Hover-reveal actions */}
        <div className="flex items-center gap-px opacity-0 group-hover/ws:opacity-100 transition-opacity duration-100">
          <WorkspaceGroupMenu
            workspace={workspace}
            isFavorite={isFavorite}
            conversationCount={totalCount}
            onNewConversation={onNewConversation}
            onToggleFavorite={onToggleFavorite}
            onArchiveAll={onArchiveAll}
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onNewConversation(workspace)
            }}
            className="size-[22px] rounded-md flex items-center justify-center text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors duration-100"
            aria-label="New conversation"
          >
            <Plus size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Conversations */}
      {isExpanded && hasConversations && (
        <div className="pb-0.5">
          <ConversationList conversations={conversations} {...listProps} />
        </div>
      )}

      {/* Separator line */}
      <div className="mx-3 border-b border-black/[0.04] dark:border-white/[0.04]" />
    </div>
  )
}
