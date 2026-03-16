"use client"

import { useEffect } from "react"
import { trackSessionExpired } from "@/lib/analytics/events"
import { useAuthActions, useSessionExpiredReason } from "@/lib/stores/authStore"

export function SessionExpiredModal() {
  const { redirectToLogin } = useAuthActions()
  const reason = useSessionExpiredReason()
  useEffect(() => {
    trackSessionExpired()
  }, [])

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-description"
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
        role="document"
      >
        <h2 id="session-expired-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Signed out
        </h2>

        <p id="session-expired-description" className="text-[13px] text-zinc-400 dark:text-zinc-500 mt-2">
          {reason || "Your session ended. Sign in to pick up where you left off."}
        </p>

        <button
          type="button"
          onClick={redirectToLogin}
          className="mt-5 h-9 px-5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-[13px] font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors duration-100"
        >
          Sign in
        </button>
      </div>
    </div>
  )
}
