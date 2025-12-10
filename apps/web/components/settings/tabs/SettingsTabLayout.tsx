"use client"

import { X } from "lucide-react"

export interface SettingsTabProps {
  onClose: () => void
}

/**
 * Reusable layout wrapper for all settings tabs
 */
export function SettingsTabLayout({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      {/* Header with title and close button (close button hidden on mobile - use main header) */}
      <div className="flex items-start justify-between gap-4 pt-4 sm:pt-5 pb-3 sm:pb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-0.5 sm:mb-1">{title}</h3>
          {description && (
            <p className="text-xs sm:text-sm text-black/60 dark:text-white/60 leading-relaxed">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hidden sm:flex flex-shrink-0 p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors active:scale-95"
          aria-label="Close settings"
        >
          <X size={18} className="text-black/60 dark:text-white/60" />
        </button>
      </div>

      {/* Content */}
      <div className="pb-6 sm:pb-6">{children}</div>
    </div>
  )
}
