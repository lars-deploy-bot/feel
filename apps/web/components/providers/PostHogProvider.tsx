"use client"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react"
import { type ReactNode, useCallback, useEffect } from "react"
import { getRuntimeConfig } from "@/lib/hooks/useRuntimeConfig"
import { useAuthStatus } from "@/lib/stores/authStore"

/**
 * PostHog Analytics & Error Tracking Provider
 *
 * Initializes PostHog with:
 * - Exception autocapture for automatic error tracking (window.onerror, unhandledrejection)
 * - Session recording for debugging
 * - Feature flags support
 *
 * Uses runtime config from /api/config so that the PostHog key and host can be
 * changed without a rebuild. Falls back to build-time NEXT_PUBLIC_ values if
 * the runtime config hasn't loaded yet.
 */

const posthogHost = "/a"

// Track initialization state
let isInitialized = false

function getPostHogKey(): string {
  const config = getRuntimeConfig()
  return config.posthogKey
}

function getPostHogUiHost(): string {
  const config = getRuntimeConfig()
  return config.posthogHost
}

function initPostHog() {
  if (isInitialized || typeof window === "undefined" || process.env.NODE_ENV !== "production") {
    return
  }

  const key = getPostHogKey()
  if (!key) return

  posthog.init(key, {
    api_host: posthogHost,
    ui_host: getPostHogUiHost(),
    // Use latest defaults for all features including error tracking
    defaults: "2025-05-24",
    // Enable exception autocapture - this automatically captures:
    // - window.onerror events
    // - unhandledrejection events
    // - console.error calls
    capture_exceptions: true,
    // General autocapture for clicks, form submissions, etc.
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    // Session recording for debugging
    session_recording: {
      // Mask all text inputs for privacy
      maskTextSelector: "*",
    },
    // Respect Do Not Track
    respect_dnt: true,
    // Persistence
    persistence: "localStorage+cookie",
  })

  isInitialized = true
}

/**
 * Hook to manually capture exceptions with PostHog.
 * Use this for caught errors that you want to track.
 *
 * Note: Uncaught errors are automatically captured when capture_exceptions: true
 *
 * @example
 * ```tsx
 * const { captureException } = usePostHogErrorCapture()
 *
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   captureException(error, { context: 'chat', action: 'send_message' })
 * }
 * ```
 */
export function usePostHogErrorCapture() {
  const ph = usePostHog()

  return {
    captureException: (error: Error | unknown, properties?: Record<string, unknown>) => {
      if (!getPostHogKey()) {
        console.error("[PostHog] Error capture disabled - no API key:", error)
        return
      }

      const errorObj = error instanceof Error ? error : new Error(String(error))

      // Let the SDK handle formatting - it creates the proper $exception_list structure
      ph.captureException(errorObj, properties)
    },
  }
}

/**
 * Standalone function to capture exceptions without hook context.
 * Use this in error boundaries or non-React code.
 *
 * The SDK automatically formats the error into PostHog's $exception_list structure.
 */
export function captureException(error: Error | unknown, properties?: Record<string, unknown>) {
  if (!getPostHogKey() || typeof window === "undefined") {
    console.error("[PostHog] Error capture disabled:", error)
    return
  }

  const errorObj = error instanceof Error ? error : new Error(String(error))

  // Let the SDK handle formatting - it creates the proper $exception_list structure
  posthog.captureException(errorObj, properties)
}

/**
 * Identifies the current user in PostHog after login.
 * Re-identifies when auth status changes (e.g. login via AuthModal without page reload).
 *
 * Uses the global authStore (not context-based) so it works above UserStoreProvider.
 */
function PostHogIdentifier() {
  const ph = usePostHog()
  const authStatus = useAuthStatus()

  const identifyUser = useCallback(() => {
    if (!ph) return

    fetch("/api/user", { credentials: "include" })
      .then(r => r.json())
      .then((data: { user?: { id: string; email: string; name: string | null } | null }) => {
        if (data.user?.id && ph.get_distinct_id() !== data.user.id) {
          ph.identify(data.user.id, {
            email: data.user.email,
            name: data.user.name,
          })
        }
      })
      .catch(() => {})
  }, [ph])

  // Identify on mount (page load with existing session)
  useEffect(() => {
    identifyUser()
  }, [identifyUser])

  // Re-identify when auth status changes to "authenticated" (login via AuthModal)
  useEffect(() => {
    if (authStatus === "authenticated") {
      identifyUser()
    }
  }, [authStatus, identifyUser])

  return null
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  // Initialize PostHog on first render
  useEffect(() => {
    initPostHog()
  }, [])

  // If no PostHog key available from runtime config, just render children without the provider
  if (!getPostHogKey()) {
    return <>{children}</>
  }

  // Note: No custom error handlers needed - capture_exceptions: true
  // automatically sets up window.onerror and unhandledrejection handlers
  return (
    <PHProvider client={posthog}>
      <PostHogIdentifier />
      {children}
    </PHProvider>
  )
}
