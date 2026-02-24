"use client"

import { Image, Layers, MessageCircle, PanelLeft, PanelLeftClose, Settings } from "lucide-react"
import type { RefObject } from "react"
import { PhotoMenu } from "@/components/ui/PhotoMenu"
import { OrganizationWorkspaceSwitcher } from "@/components/workspace/OrganizationWorkspaceSwitcher"
import { WorktreeSwitcher } from "@/components/workspace/WorktreeSwitcher"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import {
  trackComponentsClicked,
  trackFeedbackClicked,
  trackPhotobookImageSelected,
  trackPhotosClicked,
  trackSettingsClicked,
} from "@/lib/analytics/events"
import { useFeatureFlag } from "@/lib/stores/featureFlagStore"

interface NavProps {
  isSuperadminWorkspace: boolean
  onFeedbackClick: () => void
  onTemplatesClick: () => void
  isSettingsOpen: boolean
  onSettingsClick: () => void
  showPhotoMenu: boolean
  onPhotoMenuToggle: () => void
  onPhotoMenuClose: () => void
  photoButtonRef: RefObject<HTMLButtonElement | null>
  chatInputRef: RefObject<ChatInputHandle | null>
  workspace: string | null
  worktree: string | null
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  onSelectWorktree: (worktree: string | null) => void
  worktreeModalOpen?: boolean
  onWorktreeModalOpenChange?: (open: boolean) => void
}

export function Nav({
  isSuperadminWorkspace,
  onFeedbackClick,
  onTemplatesClick,
  isSettingsOpen,
  onSettingsClick,
  showPhotoMenu,
  onPhotoMenuToggle,
  onPhotoMenuClose,
  photoButtonRef,
  chatInputRef,
  workspace,
  worktree,
  isSidebarOpen,
  onToggleSidebar,
  onSelectWorktree,
  worktreeModalOpen,
  onWorktreeModalOpenChange,
}: NavProps) {
  const worktreesEnabled = useFeatureFlag("WORKTREES")

  // Shared base styles
  const buttonBase =
    "inline-flex items-center justify-center h-8 rounded-lg active:scale-95 transition-all duration-150 ease-out"

  // Icon-only buttons - square 32x32px on desktop, 40x40 on mobile
  const iconButtonStyle = `${buttonBase} w-8 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] active:bg-black/[0.12] dark:active:bg-white/[0.12]`

  return (
    <div className="h-12 flex-shrink-0 border-b border-black/[0.04] dark:border-white/[0.04]">
      <div className="h-full flex items-center px-2">
        {/* Left side: sidebar toggle + breadcrumb + worktree */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`${iconButtonStyle} shrink-0`}
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose size={16} strokeWidth={1.75} />
            ) : (
              <PanelLeft size={16} strokeWidth={1.75} />
            )}
          </button>
          <OrganizationWorkspaceSwitcher workspace={workspace} />
          {worktreesEnabled && !isSuperadminWorkspace && (
            <WorktreeSwitcher
              workspace={workspace}
              currentWorktree={worktree}
              onChange={onSelectWorktree}
              isOpen={worktreeModalOpen}
              onOpenChange={onWorktreeModalOpenChange}
            />
          )}
        </div>

        {/* Separator between nav and actions */}
        <div className="w-px h-4 bg-black/[0.08] dark:bg-white/[0.08] mx-2 shrink-0" />

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Feedback - hidden on mobile, available in settings */}
          <button
            type="button"
            onClick={() => {
              trackFeedbackClicked()
              onFeedbackClick()
            }}
            className={`hidden md:inline-flex ${iconButtonStyle}`}
            aria-label="Send Feedback"
            title="Send Feedback"
          >
            <MessageCircle size={16} strokeWidth={1.75} />
          </button>

          {/* Templates - always visible, important action */}
          <button
            type="button"
            onClick={() => {
              trackComponentsClicked()
              onTemplatesClick()
            }}
            className={`${iconButtonStyle} size-10 md:size-8`}
            aria-label="Components"
            title="Components"
          >
            <Layers size={18} strokeWidth={1.75} className="md:size-4" />
          </button>

          {/* Photos - always visible */}
          <div className="relative">
            <button
              ref={photoButtonRef}
              type="button"
              onClick={() => {
                trackPhotosClicked()
                onPhotoMenuToggle()
              }}
              className={`${iconButtonStyle} size-10 md:size-8`}
              aria-label="Photos"
              title="Photos"
            >
              <Image size={18} strokeWidth={1.75} className="md:size-4" />
            </button>
            <PhotoMenu
              isOpen={showPhotoMenu}
              onClose={onPhotoMenuClose}
              onSelectImage={imageKey => {
                trackPhotobookImageSelected(imageKey)
                chatInputRef.current?.addPhotobookImage(imageKey)
              }}
              triggerRef={photoButtonRef}
            />
          </div>

          {/* Settings toggle */}
          <button
            type="button"
            onClick={() => {
              trackSettingsClicked()
              onSettingsClick()
            }}
            className={`size-10 md:size-8 ${
              isSettingsOpen
                ? `${buttonBase} w-8 text-white dark:text-black bg-black dark:bg-white`
                : `${iconButtonStyle} [&>svg]:transition-transform [&>svg]:duration-200 [&>svg]:ease-out hover:[&>svg]:rotate-90`
            }`}
            aria-label={isSettingsOpen ? "Close settings" : "Open settings"}
            aria-pressed={isSettingsOpen}
            data-testid="settings-button"
          >
            <Settings size={18} strokeWidth={1.75} className="md:size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
