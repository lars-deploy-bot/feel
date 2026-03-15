"use client"

import { text } from "../styles"

type ActionConfig = {
  label: string
  icon?: React.ReactNode
  onClick: () => void
}

/**
 * Reusable layout wrapper for all settings tabs
 */
export function SettingsTabLayout({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string
  description?: React.ReactNode
  action?: ActionConfig
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <div className={className}>
      {/* Header with title */}
      <div className="pb-3 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-medium text-[#2c2a26] dark:text-[#e8e4dc] mb-0.5 sm:mb-1">
            {title}
          </h3>
          {description && <div className={`${text.description} sm:text-sm leading-relaxed`}>{description}</div>}
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 transition-colors"
          >
            {action.icon}
            {action.label}
          </button>
        )}
      </div>

      {/* Content */}
      <div className={`pb-6 sm:pb-6 ${contentClassName || ""}`}>{children}</div>
    </div>
  )
}
