/**
 * React hook for fetching and managing available integrations
 */

import { useState, useEffect, useCallback } from "react"
import type { AvailableIntegration } from "@/app/api/integrations/available/route"
import {
  OAUTH_POPUP_WIDTH,
  OAUTH_POPUP_HEIGHT,
  OAUTH_POPUP_POLL_INTERVAL,
  OAUTH_STORAGE_KEY,
  isOAuthCallbackMessage,
} from "@/lib/oauth/popup-constants"

interface UseIntegrationsResult {
  integrations: AvailableIntegration[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook to fetch available integrations for the current user
 */
export function useIntegrations(): UseIntegrationsResult {
  const [integrations, setIntegrations] = useState<AvailableIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchIntegrations = useCallback(async () => {
    console.log("[useIntegrations] fetchIntegrations called")
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/integrations/available", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch integrations: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(
        "[useIntegrations] API response:",
        data.integrations?.map((i: AvailableIntegration) => ({ key: i.provider_key, connected: i.is_connected })),
      )
      setIntegrations(data.integrations || [])
    } catch (err) {
      console.error("[useIntegrations] Error fetching integrations:", err)
      setError(err instanceof Error ? err.message : "Failed to load integrations")
      setIntegrations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  return {
    integrations,
    loading,
    error,
    refetch: fetchIntegrations,
  }
}

/**
 * Hook to check connection status for a specific integration
 */
export function useIntegrationStatus(providerKey: string): {
  isConnected: boolean
  loading: boolean
} {
  const { integrations, loading } = useIntegrations()

  const integration = integrations.find(i => i.provider_key === providerKey)

  return {
    isConnected: integration?.is_connected || false,
    loading,
  }
}

/**
 * Opens OAuth flow in a popup window.
 * Falls back to redirect if popup is blocked.
 * Uses storage event listener as fallback when window.opener is lost during cross-origin OAuth redirect.
 */
function openOAuthPopup(provider: string): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    // Clear any stale localStorage value before starting
    try {
      localStorage.removeItem(OAUTH_STORAGE_KEY)
    } catch {
      // Ignore localStorage errors
    }

    const left = window.screenX + (window.outerWidth - OAUTH_POPUP_WIDTH) / 2
    const top = window.screenY + (window.outerHeight - OAUTH_POPUP_HEIGHT) / 2

    const popup = window.open(
      `/api/auth/${provider}`,
      `oauth_${provider}`,
      `width=${OAUTH_POPUP_WIDTH},height=${OAUTH_POPUP_HEIGHT},left=${left},top=${top},popup=yes`,
    )

    if (!popup) {
      // Popup blocked - fall back to redirect
      window.location.href = `/api/auth/${provider}`
      return
    }

    let resolved = false

    const cleanup = () => {
      resolved = true
      window.removeEventListener("message", handleMessage)
      window.removeEventListener("storage", handleStorageEvent)
      clearInterval(pollTimer)
      try {
        localStorage.removeItem(OAUTH_STORAGE_KEY)
      } catch {
        // Ignore
      }
    }

    const handleResult = (data: { status: string; message?: string }, source: string) => {
      console.log(`[openOAuthPopup] OAuth callback via ${source}, status:`, data.status)
      cleanup()
      popup.close()
      resolve({ success: data.status === "success", error: data.message })
    }

    // Primary: postMessage from popup
    const handleMessage = (event: MessageEvent) => {
      if (resolved) return
      if (event.origin !== window.location.origin) return
      if (isOAuthCallbackMessage(event.data) && event.data.integration === provider) {
        handleResult(event.data, "postMessage")
      }
    }

    // Fallback: storage event (fires when localStorage changes from another window)
    const handleStorageEvent = (event: StorageEvent) => {
      if (resolved) return
      if (event.key !== OAUTH_STORAGE_KEY || !event.newValue) return
      try {
        const data = JSON.parse(event.newValue)
        if (isOAuthCallbackMessage(data) && data.integration === provider) {
          handleResult(data, "storage event")
        }
      } catch {
        // Ignore parse errors
      }
    }

    window.addEventListener("message", handleMessage)
    window.addEventListener("storage", handleStorageEvent)

    // Poll only to detect if popup was closed manually (storage event doesn't fire for this)
    const pollTimer = setInterval(() => {
      if (resolved) return
      if (popup.closed) {
        // Check localStorage one more time (storage event might not fire if popup closed too fast)
        try {
          const stored = localStorage.getItem(OAUTH_STORAGE_KEY)
          if (stored) {
            const data = JSON.parse(stored)
            if (isOAuthCallbackMessage(data) && data.integration === provider) {
              handleResult(data, "localStorage (on close)")
              return
            }
          }
        } catch {
          // Ignore
        }
        console.log("[openOAuthPopup] Popup closed without result")
        cleanup()
        resolve({ success: false, error: "Authorization cancelled" })
      }
    }, OAUTH_POPUP_POLL_INTERVAL)
  })
}

/**
 * Hook to connect to an integration via popup OAuth flow
 */
export function useConnectIntegration(providerKey: string) {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async (): Promise<boolean> => {
    setConnecting(true)
    setError(null)

    try {
      console.log(`[useConnectIntegration] Starting OAuth for ${providerKey}`)
      const result = await openOAuthPopup(providerKey)
      console.log("[useConnectIntegration] OAuth result:", result)

      if (!result.success && result.error && result.error !== "Authorization cancelled") {
        setError(result.error)
      }
      return result.success
    } catch (err) {
      console.error("[useConnectIntegration] Error:", err)
      setError("Failed to open authorization window")
      return false
    } finally {
      setConnecting(false)
    }
  }, [providerKey])

  return {
    connect,
    connecting,
    error,
  }
}

/**
 * Hook to disconnect from an integration
 */
export function useDisconnectIntegration(providerKey: string) {
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disconnect = useCallback(async () => {
    setDisconnecting(true)
    setError(null)

    try {
      const response = await fetch(`/api/integrations/${providerKey}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to disconnect from ${providerKey}`)
      }

      // Optionally trigger a refetch of integrations
      window.location.reload() // or use a state management solution
    } catch (err) {
      console.error(`[useDisconnectIntegration] Error disconnecting from ${providerKey}:`, err)
      setError(err instanceof Error ? err.message : "Failed to disconnect")
    } finally {
      setDisconnecting(false)
    }
  }, [providerKey])

  return {
    disconnect,
    disconnecting,
    error,
  }
}
