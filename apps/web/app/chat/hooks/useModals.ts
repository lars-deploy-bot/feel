"use client"

import { parseAsString, useQueryStates } from "nuqs"
import { useCallback, useMemo, useState } from "react"
import type { SettingsTab } from "@/features/settings/settings-tabs"
import { isSettingsTab } from "@/features/settings/settings-tabs"
import { trackSettingsOpened } from "@/lib/analytics/events"
import { QUERY_KEYS } from "@/lib/url/queryState"

interface ModalState {
  feedback: boolean
  invite: boolean
  settings: { initialTab?: SettingsTab } | null
  templates: boolean
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
  openTemplates: () => void
  closeTemplates: () => void
  openMobilePreview: () => void
  closeMobilePreview: () => void
}

/**
 * Hook to manage all modal visibility state in one place.
 * Settings open/close state is synced to the URL via ?settings= query param
 * so it persists across page reloads.
 *
 * Uses useQueryStates to batch both settings params into a single URL update,
 * preventing flicker from intermediate states.
 */
export function useModals(): ModalState & ModalActions {
  const [settingsParams, setSettingsParams] = useQueryStates({
    [QUERY_KEYS.settings]: parseAsString,
    [QUERY_KEYS.settingsTab]: parseAsString,
  })

  const settingsParam = settingsParams[QUERY_KEYS.settings]

  // Derive settings state from URL param
  const settingsFromUrl: { initialTab?: SettingsTab } | null = settingsParam
    ? { initialTab: isSettingsTab(settingsParam) ? settingsParam : undefined }
    : null

  const [state, setState] = useState<Omit<ModalState, "settings">>({
    feedback: false,
    invite: false,
    templates: false,
    mobilePreview: false,
  })

  const openFeedback = useCallback(() => setState(s => ({ ...s, feedback: true })), [])
  const closeFeedback = useCallback(() => setState(s => ({ ...s, feedback: false })), [])

  const openInvite = useCallback(() => setState(s => ({ ...s, invite: true })), [])
  const closeInvite = useCallback(() => setState(s => ({ ...s, invite: false })), [])

  const openSettings = useCallback(
    (initialTab?: SettingsTab) => {
      trackSettingsOpened(initialTab)
      void setSettingsParams({ [QUERY_KEYS.settings]: initialTab || "1" })
    },
    [setSettingsParams],
  )
  const closeSettings = useCallback(() => {
    void setSettingsParams({ [QUERY_KEYS.settings]: null, [QUERY_KEYS.settingsTab]: null })
  }, [setSettingsParams])
  const toggleSettings = useCallback(() => {
    if (settingsParam) {
      void setSettingsParams({ [QUERY_KEYS.settings]: null, [QUERY_KEYS.settingsTab]: null })
    } else {
      trackSettingsOpened(undefined)
      void setSettingsParams({ [QUERY_KEYS.settings]: "1" })
    }
  }, [settingsParam, setSettingsParams])

  const openTemplates = useCallback(() => setState(s => ({ ...s, templates: true })), [])
  const closeTemplates = useCallback(() => setState(s => ({ ...s, templates: false })), [])

  const openMobilePreview = useCallback(() => setState(s => ({ ...s, mobilePreview: true })), [])
  const closeMobilePreview = useCallback(() => setState(s => ({ ...s, mobilePreview: false })), [])

  return useMemo(
    () => ({
      ...state,
      settings: settingsFromUrl,
      openFeedback,
      closeFeedback,
      openInvite,
      closeInvite,
      openSettings,
      closeSettings,
      toggleSettings,
      openTemplates,
      closeTemplates,
      openMobilePreview,
      closeMobilePreview,
    }),
    [
      state,
      settingsFromUrl,
      openFeedback,
      closeFeedback,
      openInvite,
      closeInvite,
      openSettings,
      closeSettings,
      toggleSettings,
      openTemplates,
      closeTemplates,
      openMobilePreview,
      closeMobilePreview,
    ],
  )
}
