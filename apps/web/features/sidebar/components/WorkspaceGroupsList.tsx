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
  onArchiveAllInWorkspace: (workspace: string) => Promise<void>
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
  return (
    <div className="flex flex-col">
      {workspaceGroups.map(({ workspace: ws, isFavorite, conversations: wsConversations }) => (
        <WorkspaceGroupRow
          key={ws}
          workspace={ws}
          isFavorite={isFavorite}
          isActive={ws === activeWorkspace}
          conversations={wsConversations}
          isExpanded={ws === activeWorkspace || expandedWorkspaces.has(ws)}
          onToggleExpanded={onToggleExpanded}
          onNewConversation={onNewConversationInWorkspace}
          onToggleFavorite={onToggleFavorite}
          onArchiveAll={onArchiveAllInWorkspace}
          listProps={listProps}
        />
      ))}
    </div>
  )
}

// ── Workspace group row ──────────────────────────────────────────────────────

function WorkspaceGroupRow({
  workspace,
  isFavorite,
  isActive,
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
  isActive: boolean
  conversations: WorkspaceGroup["conversations"]
  isExpanded: boolean
  onToggleExpanded: (ws: string) => void
  onNewConversation: (ws: string) => void
  onToggleFavorite: (ws: string) => void
  onArchiveAll: (ws: string) => Promise<void>
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
          <span
            className={`truncate font-medium ${isActive ? "text-black/70 dark:text-white/70" : "text-black/45 dark:text-white/45"}`}
          >
            {deriveProjectName(workspace)}
          </span>
        </button>

        {/* Hover-reveal actions */}
        <div className="flex items-center gap-px opacity-0 pointer-events-none group-hover/ws:opacity-100 group-hover/ws:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity duration-100">
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
