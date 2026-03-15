"use client"

import { Layers, MessageCircle, Settings } from "lucide-react"
import { OrganizationWorkspaceSwitcher } from "@/components/workspace/OrganizationWorkspaceSwitcher"
import {
  trackComponentsClicked,
  trackFeedbackClicked,
  trackSettingsClicked,
} from "@/lib/analytics/events"

interface NavProps {
  onFeedbackClick: () => void
  onTemplatesClick: () => void
  workspace: string | null
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  settingsMode: boolean
  onSettingsClick: () => void
}

export function Nav({
  onFeedbackClick,
  onTemplatesClick,
  workspace,
  isSidebarOpen,
  onToggleSidebar,
  settingsMode,
  onSettingsClick,
}: NavProps) {
  // Shared base styles
  const buttonBase =
    "inline-flex items-center justify-center h-8 rounded-lg active:scale-95 transition-all duration-150 ease-out"

  // Ghost icon buttons — invisible at rest, subtle hover
  const iconButtonStyle = `${buttonBase} w-8 text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]`

  return (
    <div data-testid="chat-nav-bar" className="h-12 flex-shrink-0 border-b border-black/[0.04] dark:border-white/[0.04]">
      <div className="h-full flex items-center justify-between px-2">
        {/* Left side: sidebar toggle + workspace picker */}
        <div className="flex items-center gap-2 min-w-0 pl-1">
          <button
            type="button"
            onClick={onToggleSidebar}
            className={`inline-flex items-center justify-center size-8 rounded-lg shrink-0 text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-200 ease-in-out overflow-hidden ${
              isSidebarOpen ? "w-0 opacity-0 pointer-events-none" : "w-8 opacity-100"
            }`}
            data-testid="sidebar-toggle"
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
          {/* Settings */}
          <button
            type="button"
            onClick={() => {
              trackSettingsClicked()
              onSettingsClick()
            }}
            className={`${buttonBase} w-8 ${
              settingsMode
                ? "text-black dark:text-white bg-black/[0.08] dark:bg-white/[0.08] [&>svg]:rotate-90"
                : "text-black/35 dark:text-white/35 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
            } [&>svg]:transition-transform [&>svg]:duration-200 [&>svg]:ease-out`}
            aria-label={settingsMode ? "Close settings" : "Open settings"}
            aria-pressed={settingsMode}
            data-testid="settings-button"
          >
            <Settings size={16} strokeWidth={1.5} />
          </button>

          {/* Feedback */}
          <button
            type="button"
            onClick={() => {
              trackFeedbackClicked()
              onFeedbackClick()
            }}
            className={iconButtonStyle}
            data-testid="feedback-button"
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
            data-testid="templates-button"
            aria-label="Components"
            title="Components"
          >
            <Layers size={16} strokeWidth={1.5} />
          </button>

        </div>
      </div>
    </div>
  )
}
