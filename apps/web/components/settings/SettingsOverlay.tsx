"use client"

import { Suspense, useEffect } from "react"
import { trackSettingsOpened } from "@/lib/analytics/events"
import { SettingsPageClient } from "./SettingsPageClient"

type SettingsTab =
  | "general"
  | "sessions"
  | "billing"
  | "skills"
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

/**
 * Settings overlay — rendered inside the content area's relative container.
 * Covers sidebar + chat + workbench but leaves the top nav visible.
 * Close via: X button or ESC key.
 * Uses Suspense to handle nuqs URL param hydration.
 */
export function SettingsOverlay({ onClose, initialTab }: SettingsOverlayProps) {
  // Track settings open
  useEffect(() => {
    trackSettingsOpened(initialTab)
  }, [initialTab])

  // ESC key closes overlay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-40 bg-white dark:bg-zinc-950"
      role="dialog"
      aria-modal="false"
      aria-label="Settings"
      data-testid="settings-overlay"
    >
      <Suspense fallback={null}>
        <SettingsPageClient onClose={onClose} initialTab={initialTab} />
      </Suspense>
    </div>
  )
}
