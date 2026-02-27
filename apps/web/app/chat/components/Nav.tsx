"use client"

import { Image, Layers, MessageCircle, PanelLeft, Settings } from "lucide-react"
import type { RefObject } from "react"
import { PhotoMenu } from "@/components/ui/PhotoMenu"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import {
  trackComponentsClicked,
  trackFeedbackClicked,
  trackPhotobookImageSelected,
  trackPhotosClicked,
  trackSettingsClicked,
} from "@/lib/analytics/events"

interface NavProps {
  onFeedbackClick: () => void
  onTemplatesClick: () => void
  isSettingsOpen: boolean
  onSettingsClick: () => void
  showPhotoMenu: boolean
  onPhotoMenuToggle: () => void
  onPhotoMenuClose: () => void
  photoButtonRef: RefObject<HTMLButtonElement | null>
  chatInputRef: RefObject<ChatInputHandle | null>
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Nav({
  onFeedbackClick,
  onTemplatesClick,
  isSettingsOpen,
  onSettingsClick,
  showPhotoMenu,
  onPhotoMenuToggle,
  onPhotoMenuClose,
  photoButtonRef,
  chatInputRef,
  isSidebarOpen,
  onToggleSidebar,
}: NavProps) {
  // Shared base styles
  const buttonBase =
    "inline-flex items-center justify-center h-8 rounded-lg active:scale-95 transition-all duration-150 ease-out"

  // Icon-only buttons - square 32x32px on desktop, 40x40 on mobile
  const iconButtonStyle = `${buttonBase} w-8 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] active:bg-black/[0.12] dark:active:bg-white/[0.12]`

  return (
    <div className="h-12 flex-shrink-0 border-b border-black/[0.04] dark:border-white/[0.04]">
      <div className="h-full flex items-center justify-between px-2">
        {/* Left side: sidebar toggle */}
        <div className="flex items-center gap-2 min-w-0">
          {!isSidebarOpen && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className={`${iconButtonStyle} shrink-0`}
              aria-label="Open sidebar"
            >
              <PanelLeft size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>

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
