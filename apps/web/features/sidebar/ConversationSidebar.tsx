"use client"

import { MessageCircle, Plus, Settings } from "lucide-react"
import { useCallback, useEffect, useRef } from "react"
import { OrganizationWorkspaceSwitcher } from "@/components/workspace/OrganizationWorkspaceSwitcher"
import { WorktreeSwitcher } from "@/components/workspace/WorktreeSwitcher"
import { SettingsNav } from "@/features/settings/SettingsNav"
import { TOP_BAR_HEIGHT } from "@/lib/layout"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"
import { AccountMenu } from "./components/AccountMenu"
import { CollapsedRail } from "./components/CollapsedRail"
import { WorkspaceGroupsList } from "./components/WorkspaceGroupsList"
import { useArchiveActions } from "./hooks/useArchiveActions"
import { useConversationData } from "./hooks/useConversationData"
import { useConversationGroups } from "./hooks/useConversationGroups"
import { useStreamingConversations } from "./hooks/useStreamingConversations"
import { styles } from "./sidebar-styles"
import { useSidebarActions, useSidebarOpen } from "./sidebarStore"

interface ConversationSidebarProps {
  workspace: string | null
  worktree: string | null
  isSuperadminWorkspace: boolean
  activeTabGroupId: string | null
  onTabGroupSelect: (tabGroupId: string) => void
  onArchiveTabGroup: (tabGroupId: string) => void
  onRenameTabGroup: (tabGroupId: string, title: string) => void
  onNewConversation: () => void
  onNewConversationInWorkspace: (workspace: string) => void
  onNewWorktree: () => void
  onSelectWorktree: (worktree: string | null) => void
  worktreeModalOpen?: boolean
  onWorktreeModalOpenChange?: (open: boolean) => void
  onInvite?: () => void
  settingsMode?: boolean
  onToggleSettings: () => void
  onSettingsClick: () => void
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
  const { closeSidebar } = useSidebarActions()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const worktreeEnabled = useFeatureFlag("WORKTREES")

  // Data
  const { conversations, favorites, toggleFavoriteWorkspace, userDisplay } = useConversationData()

  // Derived state
  const { workspaceGroups, expandedWorkspaces, toggleExpanded } = useConversationGroups(
    conversations,
    favorites,
    workspace,
  )
  const streamingConversationIds = useStreamingConversations()

  // Interactions
  const { archiveConfirmingId, handleArchiveClick, handleCancelArchive, handleArchiveAllInWorkspace } =
    useArchiveActions(conversations, onArchiveTabGroup)

  // Navigation
  const handleTabGroupClick = useCallback(
    (tabGroupId: string) => {
      onTabGroupSelect(tabGroupId)
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        closeSidebar()
      }
    },
    [onTabGroupSelect, closeSidebar],
  )

  // Close on Escape — exit settings mode first, then close sidebar
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

  const hasConversations = workspaceGroups.length > 0

  // Shared sidebar content
  const renderContent = (isMobile: boolean) => (
    <div className={`flex flex-col h-full ${isMobile ? "w-screen" : "w-[260px]"}`}>
      {/* Header */}
      <SidebarHeader
        settingsMode={settingsMode}
        workspace={workspace}
        onToggleSettings={onToggleSettings}
        onSettingsClick={onSettingsClick}
        onNewConversation={onNewConversation}
        closeSidebar={closeSidebar}
      />

      {/* Middle: settings nav or conversation list */}
      {settingsMode ? (
        <SettingsNav onInvite={onInvite} />
      ) : (
        <>
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

          <div className="flex-1 overflow-y-auto py-2 flex flex-col">
            {!hasConversations ? (
              <div className="px-4 py-10 text-center text-[13px] text-black/20 dark:text-white/20">
                Start a conversation
              </div>
            ) : (
              <WorkspaceGroupsList
                workspaceGroups={workspaceGroups}
                expandedWorkspaces={expandedWorkspaces}
                activeWorkspace={workspace}
                onToggleExpanded={toggleExpanded}
                activeTabGroupId={activeTabGroupId}
                streamingConversationIds={streamingConversationIds}
                archiveConfirmingId={archiveConfirmingId}
                onTabGroupClick={handleTabGroupClick}
                onArchiveClick={handleArchiveClick}
                onCancelArchive={handleCancelArchive}
                onRenameTabGroup={onRenameTabGroup}
                onNewConversationInWorkspace={onNewConversationInWorkspace}
                onToggleFavorite={toggleFavoriteWorkspace}
                onArchiveAllInWorkspace={handleArchiveAllInWorkspace}
              />
            )}
          </div>
        </>
      )}

      {/* Bottom — user account + mobile actions */}
      <SidebarFooter
        isMobile={isMobile}
        userDisplay={userDisplay}
        onSettingsClick={onSettingsClick}
        onFeedbackClick={onFeedbackClick}
        onTemplatesClick={onTemplatesClick}
        closeSidebar={closeSidebar}
      />
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
        {isOpen ? (
          renderContent(false)
        ) : (
          <CollapsedRail
            settingsMode={settingsMode}
            onNewConversation={onNewConversation}
            onSettingsClick={onSettingsClick}
            onFeedbackClick={onFeedbackClick}
            onTemplatesClick={onTemplatesClick}
          />
        )}
      </aside>

      {/* Mobile sidebar — overlay */}
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

// =============================================================================
// Private sub-components (co-located, not worth separate files)
// =============================================================================

function SidebarHeader({
  settingsMode,
  workspace,
  onToggleSettings,
  onSettingsClick,
  onNewConversation,
  closeSidebar,
}: {
  settingsMode?: boolean
  workspace: string | null
  onToggleSettings: () => void
  onSettingsClick: () => void
  onNewConversation: () => void
  closeSidebar: () => void
}) {
  return (
    <div className="flex items-center justify-between px-3 shrink-0" style={{ height: TOP_BAR_HEIGHT }}>
      {settingsMode ? (
        <button
          type="button"
          onClick={onToggleSettings}
          className="flex items-center gap-1.5 text-[13px] font-medium text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 transition-colors"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
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
  )
}

function SidebarFooter({
  isMobile,
  userDisplay,
  onSettingsClick,
  onFeedbackClick,
  onTemplatesClick: _onTemplatesClick,
  closeSidebar,
}: {
  isMobile: boolean
  userDisplay: string | null
  onSettingsClick: () => void
  onFeedbackClick?: () => void
  onTemplatesClick?: () => void
  closeSidebar: () => void
}) {
  return (
    <div className="shrink-0">
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

      {/* Components button hidden, kept for future use */}
      {isMobile && onFeedbackClick && (
        <div className={`flex items-center gap-1 px-3 py-2 shrink-0 border-t ${styles.borderSubtle}`}>
          {[{ icon: MessageCircle, label: "Feedback", action: onFeedbackClick }].map(({ icon: Icon, label, action }) =>
            action ? (
              <button
                key={label}
                type="button"
                onClick={() => {
                  action()
                  closeSidebar()
                }}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[13px] text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-100"
              >
                <Icon size={15} strokeWidth={1.5} />
                {label}
              </button>
            ) : null,
          )}
        </div>
      )}

      {isMobile && <div className={styles.panel} style={{ height: "env(safe-area-inset-bottom, 0px)" }} />}
    </div>
  )
}
