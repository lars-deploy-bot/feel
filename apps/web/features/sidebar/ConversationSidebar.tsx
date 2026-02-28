"use client"

import { ChevronRight, Image, Layers, MessageCircle, Settings } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { OrganizationWorkspaceSwitcher } from "@/components/workspace/OrganizationWorkspaceSwitcher"
import { WorktreeSwitcher } from "@/components/workspace/WorktreeSwitcher"
import { SettingsNav } from "@/features/settings/SettingsNav"
import { trackSettingsClicked, trackSidebarClosed, trackSidebarOpened } from "@/lib/analytics/events"
import { useDexieArchivedConversations, useDexieConversations, useDexieSession } from "@/lib/db/dexieMessageStore"
import type { DbConversation } from "@/lib/db/messageDb"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"
import { useStreamingStore } from "@/lib/stores/streamingStore"
import { useWorkspaceTabs } from "@/lib/stores/tabStore"
import { ArchivedConversationItem } from "./components/ArchivedConversationItem"
import { ConversationItem } from "./components/ConversationItem"
import { EmptyState } from "./components/EmptyState"
import { NewChatDropdown } from "./components/NewChatDropdown"
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
  /** Mobile action button callbacks — desktop versions live in Nav.tsx (search: "desktop only") */
  onFeedbackClick?: () => void
  onTemplatesClick?: () => void
  onPhotosClick?: () => void
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
  onNewWorktree,
  onSelectWorktree,
  worktreeModalOpen,
  onWorktreeModalOpenChange,
  onInvite,
  settingsMode,
  onToggleSettings,
  onFeedbackClick,
  onTemplatesClick,
  onPhotosClick,
}: ConversationSidebarProps) {
  const isOpen = useSidebarOpen()
  const { closeSidebar } = useSidebarActions()
  const session = useDexieSession()
  const allConversations = useDexieConversations(workspace || "", session)
  const conversations = workspace ? allConversations : []
  const archivedConversations = useDexieArchivedConversations(workspace || "", session)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [archiveConfirmingId, setArchiveConfirmingId] = useState<string | null>(null)
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const didInitRef = useRef(false)

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

  // Memoized handlers
  const handleTabGroupClick = useCallback(
    (tabGroupId: string) => {
      onTabGroupSelect(tabGroupId)
      // Close sidebar on mobile after selection
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
        // Second click: confirm and archive
        onArchiveTabGroup(conversation.id)
        setArchiveConfirmingId(null)
      } else {
        // First click: enter confirming state
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

  // Check if any tab in a conversation is streaming
  const isConversationStreaming = useCallback(
    (conversationId: string) => {
      return streamingConversationIds.has(conversationId)
    },
    [streamingConversationIds],
  )

  const worktreeEnabled = useFeatureFlag("WORKTREES")

  // Shared sidebar content - rendered in both desktop and mobile
  const renderContent = (isMobile: boolean) => (
    <div className={`flex flex-col h-full ${isMobile ? "w-screen" : "w-[280px]"}`}>
      {/* Header: Org/Workspace switcher + settings gear + close button */}
      <div className={`h-12 flex items-center justify-between px-3 shrink-0 border-b ${styles.borderSubtle}`}>
        <OrganizationWorkspaceSwitcher workspace={workspace} compact orgOnly />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              trackSettingsClicked()
              onToggleSettings()
            }}
            className={`inline-flex items-center justify-center size-8 rounded-lg shrink-0 active:scale-95 transition-all duration-150 ease-out [&>svg]:transition-transform [&>svg]:duration-200 [&>svg]:ease-out ${
              settingsMode
                ? "text-white dark:text-black bg-black dark:bg-white [&>svg]:rotate-90"
                : "text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:[&>svg]:rotate-90"
            }`}
            aria-label={settingsMode ? "Close settings" : "Open settings"}
            aria-pressed={!!settingsMode}
            data-testid="settings-button"
          >
            <Settings size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={closeSidebar}
            className="inline-flex items-center justify-center size-8 rounded-lg shrink-0 text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-150 ease-out"
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
        </div>
      </div>

      {/* Settings mode: replace conversation content with settings tabs */}
      {settingsMode ? (
        <SettingsNav onInvite={onInvite} />
      ) : (
        <>
          {/* Worktree switcher - shown below header when enabled */}
          {worktreeEnabled && !isSuperadminWorkspace && (
            <div className={`px-3 py-2 shrink-0 border-b ${styles.borderSubtle}`}>
              <WorktreeSwitcher
                workspace={workspace}
                currentWorktree={worktree}
                onChange={onSelectWorktree}
                isOpen={worktreeModalOpen}
                onOpenChange={onWorktreeModalOpenChange}
              />
            </div>
          )}

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {conversations.length === 0 && archivedConversations.length === 0 ? (
              <EmptyState>No conversations yet</EmptyState>
            ) : (
              <>
                {/* New Chat dropdown */}
                <div className="px-2 py-3 shrink-0">
                  <NewChatDropdown
                    worktreeEnabled={worktreeEnabled}
                    onNewChat={() => {
                      onNewConversation()
                      if (isMobile) closeSidebar()
                    }}
                    onNewWorktree={() => {
                      onNewWorktree()
                      if (isMobile) closeSidebar()
                    }}
                  />
                </div>

                {/* Active conversations - grows to fill space */}
                {conversations.length > 0 && (
                  <div className="flex-1 overflow-y-auto border-t border-black/[0.06] dark:border-white/[0.06]">
                    {conversations.map(conversation => (
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
                {conversations.length > 0 && (
                  <div className="border-b border-black/[0.06] dark:border-white/[0.06] shrink-0" />
                )}

                {/* Archived section - always at bottom */}
                {archivedConversations.length > 0 && (
                  <div className="shrink-0 border-t border-black/[0.06] dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setArchivedExpanded(prev => !prev)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium ${styles.textMuted} hover:text-black/60 dark:hover:text-white/60 ${styles.hoverFill} ${styles.transition}`}
                    >
                      <ChevronRight
                        size={14}
                        className={`transition-transform duration-150 ${archivedExpanded ? "rotate-90" : ""}`}
                      />
                      <span>Archived ({archivedConversations.length})</span>
                    </button>
                    {archivedExpanded && (
                      <div className="overflow-hidden animate-in fade-in duration-150">
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
          </div>

          {/* Mobile action buttons — desktop versions live in Nav.tsx (search: "desktop only") */}
          {isMobile && (
            <div className={`flex items-center gap-1 px-3 py-2 shrink-0 border-t ${styles.borderSubtle}`}>
              {(
                [
                  { icon: MessageCircle, label: "Feedback", action: onFeedbackClick },
                  { icon: Layers, label: "Components", action: onTemplatesClick },
                  { icon: Image, label: "Photos", action: onPhotosClick },
                ] as const
              ).map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    action?.()
                    closeSidebar()
                  }}
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-sm text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-150 ease-out"
                >
                  <Icon size={16} strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* iOS 26 Liquid Glass: extend background into bottom safe area */}
          {isMobile && <div className={styles.panel} style={{ height: "env(safe-area-inset-bottom, 0px)" }} />}
        </>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar - static layout with width animation */}
      {/* Use suppressHydrationWarning for the state-dependent width change */}
      <aside
        ref={sidebarRef}
        suppressHydrationWarning={true}
        className={`hidden md:flex flex-col h-full ${styles.panel} border-r ${styles.border} ${styles.transitionAll} overflow-hidden ${
          isOpen ? "w-[280px]" : "w-0 border-r-0"
        }`}
        aria-label="Conversation history"
      >
        {renderContent(false)}
      </aside>

      {/* Mobile sidebar - overlay, full height */}
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
