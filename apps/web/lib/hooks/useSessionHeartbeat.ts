"use client"

import { useEffect, useRef } from "react"
import { authStore } from "@/lib/stores/authStore"

const REFRESH_INTERVAL_MS = 20 * 60 * 1000 // 20 minutes

/**
 * Silent session refresh heartbeat.
 *
 * Every 20 minutes, POSTs to /api/auth/refresh which re-issues the JWT
 * with a fresh 30-day expiry (same sid). The user never sees an expiry
 * modal as long as they keep the tab open.
 *
 * On 401 (session revoked or invalidated by a version bump), triggers
 * the SessionExpiredModal immediately — no waiting for the next user action.
 *
 * Network errors (offline, server down) are silently ignored.
 */
export function useSessionHeartbeat() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        })

        if (res.status === 401) {
          authStore.handleSessionExpired("Your session has expired. Please log in again.")
        }
      } catch {
        // Network error — ignore. Not a session problem.
      }
    }

    void refresh()
    timerRef.current = setInterval(() => {
      void refresh()
    }, REFRESH_INTERVAL_MS)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])
}
