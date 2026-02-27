"use client"

import { Monitor } from "lucide-react"
import { useState } from "react"
import { useAuthSessionsQuery } from "@/lib/hooks/useSettingsQueries"
import { useRevokeOtherSessions, useRevokeSession } from "@/lib/tanstack/mutations"
import { dangerButton, infoCard, secondaryButton, text } from "../styles"
import { SettingsTabLayout } from "./SettingsTabLayout"

function maskIp(ip: string | null): string {
  if (!ip) return "Unknown"
  const parts = ip.split(".")
  if (parts.length === 4) return `${parts[0]}.*.*.*`
  // IPv6 or other — just show first segment
  return ip.split(":")[0] + ":***"
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function SessionsSettings() {
  const { data, isLoading, error } = useAuthSessionsQuery()
  const revokeMutation = useRevokeSession()
  const revokeOthersMutation = useRevokeOtherSessions()
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)

  return (
    <SettingsTabLayout title="Sessions" description="Manage your active login sessions across devices">
      {isLoading && <p className={text.muted}>Loading sessions...</p>}

      {error && (
        <div className={infoCard}>
          <p className={text.error}>Failed to load sessions. Please try again.</p>
        </div>
      )}

      {data && (
        <>
          <div className="space-y-2">
            {data.sessions.map(session => (
              <div
                key={session.sid}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  session.isCurrent
                    ? "border-black/[0.12] dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.02]"
                    : "border-black/[0.06] dark:border-white/[0.06]"
                }`}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-black/40 dark:text-white/40" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={"text-sm font-medium text-black/90 dark:text-white/90 truncate"}>
                      {session.deviceLabel || "Unknown device"}
                    </span>
                    {session.isCurrent && (
                      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Current
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 ${text.muted}`}>
                    <span>{maskIp(session.ipAddress)}</span>
                    <span>·</span>
                    <span>Active {relativeTime(session.lastActiveAt)}</span>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    type="button"
                    onClick={() => revokeMutation.mutate(session.sid)}
                    disabled={revokeMutation.isPending}
                    className={secondaryButton}
                    style={{ height: 32, fontSize: 12, padding: "0 12px" }}
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}

            {data.sessions.length === 0 && (
              <div className={infoCard}>
                <p className={text.muted}>No active sessions found.</p>
              </div>
            )}
          </div>

          {data.sessions.length > 1 && (
            <div className="mt-6">
              {!confirmRevokeAll ? (
                <button type="button" onClick={() => setConfirmRevokeAll(true)} className={dangerButton}>
                  Log out all other sessions
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      revokeOthersMutation.mutate()
                      setConfirmRevokeAll(false)
                    }}
                    disabled={revokeOthersMutation.isPending}
                    className={dangerButton}
                  >
                    Confirm: revoke all others
                  </button>
                  <button type="button" onClick={() => setConfirmRevokeAll(false)} className={secondaryButton}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </SettingsTabLayout>
  )
}
