"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { SettingsTab } from "@/features/settings/settings-tabs"
import { isSettingsTab } from "@/features/settings/settings-tabs"
import { trackSettingsOpened } from "@/lib/analytics/events"
import { QUERY_KEYS } from "@/lib/url/queryState"

interface ModalState {
  feedback: boolean
  invite: boolean
  settings: { initialTab?: SettingsTab } | null
  mobilePreview: boolean
}

interface ModalActions {
  openFeedback: () => void
  closeFeedback: () => void
  openInvite: () => void
  closeInvite: () => void
  openSettings: (initialTab?: SettingsTab) => void
  closeSettings: () => void
  toggleSettings: () => void
  openMobilePreview: () => void
  closeMobilePreview: () => void
}

/**
 * Hook to manage all modal visibility state in one place.
 *
 * Settings open/close uses plain React state (NOT nuqs). nuqs v2.8.8 uses
 * useOptimistic + startTransition + router.replace internally. The gap between
 * the optimistic reset and router.replace completing creates a flash where
 * settings briefly disappears — any urgent re-render (Zustand, effects) hits
 * this window. Plain useState is synchronous and batches with Zustand cleanly.
 *
 * URL is synced in a fire-and-forget effect for reload persistence.
 */
export function useModals(): ModalState & ModalActions {
  // --- Settings: plain React state, synced to URL via effect ---
  const [settings, setSettings] = useState<{ initialTab?: SettingsTab } | null>(null)

  // Hydrate from URL on mount so page reload preserves settings state
  const didHydrate = useRef(false)
  useEffect(() => {
    if (didHydrate.current) return
    didHydrate.current = true
    const param = new URLSearchParams(window.location.search).get(QUERY_KEYS.settings)
    if (param) {
      setSettings({ initialTab: isSettingsTab(param) ? param : undefined })
    }
  }, [])

  // Sync to URL (fire-and-forget — no React state reads the URL for this)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (settings) {
      url.searchParams.set(QUERY_KEYS.settings, settings.initialTab ?? "general")
    } else {
      url.searchParams.delete(QUERY_KEYS.settings)
      url.searchParams.delete(QUERY_KEYS.settingsTab)
    }
    window.history.replaceState(window.history.state, "", url.toString())
  }, [settings])

  // --- Other modals: plain React state ---
  const [state, setState] = useState<Omit<ModalState, "settings">>({
    feedback: false,
    invite: false,
    mobilePreview: false,
  })

  const openFeedback = useCallback(() => setState(s => ({ ...s, feedback: true })), [])
  const closeFeedback = useCallback(() => setState(s => ({ ...s, feedback: false })), [])

  const openInvite = useCallback(() => setState(s => ({ ...s, invite: true })), [])
  const closeInvite = useCallback(() => setState(s => ({ ...s, invite: false })), [])

  const openSettings = useCallback((initialTab?: SettingsTab) => {
    trackSettingsOpened(initialTab)
    setSettings({ initialTab })
  }, [])

  const closeSettings = useCallback(() => {
    setSettings(null)
  }, [])

  const toggleSettings = useCallback(() => {
    setSettings(prev => (prev ? null : {}))
  }, [])

  const openMobilePreview = useCallback(() => setState(s => ({ ...s, mobilePreview: true })), [])
  const closeMobilePreview = useCallback(() => setState(s => ({ ...s, mobilePreview: false })), [])

  return useMemo(
    () => ({
      ...state,
      settings,
      openFeedback,
      closeFeedback,
      openInvite,
      closeInvite,
      openSettings,
      closeSettings,
      toggleSettings,
      openMobilePreview,
      closeMobilePreview,
    }),
    [
      state,
      settings,
      openFeedback,
      closeFeedback,
      openInvite,
      closeInvite,
      openSettings,
      closeSettings,
      toggleSettings,
      openMobilePreview,
      closeMobilePreview,
    ],
  )
}
