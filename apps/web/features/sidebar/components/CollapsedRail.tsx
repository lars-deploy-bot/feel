"use client"

import { MessageCircle, Plus, Settings } from "lucide-react"
import { SIDEBAR_RAIL } from "@/lib/layout"
import { useSidebarActions } from "../sidebarStore"
import { AccountMenu } from "./AccountMenu"

interface CollapsedRailProps {
  settingsMode?: boolean
  onNewConversation: () => void
  onSettingsClick: () => void
  onFeedbackClick?: () => void
  onTemplatesClick?: () => void
}

const railIconClass =
  "inline-flex items-center justify-center rounded-lg text-black/30 dark:text-white/30 hover:text-black/55 dark:hover:text-white/55 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-100"
const railIconStyle = { width: SIDEBAR_RAIL.iconSize, height: SIDEBAR_RAIL.iconSize }

export function CollapsedRail({
  settingsMode,
  onNewConversation,
  onSettingsClick,
  onFeedbackClick,
  onTemplatesClick: _onTemplatesClick,
}: CollapsedRailProps) {
  const { openSidebar } = useSidebarActions()

  return (
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
      {/* Components button — hidden, kept for future use */}
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
}
