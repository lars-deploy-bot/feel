"use client"

import { Star } from "lucide-react"
import { memo } from "react"
import { useDomainConfig } from "@/lib/providers/DomainConfigProvider"

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** "mysite.alive.best" → "mysite" (strips wildcard domain suffix), "example.com" → "example.com" */
export function displayName(hostname: string, wildcardDomain: string): string {
  const suffix = `.${wildcardDomain}`
  if (hostname.endsWith(suffix)) {
    return hostname.slice(0, -suffix.length)
  }
  return hostname
}

function domainInitial(hostname: string, wildcardDomain: string): string {
  const first = displayName(hostname, wildcardDomain)[0]
  return first ? first.toUpperCase() : "?"
}

export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
}

// ---------------------------------------------------------------------------
// Grid layout constant (shared between ProjectCard consumers)
// ---------------------------------------------------------------------------

export const PROJECT_GRID = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"

// ---------------------------------------------------------------------------
// ProjectCard
// ---------------------------------------------------------------------------

interface ProjectCardProps {
  hostname: string
  orgId: string
  createdAt: string
  isCurrent: boolean
  isFavorite: boolean
  onSwitch: (hostname: string, orgId: string) => void
  onToggleFavorite: (hostname: string) => void
  subtitle?: string
}

export const ProjectCard = memo(function ProjectCard({
  hostname,
  orgId,
  createdAt,
  isCurrent,
  isFavorite,
  onSwitch,
  onToggleFavorite,
  subtitle,
}: ProjectCardProps) {
  const { wildcard } = useDomainConfig()
  const name = displayName(hostname, wildcard)

  return (
    <div className="relative group">
      {/* Favorite star — positioned outside button to avoid nesting */}
      <div
        role="none"
        onClick={e => {
          e.stopPropagation()
          onToggleFavorite(hostname)
        }}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            e.stopPropagation()
            onToggleFavorite(hostname)
          }
        }}
        className={`absolute top-2 right-2 z-10 p-1 rounded-md cursor-pointer transition-all ${
          isFavorite
            ? "text-amber-500 dark:text-amber-400"
            : "text-black/0 dark:text-white/0 group-hover:text-black/20 dark:group-hover:text-white/20 hover:!text-amber-500 dark:hover:!text-amber-400"
        }`}
      >
        <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
      </div>

      <button
        type="button"
        disabled={isCurrent}
        onClick={() => onSwitch(hostname, orgId)}
        className={`w-full relative flex flex-col items-center justify-center text-center p-4 rounded-xl border aspect-square transition-all duration-150 active:scale-[0.97] ${
          isCurrent
            ? "border-black/20 dark:border-white/20 bg-black/[0.04] dark:bg-white/[0.04]"
            : "border-black/[0.08] dark:border-white/[0.08] hover:border-black/20 dark:hover:border-white/20 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer"
        }`}
      >
        {isCurrent && (
          <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 bg-black dark:bg-white text-white dark:text-black rounded-md font-medium">
            Current
          </span>
        )}

        <div className="w-10 h-10 rounded-xl bg-black/[0.06] dark:bg-white/[0.06] flex items-center justify-center mb-2.5">
          <span className="text-base font-semibold text-black/50 dark:text-white/50">
            {domainInitial(hostname, wildcard)}
          </span>
        </div>

        <span className="text-sm font-medium text-black/90 dark:text-white/90 truncate w-full px-1" title={hostname}>
          {name}
        </span>

        <span className="text-[11px] text-black/35 dark:text-white/35 truncate w-full px-1 mt-0.5" title={hostname}>
          {subtitle || hostname}
        </span>

        <span className="text-[10px] text-black/25 dark:text-white/25 mt-1">{formatRelativeDate(createdAt)}</span>
      </button>
    </div>
  )
})
