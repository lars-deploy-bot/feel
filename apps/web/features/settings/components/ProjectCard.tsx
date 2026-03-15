"use client"

import { ExternalLink, Star, Trash2 } from "lucide-react"
import { memo, useEffect, useState } from "react"
import { useDomainConfig } from "@/lib/providers/DomainConfigProvider"
import { getSiteUrl } from "@/lib/preview-utils"
import { DeleteProjectModal } from "./DeleteProjectModal"

// ---------------------------------------------------------------------------
// Favicon loader with localStorage cache
// ---------------------------------------------------------------------------

const FAVICON_CACHE_PREFIX = "alive:favicon:"
const FAVICON_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

function useFavicon(hostname: string): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const cached = localStorage.getItem(`${FAVICON_CACHE_PREFIX}${hostname}`)
    if (!cached) return null
    try {
      const { url, ts } = JSON.parse(cached)
      if (Date.now() - ts < FAVICON_CACHE_TTL) return url
      localStorage.removeItem(`${FAVICON_CACHE_PREFIX}${hostname}`)
    } catch { /* corrupted cache */ }
    return null
  })

  useEffect(() => {
    if (src) return // already have it
    const siteUrl = getSiteUrl(hostname)
    if (!siteUrl) return

    const img = new Image()
    const faviconUrl = `${siteUrl}/favicon.ico`
    img.onload = () => {
      setSrc(faviconUrl)
      localStorage.setItem(
        `${FAVICON_CACHE_PREFIX}${hostname}`,
        JSON.stringify({ url: faviconUrl, ts: Date.now() }),
      )
    }
    // silently fail — we'll show the initial letter
    img.onerror = () => {}
    img.src = faviconUrl
  }, [hostname, src])

  return src
}

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

/** Capitalize first letter: "mysite" → "Mysite" */
function prettyName(hostname: string, wildcardDomain: string): string {
  const name = displayName(hostname, wildcardDomain)
  return name.charAt(0).toUpperCase() + name.slice(1)
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

export const PROJECT_GRID = "flex flex-col gap-1.5"

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
  onDelete?: (hostname: string) => void
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
  onDelete,
  subtitle,
}: ProjectCardProps) {
  const { wildcard } = useDomainConfig()
  const name = prettyName(hostname, wildcard)
  const shortName = displayName(hostname, wildcard)
  const siteUrl = getSiteUrl(hostname)
  const favicon = useFavicon(hostname)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  return (
    <>{showDeleteModal && onDelete && (
      <DeleteProjectModal
        hostname={hostname}
        confirmName={shortName}
        onConfirm={() => {
          setShowDeleteModal(false)
          onDelete(hostname)
        }}
        onClose={() => setShowDeleteModal(false)}
      />
    )}
    <div
      className={`relative group flex items-center gap-3.5 p-3 rounded-xl border transition-all duration-150 ${
        isCurrent
          ? "border-[#4a7c59]/20 dark:border-[#7cb88a]/15 bg-[#4a7c59]/[0.04] dark:bg-[#7cb88a]/[0.04]"
          : "border-[#4a7c59]/[0.08] dark:border-[#7cb88a]/[0.06] hover:border-[#4a7c59]/[0.16] dark:hover:border-[#7cb88a]/[0.12]"
      }`}
    >
      {/* Favicon or initial */}
      <div
        className={`size-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
          isCurrent
            ? "bg-[#4a7c59]/[0.10] dark:bg-[#7cb88a]/[0.10]"
            : "bg-[#4a7c59]/[0.05] dark:bg-[#7cb88a]/[0.05]"
        }`}
      >
        {favicon ? (
          <img src={favicon} alt="" className="size-5 object-contain" />
        ) : (
          <span
            className={`text-sm font-semibold ${
              isCurrent ? "text-[#4a7c59] dark:text-[#7cb88a]" : "text-[#8a8578] dark:text-[#7a756b]"
            }`}
          >
            {domainInitial(hostname, wildcard)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#2c2a26] dark:text-[#e8e4dc] truncate">{name}</span>
          {isCurrent && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[#4a7c59]/[0.10] dark:bg-[#7cb88a]/[0.10] text-[#4a7c59] dark:text-[#7cb88a] rounded-md font-medium shrink-0">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[#b5afa3] dark:text-[#5c574d] truncate">
            {subtitle || hostname}
          </span>
          <span className="text-[10px] text-[#b5afa3] dark:text-[#5c574d] shrink-0">{formatRelativeDate(createdAt)}</span>
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Favorite */}
        <button
          type="button"
          onClick={() => onToggleFavorite(hostname)}
          className={`p-1.5 rounded-lg transition-colors ${
            isFavorite
              ? "text-amber-500 dark:text-amber-400"
              : "text-[#b5afa3] dark:text-[#5c574d] hover:text-amber-500 dark:hover:text-amber-400"
          }`}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
        </button>

        {/* Open project */}
        {!isCurrent && (
          <button
            type="button"
            onClick={() => onSwitch(hostname, orgId)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#4a7c59] dark:text-[#7cb88a] bg-[#4a7c59]/[0.06] dark:bg-[#7cb88a]/[0.06] hover:bg-[#4a7c59]/[0.12] dark:hover:bg-[#7cb88a]/[0.12] transition-colors"
          >
            Open
          </button>
        )}

        {/* Visit site */}
        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-[#b5afa3] dark:text-[#5c574d] hover:text-[#5c574d] dark:hover:text-[#b5afa3] transition-colors"
            title="Visit site"
          >
            <ExternalLink size={14} />
          </a>
        )}

        {/* Delete */}
        {onDelete && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="p-1.5 rounded-lg text-[#b5afa3] dark:text-[#5c574d] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
            title="Delete project"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
    </>
  )
})
