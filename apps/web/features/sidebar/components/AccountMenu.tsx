"use client"

import { LogOut, MessageCircle, Settings } from "lucide-react"
import { useState } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { logError } from "@/lib/client-error-logger"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { resetPostHogIdentity } from "@/lib/posthog"
import { useSelectedOrgId } from "@/lib/stores/workspaceStore"
import { usePortalMenu } from "../hooks/usePortalMenu"

interface AccountMenuProps {
  onSettingsClick: () => void
  onFeedbackClick?: () => void
  /** Inline mode: shows full user name row instead of avatar circle */
  inline?: boolean
  /** Pre-computed display name (avoids re-fetching in inline mode) */
  userDisplay?: string | null
}

export function AccountMenu({
  onSettingsClick,
  onFeedbackClick,
  inline,
  userDisplay: externalUserDisplay,
}: AccountMenuProps) {
  const { open, pos, triggerRef, menuRef, toggle, close } = usePortalMenu("above")
  const { user } = useAuth()
  const { organizations, loading } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()
  const [signingOut, setSigningOut] = useState(false)

  // Use provided display name, or derive from user auth object
  const userDisplay = externalUserDisplay ?? user?.firstName ?? user?.name ?? user?.email?.split("@")[0] ?? null
  const avatarLetter = (userDisplay ?? "U")[0].toUpperCase()
  const selectedOrg = selectedOrgId ? organizations.find(o => o.org_id === selectedOrgId) : undefined
  const orgName = loading ? null : (selectedOrg?.name ?? organizations[0]?.name ?? null)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await fetch("/api/logout", { method: "POST" })
      resetPostHogIdentity()
      window.location.href = "/"
    } catch (err) {
      logError("auth", "Sign-out request failed", { error: err instanceof Error ? err : new Error(String(err)) })
      setSigningOut(false)
    }
  }

  const itemClass =
    "w-full flex items-center gap-3 px-3 py-2 text-[13px] text-black/60 dark:text-white/60 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors rounded-lg cursor-pointer"

  return (
    <>
      {inline ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
          aria-label="Account menu"
        >
          <div className="size-6 rounded-full bg-black/[0.06] dark:bg-white/[0.08] flex items-center justify-center text-[11px] font-medium text-black/40 dark:text-white/40 shrink-0">
            {avatarLetter}
          </div>
          <span className="text-[13px] text-black/50 dark:text-white/50 truncate">{userDisplay}</span>
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          className="inline-flex items-center justify-center size-9 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] active:scale-95 transition-all duration-100"
          aria-label="Account menu"
        >
          <div className="size-6 rounded-full bg-black/[0.06] dark:bg-white/[0.08] flex items-center justify-center text-[11px] font-medium text-black/40 dark:text-white/40">
            {avatarLetter}
          </div>
        </button>
      )}

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-56 bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden py-1.5"
            style={pos}
          >
            {/* User info */}
            <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.06] mb-1">
              <p className="text-[13px] font-medium text-black/80 dark:text-white/80 truncate">{userDisplay}</p>
              {orgName && <p className="text-[11px] text-black/35 dark:text-white/35 truncate">{orgName}</p>}
            </div>

            {/* Menu items */}
            <button
              type="button"
              className={itemClass}
              onClick={() => {
                close()
                onSettingsClick()
              }}
            >
              <Settings size={15} strokeWidth={1.5} />
              Settings
            </button>

            {onFeedbackClick && (
              <button
                type="button"
                className={itemClass}
                onClick={() => {
                  close()
                  onFeedbackClick()
                }}
              >
                <MessageCircle size={15} strokeWidth={1.5} />
                Feedback
              </button>
            )}

            <div className="border-t border-black/[0.06] dark:border-white/[0.06] my-1" />

            <button
              type="button"
              className={`${itemClass} text-red-500/70 dark:text-red-400/70 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/[0.06] dark:hover:bg-red-400/[0.06]`}
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut size={15} strokeWidth={1.5} />
              {signingOut ? "Signing out…" : "Log out"}
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
