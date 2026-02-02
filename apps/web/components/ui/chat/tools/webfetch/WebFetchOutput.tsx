import { CheckCircle2, ExternalLink, Globe } from "lucide-react"

interface WebFetchOutputProps {
  /** The response text from fetching and processing the URL */
  content?: string
  /** URL that was fetched (from tool input) */
  url?: string
  /** Error message if fetch failed */
  error?: string
}

/**
 * Extract hostname for display
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function WebFetchOutput({ content, url, error }: WebFetchOutputProps) {
  if (error) {
    return (
      <div className="text-xs text-red-600 dark:text-red-400 p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
        Failed to fetch: {error}
      </div>
    )
  }

  // Success state - show fetched content
  const hostname = url ? getHostname(url) : "website"

  return (
    <div className="space-y-2">
      {/* Header showing success */}
      <div className="flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span>Fetched content from</span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Globe className="w-3 h-3" />
            {hostname}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Content preview */}
      {content && (
        <div className="text-xs text-black/50 dark:text-white/50 font-diatype-mono leading-relaxed overflow-auto max-h-60 p-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] whitespace-pre-wrap">
          {content.length > 2000 ? `${content.slice(0, 2000)}...` : content}
        </div>
      )}
    </div>
  )
}
