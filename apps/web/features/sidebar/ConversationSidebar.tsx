"use client"

import { Bot, ChevronRight, Layers, MessageCircle, Plus, Settings } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { OrganizationWorkspaceSwitcher } from "@/components/workspace/OrganizationWorkspaceSwitcher"
import { WorktreeSwitcher } from "@/components/workspace/WorktreeSwitcher"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { SettingsNav } from "@/features/settings/SettingsNav"
import { trackSidebarClosed, trackSidebarOpened } from "@/lib/analytics/events"
import { SIDEBAR_RAIL } from "@/lib/layout"
import { useDexieArchivedConversations, useDexieConversations, useDexieSession } from "@/lib/db/dexieMessageStore"
import type { DbConversation } from "@/lib/db/messageDb"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"
import { useStreamingStore } from "@/lib/stores/streamingStore"
import { useWorkspaceTabs } from "@/lib/stores/tabStore"
import { AccountMenu } from "./components/AccountMenu"
import { ArchivedConversationItem } from "./components/ArchivedConversationItem"
import { ConversationItem } from "./components/ConversationItem"
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
  const allConversations = useDexieConversations(workspace || "", session)
  const conversations = workspace ? allConversations : []
  const archivedConversations = useDexieArchivedConversations(workspace || "", session)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [archiveConfirmingId, setArchiveConfirmingId] = useState<string | null>(null)
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const [agentsExpanded, setAgentsExpanded] = useState(false)
  const didInitRef = useRef(false)
  const { user } = useAuth()

  // Track sidebar open/close (skip initial false -> closed on mount)
  useEffect(() => {
    if (isOpen) {
      trackSidebarOpened()
    } else if (didInitRef.current) {
      trackSidebarClosed()
    }
    didInitRef.current = true
  }, [isOpen])

  // Get streaming state for all tabs to show activity indicator
  const streamingTabs = useStreamingStore(state => state.tabs)
  const workspaceTabs = useWorkspaceTabs(workspace)

  const streamingConversationIds = useMemo(() => {
    const tabGroupByTabId = new Map(workspaceTabs.map(tab => [tab.id, tab.tabGroupId]))
    const activeConversations = new Set<string>()

    for (const [tabId, tabState] of Object.entries(streamingTabs)) {
      if (!tabState.isStreamActive) continue
      const tabGroupId = tabGroupByTabId.get(tabId)
      if (tabGroupId) {
        activeConversations.add(tabGroupId)
      }
    }

    return activeConversations
  }, [streamingTabs, workspaceTabs])

  const MAX_VISIBLE_CONVERSATIONS = 5

  // Split conversations into user chats vs agent runs, and cap visible user chats
  const { recentConversations, olderConversations, agentConversations } = useMemo(() => {
    const user: typeof conversations = []
    const agent: typeof conversations = []
    for (const c of conversations) {
      if (c.source === "automation_run") {
        agent.push(c)
      } else {
        user.push(c)
      }
    }
    return {
      recentConversations: user.slice(0, MAX_VISIBLE_CONVERSATIONS),
      olderConversations: user.slice(MAX_VISIBLE_CONVERSATIONS),
      agentConversations: agent,
    }
  }, [conversations])
  const [olderExpanded, setOlderExpanded] = useState(false)

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

  const isConversationStreaming = useCallback(
    (conversationId: string) => {
      return streamingConversationIds.has(conversationId)
    },
    [streamingConversationIds],
  )

  const worktreeEnabled = useFeatureFlag("WORKTREES")

  // User display: email prefix or name
  const userDisplay = user?.firstName || user?.name || user?.email?.split("@")[0] || null

  // Shared sidebar content
  const renderContent = (isMobile: boolean) => (
    <div className={`flex flex-col h-full ${isMobile ? "w-screen" : "w-[260px]"}`}>
      {/* Header — aligned with collapsed rail via shared SIDEBAR_RAIL constants */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={{ height: SIDEBAR_RAIL.paddingY * 2 + SIDEBAR_RAIL.iconSize }}
      >
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
          {!settingsMode && <button
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
          </button>}
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
          <div className="flex-1 overflow-y-auto py-1 flex flex-col gap-0.5">
            {conversations.length === 0 && archivedConversations.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-[#b5afa3] dark:text-[#5c574d]">
                Start typing to begin
              </div>
            ) : (
              <>
                {/* Recent user conversations */}
                {recentConversations.map(conversation => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeTabGroupId}
                    isStreaming={isConversationStreaming(conversation.id)}
                    isConfirming={archiveConfirmingId === conversation.id}
                    onClick={() => handleTabGroupClick(conversation.id)}
                    onArchive={handleArchiveClick}
                    onCancelArchive={handleCancelArchive}
                    onRename={(id, title) => onRenameTabGroup(id, title)}
                  />
                ))}

                {/* Older user conversations — collapsible */}
                {olderConversations.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setOlderExpanded(prev => !prev)}
                      className="flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg w-[calc(100%-16px)] text-[13px] text-[#8a8578] dark:text-[#7a756b] hover:bg-[#4a7c59]/[0.05] dark:hover:bg-[#7cb88a]/[0.05] transition-all duration-150 ease-out"
                    >
                      <ChevronRight
                        size={12}
                        strokeWidth={2}
                        className={`shrink-0 transition-transform duration-200 ease-out ${olderExpanded ? "rotate-90" : ""}`}
                      />
                      <span className="truncate">Older</span>
                      <span className="text-[11px] text-[#b5afa3] dark:text-[#5c574d] shrink-0 tabular-nums">{olderConversations.length}</span>
                    </button>
                    {olderExpanded &&
                      olderConversations.map(conversation => (
                        <ConversationItem
                          key={conversation.id}
                          conversation={conversation}
                          isActive={conversation.id === activeTabGroupId}
                          isStreaming={isConversationStreaming(conversation.id)}
                          isConfirming={archiveConfirmingId === conversation.id}
                          onClick={() => handleTabGroupClick(conversation.id)}
                          onArchive={handleArchiveClick}
                          onCancelArchive={handleCancelArchive}
                          onRename={(id, title) => onRenameTabGroup(id, title)}
                        />
                      ))}
                  </div>
                )}

                {/* Agent conversations — collapsible */}
                {agentConversations.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setAgentsExpanded(prev => !prev)}
                      className="flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg w-[calc(100%-16px)] text-[13px] text-[#8a8578] dark:text-[#7a756b] hover:bg-[#4a7c59]/[0.05] dark:hover:bg-[#7cb88a]/[0.05] transition-all duration-150 ease-out"
                    >
                      <ChevronRight
                        size={12}
                        strokeWidth={2}
                        className={`shrink-0 transition-transform duration-200 ease-out ${agentsExpanded ? "rotate-90" : ""}`}
                      />
                      <Bot size={13} strokeWidth={1.75} className="shrink-0" />
                      <span className="truncate">Agents</span>
                      <span className="text-[11px] text-[#b5afa3] dark:text-[#5c574d] shrink-0 tabular-nums">{agentConversations.length}</span>
                    </button>
                    {agentsExpanded &&
                      agentConversations.map(conversation => (
                        <ConversationItem
                          key={conversation.id}
                          conversation={conversation}
                          isActive={conversation.id === activeTabGroupId}
                          isStreaming={isConversationStreaming(conversation.id)}
                          isConfirming={archiveConfirmingId === conversation.id}
                          onClick={() => handleTabGroupClick(conversation.id)}
                          onArchive={handleArchiveClick}
                          onCancelArchive={handleCancelArchive}
                          onRename={(id, title) => onRenameTabGroup(id, title)}
                        />
                      ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Archived — collapsible, pinned above bottom */}
          {archivedConversations.length > 0 && (
            <div className="shrink-0 border-t border-[#4a7c59]/[0.06] dark:border-[#7cb88a]/[0.04] py-1">
              <button
                type="button"
                onClick={() => setArchivedExpanded(prev => !prev)}
                className="flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg w-[calc(100%-16px)] text-[13px] text-[#8a8578] dark:text-[#7a756b] hover:bg-[#4a7c59]/[0.05] dark:hover:bg-[#7cb88a]/[0.05] transition-all duration-150 ease-out"
              >
                <ChevronRight
                  size={12}
                  strokeWidth={2}
                  className={`shrink-0 transition-transform duration-200 ease-out ${archivedExpanded ? "rotate-90" : ""}`}
                />
                <span className="truncate">Archived</span>
                <span className="text-[11px] text-[#b5afa3] dark:text-[#5c574d] shrink-0 tabular-nums">{archivedConversations.length}</span>
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
            <AccountMenu onSettingsClick={onSettingsClick} onFeedbackClick={onFeedbackClick} inline userDisplay={userDisplay} />
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
        className={railIconClass} style={railIconStyle}
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
        className={railIconClass} style={railIconStyle}
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
        className={railIconClass} style={railIconStyle}
        aria-label="Components"
      >
        <Layers size={16} strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={onFeedbackClick}
        className={railIconClass} style={railIconStyle}
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
