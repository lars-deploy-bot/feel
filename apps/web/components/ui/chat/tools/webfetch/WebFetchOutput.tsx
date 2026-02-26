"use client"

import { AlertCircle } from "lucide-react"

interface WebFetchOutputProps {
  /** The response text from fetching and processing the URL */
  content?: string
  /** URL that was fetched (from tool input) */
  url?: string
  /** Error message if fetch failed */
  error?: string
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function WebFetchOutput({ content, url, error }: WebFetchOutputProps) {
  const hostname = url ? getHostname(url) : "website"

  if (error) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/[0.08] dark:bg-red-500/[0.12] text-xs">
        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        <span className="text-red-600 dark:text-red-400">Failed to fetch {hostname}</span>
      </div>
    )
  }

  if (!content) return null

  return (
    <div className="p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] max-h-48 overflow-auto">
      <pre className="text-[11px] text-black/60 dark:text-white/60 font-diatype-mono leading-relaxed whitespace-pre-wrap break-words">
        {content.length > 3000 ? `${content.slice(0, 3000)}...` : content}
      </pre>
    </div>
  )
}
