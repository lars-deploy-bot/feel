"use client"

import { ChevronRight, Layers, MessageCircle, Plus, Settings } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { OrganizationWorkspaceSwitcher } from "@/components/workspace/OrganizationWorkspaceSwitcher"
import { WorktreeSwitcher } from "@/components/workspace/WorktreeSwitcher"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { SettingsNav } from "@/features/settings/SettingsNav"
import { deriveProjectName } from "@/features/sidebar/utils"
import { trackSidebarClosed, trackSidebarOpened } from "@/lib/analytics/events"
import { fetchConversations } from "@/lib/db/conversationSync"
import {
  useDexieAllArchivedConversations,
  useDexieAllConversations,
  useDexieMessageActions,
  useDexieSession,
} from "@/lib/db/dexieMessageStore"
import type { DbConversation } from "@/lib/db/messageDb"
import { useFavoriteWorkspaces } from "@/lib/hooks/useFavoriteWorkspaces"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { SIDEBAR_RAIL, TOP_BAR_HEIGHT } from "@/lib/layout"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"
import { useStreamingStore } from "@/lib/stores/streamingStore"
import { useTabDataStore } from "@/lib/stores/tabDataStore"
import { AccountMenu } from "./components/AccountMenu"
import { ArchivedConversationItem } from "./components/ArchivedConversationItem"
import { ConversationItem } from "./components/ConversationItem"
import { WorkspaceGroupMenu } from "./components/WorkspaceGroupMenu"
import { styles } from "./sidebar-styles"
import { useSidebarActions, useSidebarOpen } from "./sidebarStore"

interface ConversationSidebarProps {
  workspace: string | null
  worktree: string | null
  isSuperadminWorkspace: boolean
  activeTabGroupId: string | null
  onTabGroupSelect: (tabGroupId: string) => void
  onArchiveTabGroup: (tabGroupId: string) => void
  onUnarchiveTabGroup: (tabGroupId: string) => void
  onRenameTabGroup: (tabGroupId: string, title: string) => void
  onNewConversation: () => void
  onNewConversationInWorkspace: (workspace: string) => void
  onNewWorktree: () => void
  onSelectWorktree: (worktree: string | null) => void
  worktreeModalOpen?: boolean
  onWorktreeModalOpenChange?: (open: boolean) => void
  onInvite?: () => void
  /** When true, sidebar shows settings tabs instead of conversations */
  settingsMode?: boolean
  /** Toggle settings mode on/off */
  onToggleSettings: () => void
  onSettingsClick: () => void
  /** Mobile action button callbacks — desktop versions live in Nav.tsx (search: "desktop only") */
  onFeedbackClick?: () => void
  onTemplatesClick?: () => void
}

export function ConversationSidebar({
  workspace,
  worktree,
  isSuperadminWorkspace,
  activeTabGroupId,
  onTabGroupSelect,
  onArchiveTabGroup,
  onUnarchiveTabGroup,
  onRenameTabGroup,
  onNewConversation,
  onNewConversationInWorkspace,
  onNewWorktree: _onNewWorktree,
  onSelectWorktree,
  worktreeModalOpen,
  onWorktreeModalOpenChange,
  onInvite,
  settingsMode,
  onToggleSettings,
  onSettingsClick,
  onFeedbackClick,
  onTemplatesClick,
}: ConversationSidebarProps) {
  const isOpen = useSidebarOpen()
  const { closeSidebar, openSidebar } = useSidebarActions()
  const session = useDexieSession()
  const { organizations } = useOrganizations()
  const orgIds = useMemo(() => new Set(organizations.map(o => o.org_id)), [organizations])
  const conversations = useDexieAllConversations(session, orgIds)
  const archivedConversations = useDexieAllArchivedConversations(session)
  const { favorites: favoriteSet, toggle: toggleFavoriteWorkspace } = useFavoriteWorkspaces()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [archiveConfirmingId, setArchiveConfirmingId] = useState<string | null>(null)
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const didInitRef = useRef(false)
  const { user } = useAuth()
  const { setConversationFavorited } = useDexieMessageActions()
  const [dragOverZone, setDragOverZone] = useState<"favorites" | "below" | null>(null)

  // Drag-and-drop: move conversations between favorites and ungrouped
  const extractDropId = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverZone(null)
    return e.dataTransfer.getData("text/plain")
  }, [])

  const handleDropFavorites = useCallback(
    (e: React.DragEvent) => {
      const id = extractDropId(e)
      if (!id) return
      setConversationFavorited(id, true)
      const conversation = conversations.find(c => c.id === id)
      if (conversation && !favoriteSet.has(conversation.workspace)) {
        toggleFavoriteWorkspace(conversation.workspace)
      }
    },
    [extractDropId, setConversationFavorited, conversations, favoriteSet, toggleFavoriteWorkspace],
  )

  const handleDropBelow = useCallback(
    (e: React.DragEvent) => {
      const id = extractDropId(e)
      if (!id) return
      setConversationFavorited(id, false)
    },
    [extractDropId, setConversationFavorited],
  )

  const handleDragOverFavorites = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverZone("favorites")
  }, [])

  const handleDragOverBelow = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverZone("below")
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverZone(null)
  }, [])

  // Track sidebar open/close (skip initial false -> closed on mount)
  useEffect(() => {
    if (isOpen) {
      trackSidebarOpened()
    } else if (didInitRef.current) {
      trackSidebarClosed()
    }
    didInitRef.current = true
  }, [isOpen])

  // Pull conversations from server (cross-workspace) on session init
  useEffect(() => {
    if (session?.userId && session?.orgId) {
      fetchConversations(session.userId, session.orgId)
    }
  }, [session?.userId, session?.orgId])

  // Get streaming state for ALL tabs across ALL workspaces to show activity indicator
  const streamingTabs = useStreamingStore(state => state.tabs)
  const tabsByWorkspace = useTabDataStore(s => s.tabsByWorkspace)

  const streamingConversationIds = useMemo(() => {
    // Build tabId → tabGroupId map from ALL workspaces
    const tabGroupByTabId = new Map<string, string>()
    for (const tabs of Object.values(tabsByWorkspace)) {
      for (const tab of tabs) {
        tabGroupByTabId.set(tab.id, tab.tabGroupId)
      }
    }

    const activeConversations = new Set<string>()
    for (const [tabId, tabState] of Object.entries(streamingTabs)) {
      if (!tabState.isStreamActive) continue
      const tabGroupId = tabGroupByTabId.get(tabId)
      if (tabGroupId) {
        activeConversations.add(tabGroupId)
      }
    }

    return activeConversations
  }, [streamingTabs, tabsByWorkspace])

  // Favorite workspaces — explicitly marked via settings heart toggle.
  // Always visible at top, even with 0 conversations.
  const favoriteWorkspaces = useMemo(() => [...favoriteSet].sort(), [favoriteSet])

  // Split conversations: favorited → under their workspace in top section, rest → below.
  // Dexie `favorited` flag is the single owner. Workspace membership alone doesn't count.
  const { favoriteGroups, activeConversations } = useMemo(() => {
    const favByWs = new Map<string, typeof conversations>()
    const active: typeof conversations = []

    for (const ws of favoriteWorkspaces) {
      favByWs.set(ws, [])
    }

    for (const c of conversations) {
      if (c.source === "automation_run") continue

      if (c.favorited && favByWs.has(c.workspace)) {
        favByWs.get(c.workspace)!.push(c)
      } else {
        active.push(c)
      }
    }

    // All favorite workspaces show — even with 0 conversations
    const groups = favoriteWorkspaces.map(ws => ({
      workspace: ws,
      conversations: favByWs.get(ws)!,
    }))

    return { favoriteGroups: groups, activeConversations: active }
  }, [conversations, favoriteWorkspaces])

  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(() => new Set())

  // Auto-expand current workspace
  useEffect(() => {
    if (workspace) {
      setExpandedWorkspaces(prev => {
        if (prev.has(workspace)) return prev
        return new Set([...prev, workspace])
      })
    }
  }, [workspace])

  // Memoized handlers
  const handleTabGroupClick = useCallback(
    (tabGroupId: string) => {
      onTabGroupSelect(tabGroupId)
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        closeSidebar()
      }
    },
    [onTabGroupSelect, closeSidebar],
  )

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

  // Close on Escape key - exit settings mode first, then close sidebar
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (settingsMode) {
        onToggleSettings()
      } else {
        closeSidebar()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, closeSidebar, settingsMode, onToggleSettings])

  const worktreeEnabled = useFeatureFlag("WORKTREES")

  // User display: email prefix or name
  const userDisplay = user?.firstName || user?.name || user?.email?.split("@")[0] || null

  // Shared sidebar content
  const renderContent = (isMobile: boolean) => (
    <div className={`flex flex-col h-full ${isMobile ? "w-screen" : "w-[260px]"}`}>
      {/* Header — height shared with tab bar and workbench view switcher */}
      <div className="flex items-center justify-between px-3 shrink-0" style={{ height: TOP_BAR_HEIGHT }}>
        {settingsMode ? (
          <button
            type="button"
            onClick={onToggleSettings}
            className="flex items-center gap-1.5 text-[13px] font-medium text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 transition-colors"
          >
            <ChevronRight size={12} strokeWidth={2} className="rotate-180" />
            <span>Settings</span>
          </button>
        ) : (
          <OrganizationWorkspaceSwitcher workspace={workspace} compact orgOnly />
        )}
        <div className="flex items-center gap-0.5">
          {!settingsMode && (
            <>
              <button
                type="button"
                onClick={onSettingsClick}
                className="inline-flex items-center justify-center size-7 rounded-lg text-black/30 dark:text-white/30 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-100"
                aria-label="Settings"
              >
                <Settings size={16} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={onNewConversation}
                className="inline-flex items-center justify-center size-7 rounded-lg text-black/30 dark:text-white/30 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-100"
                aria-label="New chat"
              >
                <Plus size={16} strokeWidth={1.5} />
              </button>
            </>
          )}
          {!settingsMode && (
            <button
              type="button"
              onClick={closeSidebar}
              className="inline-flex items-center justify-center size-7 rounded-lg text-black/30 dark:text-white/30 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-100"
              aria-label="Close sidebar"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
                <line x1="5.5" y1="2.5" x2="5.5" y2="13.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Middle section: settings nav or conversation list */}
      {settingsMode ? (
        <SettingsNav onInvite={onInvite} />
      ) : (
        <>
          {/* Worktree switcher */}
          {worktreeEnabled && !isSuperadminWorkspace && (
            <div className="px-3 py-2 shrink-0">
              <WorktreeSwitcher
                workspace={workspace}
                currentWorktree={worktree}
                onChange={onSelectWorktree}
                isOpen={worktreeModalOpen}
                onOpenChange={onWorktreeModalOpenChange}
              />
            </div>
          )}

          {/* Conversation list — scrollable middle */}
          <div className="flex-1 overflow-y-auto py-1 flex flex-col">
            {conversations.length === 0 && archivedConversations.length === 0 && favoriteGroups.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-black/25 dark:text-white/25">
                Start typing to begin
              </div>
            ) : (
              <>
                {/* Favorites drop zone — always visible so you can drag here even when empty */}
                <ul
                  className={`flex flex-col gap-2 pb-1 min-h-[40px] rounded-lg transition-colors duration-150 list-none p-0 m-0 ${
                    dragOverZone === "favorites" ? "bg-black/[0.03] dark:bg-white/[0.03]" : ""
                  }`}
                  onDrop={handleDropFavorites}
                  onDragOver={handleDragOverFavorites}
                  onDragLeave={handleDragLeave}
                >
                  {favoriteGroups.map(({ workspace: ws, conversations: wsConversations }) => {
                    const isExpanded = expandedWorkspaces.has(ws)
                    return (
                      <div key={ws} className="group/ws">
                        <div className="flex items-center mx-2 rounded-lg hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors duration-100">
                          {wsConversations.length > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedWorkspaces(prev => {
                                  const next = new Set(prev)
                                  if (next.has(ws)) next.delete(ws)
                                  else next.add(ws)
                                  return next
                                })
                              }
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
                              onRemoveFavorite={toggleFavoriteWorkspace}
                              onArchiveAll={handleArchiveAllInWorkspace}
                              onManageFavorites={onSettingsClick}
                            />
                          </div>
                        </div>
                        {isExpanded && wsConversations.length > 0 && (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            {wsConversations.map(conversation => (
                              <ConversationItem
                                key={conversation.id}
                                conversation={conversation}
                                isActive={conversation.id === activeTabGroupId}
                                isStreaming={streamingConversationIds.has(conversation.id)}
                                isConfirming={archiveConfirmingId === conversation.id}
                                onClick={() => handleTabGroupClick(conversation.id)}
                                onArchive={handleArchiveClick}
                                onCancelArchive={handleCancelArchive}
                                onRename={(id, title) => onRenameTabGroup(id, title)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </ul>

                {/* Divider + new conversation button */}
                <div className="mx-4 my-2 border-t border-black/[0.06] dark:border-white/[0.06]" />
                <button
                  type="button"
                  onClick={onNewConversation}
                  className="flex items-center gap-2.5 px-4 py-2.5 mx-2 rounded-lg text-[13px] text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all duration-100"
                >
                  <Plus size={14} strokeWidth={1.75} className="shrink-0" />
                  <span>New conversation</span>
                </button>

                {/* All non-favorited conversations — drop here to unfavorite */}
                <ul
                  className={`flex flex-col gap-0.5 mt-2 min-h-[40px] rounded-lg transition-colors duration-150 list-none p-0 m-0 ${
                    dragOverZone === "below" ? "bg-black/[0.03] dark:bg-white/[0.03]" : ""
                  }`}
                  onDrop={handleDropBelow}
                  onDragOver={handleDragOverBelow}
                  onDragLeave={handleDragLeave}
                >
                  {activeConversations.map(conversation => (
                    <ConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={conversation.id === activeTabGroupId}
                      isStreaming={streamingConversationIds.has(conversation.id)}
                      isConfirming={archiveConfirmingId === conversation.id}
                      onClick={() => handleTabGroupClick(conversation.id)}
                      onArchive={handleArchiveClick}
                      onCancelArchive={handleCancelArchive}
                      onRename={(id, title) => onRenameTabGroup(id, title)}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Archived — collapsible, pinned above bottom */}
          {archivedConversations.length > 0 && (
            <div className="shrink-0 border-t border-black/[0.04] dark:border-white/[0.04] py-1">
              <button
                type="button"
                onClick={() => setArchivedExpanded(prev => !prev)}
                className="flex items-center gap-2 px-3 py-2 mx-2 rounded-lg w-[calc(100%-16px)] text-[13px] text-black/30 dark:text-white/30 hover:bg-black/[0.025] dark:hover:bg-white/[0.025] transition-colors duration-100"
              >
                <ChevronRight
                  size={11}
                  strokeWidth={2}
                  className={`shrink-0 transition-transform duration-200 ease-out ${archivedExpanded ? "rotate-90" : ""}`}
                />
                <span className="truncate">Archived</span>
                <span className="text-[11px] text-black/20 dark:text-white/20 shrink-0 tabular-nums">
                  {archivedConversations.length}
                </span>
              </button>
              {archivedExpanded && (
                <div className="max-h-40 overflow-y-auto pb-1">
                  {archivedConversations.map(conversation => (
                    <ArchivedConversationItem
                      key={conversation.id}
                      conversation={conversation}
                      onOpen={() => {
                        onUnarchiveTabGroup(conversation.id)
                        handleTabGroupClick(conversation.id)
                      }}
                      onRestore={() => onUnarchiveTabGroup(conversation.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Bottom — always visible: user account + mobile actions */}
      <div className="shrink-0">
        {/* User account — always at bottom */}
        {userDisplay && (
          <div className="border-t border-black/[0.04] dark:border-white/[0.04]">
            <AccountMenu
              onSettingsClick={onSettingsClick}
              onFeedbackClick={onFeedbackClick}
              inline
              userDisplay={userDisplay}
            />
          </div>
        )}

        {/* Mobile action buttons */}
        {isMobile && (
          <div className={`flex items-center gap-1 px-3 py-2 shrink-0 border-t ${styles.borderSubtle}`}>
            {(
              [
                { icon: MessageCircle, label: "Feedback", action: onFeedbackClick },
                { icon: Layers, label: "Components", action: onTemplatesClick },
              ] as const
            ).map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  action?.()
                  closeSidebar()
                }}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[13px] text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-100"
              >
                <Icon size={15} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* iOS 26 Liquid Glass: extend background into bottom safe area */}
        {isMobile && <div className={styles.panel} style={{ height: "env(safe-area-inset-bottom, 0px)" }} />}
      </div>
    </div>
  )

  // Collapsed rail — narrow icon strip visible when sidebar is closed (desktop only)
  const railIconClass =
    "inline-flex items-center justify-center rounded-lg text-black/30 dark:text-white/30 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-100"
  const railIconStyle = { width: SIDEBAR_RAIL.iconSize, height: SIDEBAR_RAIL.iconSize }

  const renderCollapsedRail = () => (
    <div
      className="flex flex-col items-center h-full"
      style={{ padding: `${SIDEBAR_RAIL.paddingY}px 0`, gap: `${SIDEBAR_RAIL.gap}px` }}
    >
      {/* Expand sidebar */}
      <button
        type="button"
        onClick={openSidebar}
        className={railIconClass}
        style={railIconStyle}
        aria-label="Open sidebar"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
          <line x1="5.5" y1="2.5" x2="5.5" y2="13.5" />
        </svg>
      </button>

      {/* New conversation */}
      <button
        type="button"
        onClick={onNewConversation}
        className={railIconClass}
        style={railIconStyle}
        aria-label="New chat"
      >
        <Plus size={16} strokeWidth={1.5} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <button
        type="button"
        onClick={onTemplatesClick}
        className={railIconClass}
        style={railIconStyle}
        aria-label="Components"
      >
        <Layers size={16} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onFeedbackClick}
        className={railIconClass}
        style={railIconStyle}
        aria-label="Feedback"
      >
        <MessageCircle size={16} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onSettingsClick}
        className={`inline-flex items-center justify-center rounded-lg active:scale-95 transition-all duration-100 ${
          settingsMode
            ? "text-black dark:text-white bg-black/[0.08] dark:bg-white/[0.08]"
            : "text-black/30 dark:text-white/30 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
        }`}
        style={railIconStyle}
        aria-label="Settings"
      >
        <Settings size={16} strokeWidth={1.5} />
      </button>

      {/* Account menu — avatar with dropdown */}
      <AccountMenu onSettingsClick={onSettingsClick} onFeedbackClick={onFeedbackClick} />
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        ref={sidebarRef}
        suppressHydrationWarning={true}
        className={`hidden md:flex flex-col h-full ${styles.panel} border-r ${styles.border} ${styles.transitionAll} overflow-hidden ${
          isOpen ? "w-[260px]" : "w-[50px]"
        }`}
        aria-label="Conversation history"
      >
        {isOpen ? renderContent(false) : renderCollapsedRail()}
      </aside>

      {/* Mobile sidebar - overlay */}
      {isOpen && (
        <>
          <div
            className={`md:hidden fixed inset-0 ${styles.backdrop} z-50`}
            onClick={closeSidebar}
            aria-hidden="true"
          />
          <aside
            className={`md:hidden fixed inset-y-0 left-0 ${styles.panel} z-50 flex flex-col shadow-xl`}
            aria-label="Conversation history"
          >
            {renderContent(true)}
          </aside>
        </>
      )}
    </>
  )
}
