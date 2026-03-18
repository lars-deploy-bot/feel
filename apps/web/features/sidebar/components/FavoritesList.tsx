"use client"

import { ChevronRight } from "lucide-react"
import type { WorkspaceGroup } from "../types"
import { deriveProjectName } from "../utils"
import type { ConversationListProps } from "./ConversationList"
import { ConversationList } from "./ConversationList"
import { WorkspaceGroupMenu } from "./WorkspaceGroupMenu"

interface FavoritesListProps extends Omit<ConversationListProps, "conversations"> {
  favoriteGroups: WorkspaceGroup[]
  expandedWorkspaces: ReadonlySet<string>
  onToggleExpanded: (ws: string) => void
  onNewConversationInWorkspace: (workspace: string) => void
  onRemoveFavorite: (workspace: string) => void
  onArchiveAllInWorkspace: (workspace: string) => void
  onManageFavorites: () => void
  dragOverZone: "favorites" | "below" | null
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
}

export function FavoritesList({
  favoriteGroups,
  expandedWorkspaces,
  onToggleExpanded,
  onNewConversationInWorkspace,
  onRemoveFavorite,
  onArchiveAllInWorkspace,
  onManageFavorites,
  dragOverZone,
  onDrop,
  onDragOver,
  onDragLeave,
  // ConversationList props — forwarded to each group's list
  ...listProps
}: FavoritesListProps) {
  return (
    <ul
      className={`flex flex-col gap-2 pb-1 min-h-[40px] max-h-[40vh] overflow-y-auto shrink-0 rounded-lg transition-colors duration-150 list-none p-0 m-0 ${
        dragOverZone === "favorites" ? "bg-black/[0.03] dark:bg-white/[0.03]" : ""
      }`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {favoriteGroups.map(({ workspace: ws, conversations: wsConversations }) => {
        const isExpanded = expandedWorkspaces.has(ws)
        return (
          <div key={ws} className="group/ws">
            <div className="flex items-center mx-2 rounded-lg hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors duration-100">
              {wsConversations.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onToggleExpanded(ws)}
                  className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-black/40 dark:text-white/40 min-w-0"
                >
                  <ChevronRight
                    size={11}
                    strokeWidth={2}
                    className={`shrink-0 transition-transform duration-200 ease-out ${isExpanded ? "rotate-90" : ""}`}
                  />
                  <span className="truncate font-medium">{deriveProjectName(ws)}</span>
                  <span className="text-[11px] text-black/20 dark:text-white/20 shrink-0 tabular-nums">
                    {wsConversations.length}
                  </span>
                </button>
              ) : (
                <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-black/40 dark:text-white/40 min-w-0">
                  <span className="shrink-0" style={{ width: 11 }} />
                  <span className="truncate font-medium">{deriveProjectName(ws)}</span>
                </div>
              )}
              <div className="pr-2.5">
                <WorkspaceGroupMenu
                  workspace={ws}
                  conversationCount={wsConversations.length}
                  onNewConversation={onNewConversationInWorkspace}
                  onRemoveFavorite={onRemoveFavorite}
                  onArchiveAll={onArchiveAllInWorkspace}
                  onManageFavorites={onManageFavorites}
                />
              </div>
            </div>
            {isExpanded && wsConversations.length > 0 && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                <ConversationList conversations={wsConversations} {...listProps} />
              </div>
            )}
          </div>
        )
      })}
    </ul>
  )
}
