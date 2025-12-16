"use client"

import { FlaskConical, Image, Layers, MessageCircle, PanelRight, Radio, Settings } from "lucide-react"
import type { RefObject } from "react"
import { PhotoMenu } from "@/components/ui/PhotoMenu"
import type { ChatInputHandle } from "@/features/chat/components/ChatInput/types"
import { isDevelopment, useDebugActions, useDebugView, useSandbox } from "@/lib/stores/debug-store"

interface ChatHeaderProps {
  isSuperadminWorkspace: boolean
  onFeedbackClick: () => void
  onTemplatesClick: () => void
  onSettingsClick: () => void
  showPhotoMenu: boolean
  onPhotoMenuToggle: () => void
  onPhotoMenuClose: () => void
  photoButtonRef: RefObject<HTMLButtonElement | null>
  chatInputRef: RefObject<ChatInputHandle | null>
}

export function ChatHeader({
  isSuperadminWorkspace,
  onFeedbackClick,
  onTemplatesClick,
  onSettingsClick,
  showPhotoMenu,
  onPhotoMenuToggle,
  onPhotoMenuClose,
  photoButtonRef,
  chatInputRef,
}: ChatHeaderProps) {
  const { toggleView, toggleSandbox } = useDebugActions()
  const debugModeEnabled = useDebugView()
  const showSandboxRaw = useSandbox()
  const showSandbox = showSandboxRaw && !isSuperadminWorkspace

  return (
    <div className="h-14 flex-shrink-0 border-b border-black/10 dark:border-white/10">
      <div className="h-full flex items-center justify-between px-6 mx-auto w-full md:max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-black dark:text-white">Chat</span>
        </div>
        <div className="flex items-center gap-2">
          {(isDevelopment() || isSuperadminWorkspace) && (
            <button
              type="button"
              onClick={toggleView}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors ${
                debugModeEnabled
                  ? "text-amber-600 border-amber-400 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-600 dark:bg-amber-950/50 dark:hover:bg-amber-950"
                  : "text-emerald-600 border-emerald-400 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-600 dark:hover:bg-emerald-950/30"
              }`}
              title={debugModeEnabled ? "Switch to live view" : "Switch to debug view"}
            >
              {debugModeEnabled ? <FlaskConical size={14} /> : <Radio size={14} />}
              <span className="hidden md:inline">{debugModeEnabled ? "Debug" : "Live"}</span>
            </button>
          )}
          {/* Hide Preview button for superadmin workspace (no site to preview) */}
          {!isSuperadminWorkspace && (
            <button
              type="button"
              onClick={toggleSandbox}
              className={`hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors ${
                showSandbox
                  ? "text-purple-600 border-purple-400 bg-purple-50 hover:bg-purple-100 dark:text-purple-400 dark:border-purple-600 dark:bg-purple-950/50 dark:hover:bg-purple-950"
                  : "text-black/60 dark:text-white/60 border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              title={showSandbox ? "Hide preview panel" : "Show preview panel"}
            >
              <PanelRight size={14} />
              <span>Preview</span>
            </button>
          )}
          <button
            type="button"
            onClick={onFeedbackClick}
            className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
            aria-label="Send Feedback"
            title="Send Feedback"
          >
            <MessageCircle size={14} />
          </button>
          <button
            type="button"
            onClick={onTemplatesClick}
            className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
            aria-label="Components"
            title="Components"
          >
            <Layers size={14} />
          </button>
          <div className="relative">
            <button
              ref={photoButtonRef}
              type="button"
              onClick={onPhotoMenuToggle}
              className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
              aria-label="Photos"
              title="Photos"
            >
              <Image size={14} />
            </button>
            <PhotoMenu
              isOpen={showPhotoMenu}
              onClose={onPhotoMenuClose}
              onSelectImage={imageKey => chatInputRef.current?.addPhotobookImage(imageKey)}
              triggerRef={photoButtonRef}
            />
          </div>
          <button
            type="button"
            onClick={onSettingsClick}
            className="inline-flex items-center justify-center px-3 py-2 text-black dark:text-white border border-black/20 dark:border-white/20 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors active:scale-90 [&>svg]:transition-transform [&>svg]:duration-300 [&>svg]:ease-out hover:[&>svg]:rotate-90"
            aria-label="Settings"
            data-testid="settings-button"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
