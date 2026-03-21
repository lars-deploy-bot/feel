"use client"

import { ChevronRight } from "lucide-react"
import type { WorkspaceGroup } from "../types"
import { deriveProjectName } from "../utils"
import type { ConversationListProps } from "./ConversationList"
import { ConversationList } from "./ConversationList"
import { WorkspaceGroupMenu } from "./WorkspaceGroupMenu"

interface WorkspaceGroupsListProps extends Omit<ConversationListProps, "conversations"> {
  workspaceGroups: WorkspaceGroup[]
  expandedWorkspaces: ReadonlySet<string>
  onToggleExpanded: (ws: string) => void
  onNewConversationInWorkspace: (workspace: string) => void
  onToggleFavorite: (workspace: string) => void
  onArchiveAllInWorkspace: (workspace: string) => void
}

export function WorkspaceGroupsList({
  workspaceGroups,
  expandedWorkspaces,
  onToggleExpanded,
  onNewConversationInWorkspace,
  onToggleFavorite,
  onArchiveAllInWorkspace,
  ...listProps
}: WorkspaceGroupsListProps) {
  const firstNonFavIndex = workspaceGroups.findIndex(g => !g.isFavorite)
  const hasFavorites = firstNonFavIndex > 0

  return (
    <div className="flex flex-col gap-0.5">
      {hasFavorites && <SectionLabel>Favorites</SectionLabel>}

      {workspaceGroups.map(({ workspace: ws, isFavorite, conversations: wsConversations }, i) => (
        <div key={ws}>
          {hasFavorites && i === firstNonFavIndex && <SectionLabel className="pt-3">Other</SectionLabel>}
          <WorkspaceGroupRow
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
        </div>
      ))}
    </div>
  )
}

// ── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`px-4 pt-1 pb-1.5 text-[11px] font-medium tracking-wider uppercase text-black/25 dark:text-white/25 ${className}`}
    >
      {children}
    </div>
  )
}

// ── Workspace group row (component so we can call useFavicon) ────────────────

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

  return (
    <div className="group/ws">
      <div className="flex items-center mx-1.5 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors duration-100">
        {totalCount > 0 ? (
          <button
            type="button"
            onClick={() => onToggleExpanded(workspace)}
            className="flex-1 flex items-center gap-2 px-2.5 h-8 text-[13px] text-black/45 dark:text-white/45 min-w-0"
          >
            <ChevronRight
              size={12}
              strokeWidth={1.75}
              className={`shrink-0 text-black/20 dark:text-white/20 transition-transform duration-150 ease-out ${isExpanded ? "rotate-90" : ""}`}
            />
            <WorkspaceInitial workspace={workspace} />
            <span className="truncate font-medium">{deriveProjectName(workspace)}</span>
            <span className="text-[11px] text-black/15 dark:text-white/15 shrink-0 tabular-nums">{totalCount}</span>
          </button>
        ) : (
          <div className="flex-1 flex items-center gap-2 px-2.5 h-8 text-[13px] text-black/45 dark:text-white/45 min-w-0">
            <span className="shrink-0 w-3" />
            <WorkspaceInitial workspace={workspace} />
            <span className="truncate font-medium">{deriveProjectName(workspace)}</span>
          </div>
        )}
        <div className="pr-2">
          <WorkspaceGroupMenu
            workspace={workspace}
            isFavorite={isFavorite}
            conversationCount={totalCount}
            onNewConversation={onNewConversation}
            onToggleFavorite={onToggleFavorite}
            onArchiveAll={onArchiveAll}
          />
        </div>
      </div>

      {isExpanded && totalCount > 0 && <ConversationList conversations={conversations} {...listProps} />}
    </div>
  )
}

function WorkspaceInitial({ workspace }: { workspace: string }) {
  return (
    <span className="size-4 shrink-0 rounded bg-black/10 dark:bg-white/10 flex items-center justify-center text-[9px] font-bold text-black/50 dark:text-white/50 leading-none">
      {workspace.charAt(0).toUpperCase()}
    </span>
  )
}
