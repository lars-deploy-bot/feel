"use client"

import { text } from "../styles"

/**
 * Reusable layout wrapper for all settings tabs
 */
export function SettingsTabLayout({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      {/* Header with title */}
      <div className="pt-4 sm:pt-5 pb-3 sm:pb-4">
        <h3 className="text-base sm:text-lg font-medium text-black/90 dark:text-white/90 mb-0.5 sm:mb-1">{title}</h3>
        {description && <p className={`${text.description} sm:text-sm leading-relaxed`}>{description}</p>}
      </div>

      {/* Content */}
      <div className="pb-6 sm:pb-6">{children}</div>
    </div>
  )
}
