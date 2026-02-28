"use client"

import { REFERRAL } from "@webalive/shared"
import { ChevronRight, Heart, Settings2 } from "lucide-react"
import { styles } from "../sidebar-styles"

export function FooterActions({
  onOpenInvite,
  onOpenSettings,
  isMobile,
}: {
  onOpenInvite: () => void
  onOpenSettings: () => void
  isMobile?: boolean
}) {
  return (
    <div className={`border-t ${styles.borderSubtle}`}>
      <div className="px-2 py-2.5 space-y-1.5">
        {REFERRAL.ENABLED && (
          <button
            type="button"
            onClick={onOpenInvite}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg ${styles.activeFill} ${styles.hoverFillStrong} ${styles.transition} group`}
          >
            <Heart
              size={16}
              className={`shrink-0 ${styles.textMuted} group-hover:text-black/60 dark:group-hover:text-white/60 ${styles.transition}`}
            />
            <div className="flex-1 min-w-0 text-left">
              <div className={`text-sm ${styles.textPrimary} truncate`}>Share Alive</div>
              <div className={`text-xs ${styles.textMuted} truncate`}>with someone you love</div>
            </div>
            <ChevronRight size={14} className={`shrink-0 ${styles.textSubtle}`} />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className={`${styles.iconButton} ${styles.transitionAll}`}
          aria-label="Settings"
        >
          <Settings2 size={16} strokeWidth={1.75} />
        </button>
      </div>
      {/* iOS 26 Liquid Glass: extend background into bottom safe area */}
      {isMobile && <div className={styles.panel} style={{ height: "env(safe-area-inset-bottom, 0px)" }} />}
    </div>
  )
}
