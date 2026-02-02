"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect } from "react"
import { SettingsPageClient } from "@/components/settings/SettingsPageClient"

/**
 * Intercepted Settings Route
 *
 * This page renders when navigating to /settings FROM /chat.
 * It shows settings as an overlay while chat remains mounted underneath.
 *
 * Key behaviors:
 * - URL is /settings (real route)
 * - Rendered in the @modal parallel slot
 * - Close returns to /chat via router.back()
 * - ESC key and click-outside close the overlay
 */
export default function InterceptedSettingsPage() {
  const router = useRouter()

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      data-testid="settings-route-overlay"
    >
      <div
        className="relative w-full h-full sm:w-[95vw] sm:max-w-5xl sm:h-[90vh] sm:max-h-[800px] bg-white dark:bg-zinc-950 sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <SettingsPageClient onClose={handleClose} skipAuthCheck />
      </div>
    </div>
  )
}
