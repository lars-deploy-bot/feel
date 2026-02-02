"use client"

import { useEffect } from "react"
import { SettingsPageClient } from "./SettingsPageClient"

type SettingsTab =
  | "account"
  | "llm"
  | "goal"
  | "prompts"
  | "organization"
  | "websites"
  | "automations"
  | "integrations"
  | "keys"
  | "flags"
  | "admin"

interface SettingsOverlayProps {
  onClose: () => void
  initialTab?: SettingsTab
}

export function SettingsOverlay({ onClose, initialTab }: SettingsOverlayProps) {
  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      data-testid="settings-overlay"
    >
      <div
        className="relative w-full h-full sm:w-[95vw] sm:max-w-5xl sm:h-[90vh] sm:max-h-[800px] bg-white dark:bg-zinc-950 sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <SettingsPageClient onClose={onClose} initialTab={initialTab} skipAuthCheck />
      </div>
    </div>
  )
}
