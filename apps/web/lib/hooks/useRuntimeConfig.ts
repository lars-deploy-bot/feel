"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Runtime config shape returned by GET /api/config.
 * Mirrors the RuntimeConfig interface in app/api/config/route.ts.
 */
export interface RuntimeConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  posthogKey: string
  posthogHost: string
  sentryDsn: string
  contactEmail: string
  serverIp: string
  previewBase: string
  aliveEnv: string
}

// ---------------------------------------------------------------------------
// Module-scope cache: fetched once, shared across all hook consumers.
// ---------------------------------------------------------------------------

let cached: RuntimeConfig | null = null
let fetchPromise: Promise<RuntimeConfig | null> | null = null

/**
 * Build-time fallback from NEXT_PUBLIC_ vars.
 * Used when the fetch fails (offline, network error, etc.) so the app still
 * works with the values baked into the bundle.
 */
function buildTimeFallback(): RuntimeConfig {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
    posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "",
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
    contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
    serverIp: process.env.NEXT_PUBLIC_SERVER_IP ?? "",
    previewBase: process.env.NEXT_PUBLIC_PREVIEW_BASE ?? "",
    aliveEnv: process.env.NEXT_PUBLIC_ALIVE_ENV ?? "",
  }
}

/**
 * Fetch the runtime config exactly once. Concurrent callers share the same
 * in-flight promise. On failure, falls back to build-time values and clears
 * the promise so a future mount can retry.
 */
function fetchConfig(): Promise<RuntimeConfig | null> {
  if (cached) return Promise.resolve(cached)

  if (!fetchPromise) {
    fetchPromise = fetch("/api/config")
      .then(res => {
        if (!res.ok) throw new Error(`/api/config returned ${res.status}`)
        return res.json() as Promise<RuntimeConfig>
      })
      .then(data => {
        cached = data
        return data
      })
      .catch(() => {
        // Allow retry on next mount
        fetchPromise = null
        return null
      })
  }

  return fetchPromise
}

/**
 * Returns the current runtime config.
 *
 * - On first call in the browser session, fires a single GET /api/config.
 * - While the fetch is in flight, returns build-time NEXT_PUBLIC_ fallbacks.
 * - Once resolved, all consumers immediately get the runtime values.
 * - If the fetch fails, continues using build-time values.
 *
 * Intentionally NOT a React context (too heavy for a read-only cache).
 */
export function useRuntimeConfig(): RuntimeConfig {
  const [config, setConfig] = useState<RuntimeConfig>(() => cached ?? buildTimeFallback())

  const load = useCallback(() => {
    if (cached) {
      setConfig(cached)
      return
    }

    fetchConfig().then(result => {
      if (result) {
        setConfig(result)
      }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return config
}

/**
 * Imperative getter for non-React code (e.g. PostHog init, Sentry init).
 * Returns the cached config if available, otherwise build-time fallback.
 * Kicks off a fetch if one hasn't started yet (fire-and-forget).
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (cached) return cached

  // Kick off fetch so it's ready for subsequent callers
  if (typeof window !== "undefined") {
    fetchConfig()
  }

  return buildTimeFallback()
}
