"use client"

import { Suspense } from "react"
import { SettingsContent } from "./SettingsPageClient"

/**
 * Settings content panel — rendered in the main content area.
 * The sidebar nav lives inside ConversationSidebar (settings mode).
 * Both consume SettingsTabProvider (wrapped in page.tsx) for shared tab state.
 * Close via: X button in sidebar or clicking back to chat.
 */
export function SettingsOverlay() {
  return (
    <section
      className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain bg-zinc-50 dark:bg-zinc-950"
      aria-label="Settings"
      data-testid="settings-overlay"
    >
      <Suspense fallback={null}>
        <SettingsContent />
      </Suspense>
    </section>
  )
}
