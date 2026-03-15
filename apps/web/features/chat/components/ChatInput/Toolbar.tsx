"use client"

import { getAccessibleStreamModes, STREAM_MODES, type StreamMode } from "@webalive/shared"
import { Camera, ChevronDown, ClipboardList, Copy, FileText, Globe, MousePointer2, Terminal, User } from "lucide-react"
import type { RefObject } from "react"
import { useCallback, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useWorkbenchContext } from "@/features/chat/lib/workbench-context"
import { formatMessagesAsText } from "@/features/chat/utils/format-messages"
import { useSuperadmin } from "@/hooks/use-superadmin"
import {
  trackCameraUsed,
  trackElementSelectorActivated,
  trackMessagesCopied,
  trackPlanModeToggled,
  trackSkillSelected,
  trackSkillsMenuOpened,
} from "@/lib/analytics/events"
import { useTabMessages } from "@/lib/db/useTabMessages"
import { useAllSkills, useSkillsLoading } from "@/lib/providers/SkillsStoreProvider"
import { useWorkbench, useWorkbenchMinimized } from "@/lib/stores/debug-store"
import type { Skill } from "@/lib/stores/skillsStore"
import { useStreamMode, useStreamModeActions } from "@/lib/stores/streamModeStore"
import { useChatInput } from "./ChatInputContext"
import { useVoiceInput } from "./hooks/useVoiceInput"
import type { AddSkillFn } from "./types"
import { VoiceButton } from "./VoiceButton"

interface ToolbarProps {
  fileInputRef: RefObject<HTMLInputElement | null>
  onOpenTemplates?: () => void
  /** @deprecated Use onAddSkill instead */
  onAddUserPrompt?: (promptType: string, data: any, displayName: string, userFacingDescription?: string) => void
  onAddSkill?: AddSkillFn
}

export function Toolbar({ fileInputRef, onAddUserPrompt, onAddSkill }: ToolbarProps) {
  const { config, message, setMessage, tabId } = useChatInput()
  const [showPromptMenu, setShowPromptMenu] = useState(false)

  // Voice input — appends transcript to current message
  // Ref avoids stale closure (message changes while recording)
  const messageRef = useRef(message)
  messageRef.current = message
  const handleTranscript = useCallback(
    (text: string) => {
      const current = messageRef.current
      setMessage(current ? `${current} ${text}` : text)
    },
    [setMessage],
  )
  const handleVoiceError = useCallback((msg: string) => toast.error(msg), [])
  const voice = useVoiceInput({ onTranscript: handleTranscript, onError: handleVoiceError })
  const skills = useAllSkills()
  const isLoading = useSkillsLoading()
  const messages = useTabMessages(tabId)
  const { activateSelector, selectorActive } = useWorkbenchContext()
  const isWorkbenchOpen = useWorkbench()
  const isWorkbenchMinimized = useWorkbenchMinimized()
  const showSelectorButton = isWorkbenchOpen && !isWorkbenchMinimized

  // Stream mode state
  const mode = useStreamMode()
  const { setMode } = useStreamModeActions()
  const isSuperadmin = useSuperadmin()
  const [showModeMenu, setShowModeMenu] = useState(false)

  if (!config.enableCamera) {
    return null
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  /** @deprecated Use handleAddSkill instead */
  const _handleAddPrompt = (promptType: string, data: any, displayName: string, userFacingDescription?: string) => {
    if (!onAddUserPrompt) return
    onAddUserPrompt(promptType, data, displayName, userFacingDescription)
    setShowPromptMenu(false)
  }

  const handleAddSkill = (skill: Skill) => {
    trackSkillSelected({ skill_id: skill.id, skill_name: skill.displayName, source: skill.source })
    if (onAddSkill) {
      onAddSkill(skill.id, skill.displayName, skill.description, skill.prompt, skill.source)
    } else if (onAddUserPrompt) {
      // Fallback to legacy handler
      onAddUserPrompt(skill.id, skill.prompt, skill.displayName, skill.description)
    }
    setShowPromptMenu(false)
  }

  const handleCopyMessages = async () => {
    if (!messages || messages.length === 0) {
      toast.error("No messages to copy")
      return
    }

    const formatted = formatMessagesAsText(messages)

    try {
      await navigator.clipboard.writeText(formatted)
      trackMessagesCopied()
      toast.success("Messages copied")
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <div data-panel-role="chat-toolbar" className="flex items-center gap-1">
      {/* Copy Messages - hidden for now */}
      <button
        type="button"
        onClick={handleCopyMessages}
        className="hidden items-center justify-center size-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors"
        aria-label="Copy messages"
        title="Copy messages"
      >
        <Copy className="size-4" />
      </button>

      {/* Skills Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (!showPromptMenu) trackSkillsMenuOpened()
            setShowPromptMenu(!showPromptMenu)
          }}
          className="flex items-center justify-center size-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors"
          data-testid="skills-button"
          aria-label="Skills"
          title="Skills"
        >
          <ClipboardList className="size-4" />
        </button>

        {showPromptMenu && (
          <>
            {/* Backdrop */}
            <button
              type="button"
              className="fixed inset-0 z-10 bg-transparent border-0 p-0 cursor-default"
              onClick={() => setShowPromptMenu(false)}
              onKeyDown={e => e.key === "Escape" && setShowPromptMenu(false)}
              aria-label="Close menu"
            />

            {/* Menu */}
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] rounded-2xl shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.04] z-20 max-h-96 overflow-y-auto overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="p-1.5 space-y-0.5">
                {isLoading ? (
                  <div className="px-3 py-5 text-center text-xs text-black/35 dark:text-white/35">
                    Loading skills...
                  </div>
                ) : skills.length === 0 ? (
                  <div className="px-3 py-5 text-center text-xs text-black/35 dark:text-white/35">
                    No skills available. Add some in Settings.
                  </div>
                ) : (
                  skills.map(skill => (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => handleAddSkill(skill)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.07] dark:active:bg-white/[0.09] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 flex items-center justify-center rounded-lg bg-purple-500/10 shrink-0">
                          {skill.source === "superadmin" ? (
                            <Globe className="size-4 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <User className="size-4 text-purple-600 dark:text-purple-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-black/80 dark:text-white/80 truncate">
                            {skill.displayName}
                          </div>
                          <div className="text-[11px] text-black/40 dark:text-white/40 truncate">
                            {skill.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Select Element - only show when workbench preview is open and visible */}
      {showSelectorButton && (
        <button
          type="button"
          onClick={() => {
            trackElementSelectorActivated()
            activateSelector()
          }}
          className={`flex items-center justify-center size-8 rounded-full transition-colors ${
            selectorActive
              ? "bg-purple-500/20 text-purple-400"
              : "hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          }`}
          data-testid="element-selector-button"
          aria-label="Select element"
          title="Select element from preview (or hold Cmd/Ctrl)"
        >
          <MousePointer2 className="size-4" />
        </button>
      )}

      {/* Mode Selector */}
      <StreamModeSelector
        mode={mode}
        isSuperadmin={isSuperadmin}
        showMenu={showModeMenu}
        onToggleMenu={() => setShowModeMenu(v => !v)}
        onCloseMenu={() => setShowModeMenu(false)}
        onSelectMode={m => {
          trackPlanModeToggled(m === "plan")
          setMode(m)
          setShowModeMenu(false)
        }}
      />

      {/* Voice input */}
      <VoiceButton state={voice.state} onToggle={voice.toggle} />

      <button
        type="button"
        onClick={() => {
          trackCameraUsed()
          handleClick()
        }}
        className="flex items-center justify-center size-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 transition-colors"
        data-testid="upload-photo-button"
        aria-label="Upload photo"
      >
        <Camera className="size-4" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stream Mode Selector
// ---------------------------------------------------------------------------

// Icons are React components — frontend-only, not in shared.
const MODE_ICONS: Record<StreamMode, typeof FileText> = {
  default: ChevronDown,
  plan: FileText,
  superadmin: Terminal,
}

const MODE_BUTTON_STYLES: Record<StreamMode, string> = {
  default:
    "hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70",
  plan: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  superadmin: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
}

function StreamModeSelector({
  mode,
  isSuperadmin,
  showMenu,
  onToggleMenu,
  onCloseMenu,
  onSelectMode,
}: {
  mode: StreamMode
  isSuperadmin: boolean
  showMenu: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onSelectMode: (mode: StreamMode) => void
}) {
  const role = isSuperadmin ? "superadmin" : "member"
  const accessibleModes = getAccessibleStreamModes(role)
  const activeConfig = STREAM_MODES[mode]
  const Icon = MODE_ICONS[mode]

  // Only 2 modes (default + plan) — simple toggle, no dropdown needed
  if (accessibleModes.length <= 2) {
    return (
      <button
        type="button"
        onClick={() => onSelectMode(mode === "plan" ? "default" : "plan")}
        className={`flex items-center justify-center size-8 rounded-full transition-colors ${MODE_BUTTON_STYLES[mode]}`}
        aria-label={mode === "plan" ? "Disable plan mode" : "Enable plan mode"}
        title={mode === "plan" ? activeConfig.description : "Click to enable plan mode"}
      >
        <FileText className="size-4" />
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggleMenu}
        className={`flex items-center gap-1 h-8 px-2 rounded-full transition-colors ${MODE_BUTTON_STYLES[mode]}`}
        aria-label={`Mode: ${activeConfig.label}`}
        title={activeConfig.description}
      >
        <Icon className="size-4" />
        {mode !== "default" && <span className="text-[11px] font-medium">{activeConfig.label}</span>}
      </button>

      {showMenu && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 bg-transparent border-0 p-0 cursor-default"
            onClick={onCloseMenu}
            onKeyDown={e => e.key === "Escape" && onCloseMenu()}
            aria-label="Close menu"
          />
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] rounded-2xl shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.04] z-20 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="p-1.5 space-y-0.5">
              {accessibleModes.map(({ key, config }) => {
                const OptionIcon = MODE_ICONS[key]
                const isActive = mode === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectMode(key)}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-colors flex items-center gap-2.5 ${
                      isActive
                        ? "bg-black/[0.04] dark:bg-white/[0.06]"
                        : "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    <OptionIcon
                      className={`size-4 shrink-0 ${isActive ? "text-black/70 dark:text-white/70" : "text-black/30 dark:text-white/30"}`}
                    />
                    <div className="min-w-0">
                      <div
                        className={`text-[13px] ${isActive ? "font-medium text-black/80 dark:text-white/80" : "text-black/50 dark:text-white/50"}`}
                      >
                        {config.label}
                      </div>
                      <div className="text-[11px] text-black/30 dark:text-white/30">{config.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
