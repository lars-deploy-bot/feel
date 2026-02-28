"use client"

import { Image, Layers, MessageCircle } from "lucide-react"
import type { RefObject } from "react"
import { PhotoMenu } from "@/components/ui/PhotoMenu"
import { OrganizationWorkspaceSwitcher } from "@/components/workspace/OrganizationWorkspaceSwitcher"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import {
  trackComponentsClicked,
  trackFeedbackClicked,
  trackPhotobookImageSelected,
  trackPhotosClicked,
} from "@/lib/analytics/events"

interface NavProps {
  onFeedbackClick: () => void
  onTemplatesClick: () => void
  showPhotoMenu: boolean
  onPhotoMenuToggle: () => void
  onPhotoMenuClose: () => void
  photoButtonRef: RefObject<HTMLButtonElement | null>
  chatInputRef: RefObject<ChatInputHandle | null>
  workspace: string | null
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Nav({
  onFeedbackClick,
  onTemplatesClick,
  showPhotoMenu,
  onPhotoMenuToggle,
  onPhotoMenuClose,
  photoButtonRef,
  chatInputRef,
  workspace,
  isSidebarOpen,
  onToggleSidebar,
}: NavProps) {
  // Shared base styles
  const buttonBase =
    "inline-flex items-center justify-center h-8 rounded-lg active:scale-95 transition-all duration-150 ease-out"

  // Ghost icon buttons — invisible at rest, subtle hover
  const iconButtonStyle = `${buttonBase} w-8 text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]`

  return (
    <div className="h-12 flex-shrink-0 border-b border-black/[0.04] dark:border-white/[0.04]">
      <div className="h-full flex items-center justify-between px-2">
        {/* Left side: sidebar toggle + workspace picker */}
        <div className="flex items-center gap-2 min-w-0 pl-1">
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`inline-flex items-center justify-center size-8 rounded-lg shrink-0 text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-200 ease-in-out overflow-hidden ${
              isSidebarOpen ? "w-0 opacity-0 pointer-events-none" : "w-8 opacity-100"
            }`}
            aria-label="Open sidebar"
            tabIndex={isSidebarOpen ? -1 : 0}
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
              className="shrink-0"
            >
              <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
              <line x1="5.5" y1="2.5" x2="5.5" y2="13.5" />
            </svg>
          </button>
          <OrganizationWorkspaceSwitcher workspace={workspace} wsOnly />
        </div>

        {/* Action buttons — desktop only. Mobile versions live in ConversationSidebar.tsx (search: "Mobile action buttons") */}
        <div className="hidden md:flex items-center gap-1">
          {/* Feedback */}
          <button
            type="button"
            onClick={() => {
              trackFeedbackClicked()
              onFeedbackClick()
            }}
            className={iconButtonStyle}
            aria-label="Send Feedback"
            title="Send Feedback"
          >
            <MessageCircle size={16} strokeWidth={1.5} />
          </button>

          {/* Templates */}
          <button
            type="button"
            onClick={() => {
              trackComponentsClicked()
              onTemplatesClick()
            }}
            className={iconButtonStyle}
            aria-label="Components"
            title="Components"
          >
            <Layers size={16} strokeWidth={1.5} />
          </button>

          {/* Photos */}
          <div className="relative">
            <button
              ref={photoButtonRef}
              type="button"
              onClick={() => {
                trackPhotosClicked()
                onPhotoMenuToggle()
              }}
              className={iconButtonStyle}
              aria-label="Photos"
              title="Photos"
            >
              <Image size={16} strokeWidth={1.5} />
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
        </div>
      </div>
    </div>
  )
}
