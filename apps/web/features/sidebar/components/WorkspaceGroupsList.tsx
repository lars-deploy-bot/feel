"use client"

import { ArchiveRestore, ChevronRight, Star } from "lucide-react"
import { useState } from "react"
import type { DbConversation } from "@/lib/db/messageDb"
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
  onUnarchiveTabGroup: (tabGroupId: string) => void
}

export function WorkspaceGroupsList({
  workspaceGroups,
  expandedWorkspaces,
  onToggleExpanded,
  onNewConversationInWorkspace,
  onToggleFavorite,
  onArchiveAllInWorkspace,
  onUnarchiveTabGroup,
  ...listProps
}: WorkspaceGroupsListProps) {
  const [expandedArchived, setExpandedArchived] = useState<Set<string>>(() => new Set())

  const toggleArchived = (ws: string) => {
    setExpandedArchived(prev => {
      const next = new Set(prev)
      if (next.has(ws)) next.delete(ws)
      else next.add(ws)
      return next
    })
  }

  // Find divider position between favorite and non-favorite groups
  const firstNonFavIndex = workspaceGroups.findIndex(g => !g.isFavorite)
  const hasBothSections = firstNonFavIndex > 0

  return (
    <div className="flex flex-col gap-1">
      {workspaceGroups.map(
        ({ workspace: ws, isFavorite, conversations: wsConversations, archivedConversations }, i) => {
          const isExpanded = expandedWorkspaces.has(ws)
          const totalCount = wsConversations.length
          const showDivider = hasBothSections && i === firstNonFavIndex

          return (
            <div key={ws}>
              {showDivider && <div className="mx-4 my-1.5 border-t border-black/[0.06] dark:border-white/[0.06]" />}
              <div className="group/ws">
                {/* Workspace header */}
                <div className="flex items-center mx-2 rounded-lg hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors duration-100">
                  {totalCount > 0 ? (
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
                      {isFavorite && (
                        <Star
                          size={10}
                          strokeWidth={2}
                          className="shrink-0 text-black/15 dark:text-white/15 fill-current"
                        />
                      )}
                      <span className="truncate font-medium">{deriveProjectName(ws)}</span>
                      <span className="text-[11px] text-black/20 dark:text-white/20 shrink-0 tabular-nums">
                        {totalCount}
                      </span>
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-black/40 dark:text-white/40 min-w-0">
                      <span className="shrink-0" style={{ width: 11 }} />
                      {isFavorite && (
                        <Star
                          size={10}
                          strokeWidth={2}
                          className="shrink-0 text-black/15 dark:text-white/15 fill-current"
                        />
                      )}
                      <span className="truncate font-medium">{deriveProjectName(ws)}</span>
                    </div>
                  )}
                  <div className="pr-2.5">
                    <WorkspaceGroupMenu
                      workspace={ws}
                      isFavorite={isFavorite}
                      conversationCount={totalCount}
                      onNewConversation={onNewConversationInWorkspace}
                      onToggleFavorite={onToggleFavorite}
                      onArchiveAll={onArchiveAllInWorkspace}
                    />
                  </div>
                </div>

                {/* Expanded content: active conversations + inline archived */}
                {isExpanded && totalCount > 0 && (
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <ConversationList conversations={wsConversations} {...listProps} />

                    {/* Inline archived sub-section (only for favorite workspaces) */}
                    {isFavorite && archivedConversations.length > 0 && (
                      <InlineArchivedSection
                        archivedConversations={archivedConversations}
                        isExpanded={expandedArchived.has(ws)}
                        onToggle={() => toggleArchived(ws)}
                        onRestore={onUnarchiveTabGroup}
                        onOpen={id => {
                          onUnarchiveTabGroup(id)
                          listProps.onTabGroupClick(id)
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Show archived toggle even when no active conversations (favorite workspaces only) */}
                {isExpanded && totalCount === 0 && isFavorite && archivedConversations.length > 0 && (
                  <div className="mt-0.5">
                    <InlineArchivedSection
                      archivedConversations={archivedConversations}
                      isExpanded={expandedArchived.has(ws)}
                      onToggle={() => toggleArchived(ws)}
                      onRestore={onUnarchiveTabGroup}
                      onOpen={id => {
                        onUnarchiveTabGroup(id)
                        listProps.onTabGroupClick(id)
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        },
      )}
    </div>
  )
}

/** Small collapsible archived section within a workspace group */
function InlineArchivedSection({
  archivedConversations,
  isExpanded,
  onToggle,
  onRestore,
  onOpen,
}: {
  archivedConversations: DbConversation[]
  isExpanded: boolean
  onToggle: () => void
  onRestore: (id: string) => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="ml-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-1.5 mx-2 rounded-lg w-[calc(100%-16px)] text-[11px] text-black/25 dark:text-white/25 hover:text-black/35 dark:hover:text-white/35 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-100"
      >
        <ChevronRight
          size={9}
          strokeWidth={2}
          className={`shrink-0 transition-transform duration-200 ease-out ${isExpanded ? "rotate-90" : ""}`}
        />
        <span>Archived</span>
        <span className="tabular-nums">{archivedConversations.length}</span>
      </button>

      {isExpanded && (
        <div className="pb-1">
          {archivedConversations.map(conversation => (
            <div key={conversation.id} className="group">
              <button
                type="button"
                onClick={() => onOpen(conversation.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 mx-2 rounded-lg cursor-pointer hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors duration-100"
                style={{ width: "calc(100% - 16px)" }}
              >
                <span className="flex-1 min-w-0 text-[12px] text-black/25 dark:text-white/25 truncate text-left">
                  {conversation.title}
                </span>
                {/* biome-ignore lint/a11y/useSemanticElements: Nested buttons are invalid HTML */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => {
                    e.stopPropagation()
                    onRestore(conversation.id)
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      e.stopPropagation()
                      onRestore(conversation.id)
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 size-5 rounded-lg flex items-center justify-center text-black/20 dark:text-white/20 hover:text-black/40 dark:hover:text-white/40 transition-colors duration-100 active:scale-90 shrink-0"
                  aria-label="Restore"
                >
                  <ArchiveRestore size={11} strokeWidth={1.75} />
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
