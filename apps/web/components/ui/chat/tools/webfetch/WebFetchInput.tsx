import { Globe } from "lucide-react"

interface WebFetchInputProps {
  url: string
  prompt: string
}

/**
 * Extract a clean display label from the URL.
 * Strips protocol and www, keeps host + first path segment.
 */
function getUrlLabel(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, "")
    // Include first path segment if meaningful
    const pathParts = parsed.pathname.split("/").filter(Boolean)
    if (pathParts.length > 0 && pathParts[0].length < 30) {
      return `${host}/${pathParts[0]}`
    }
    return host
  } catch {
    // Fallback for invalid URLs
    return url.length > 40 ? `${url.slice(0, 40)}...` : url
  }
}

/**
 * Truncate prompt to a reasonable display length
 */
function truncatePrompt(prompt: string, maxLength = 60): string {
  if (prompt.length <= maxLength) return prompt
  return `${prompt.slice(0, maxLength)}...`
}

export function WebFetchInput({ url, prompt }: WebFetchInputProps) {
  const urlLabel = getUrlLabel(url)
  const truncatedPrompt = truncatePrompt(prompt)

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-start gap-2">
        <Globe className="w-4 h-4 text-black/40 dark:text-white/40 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-black/60 dark:text-white/60 font-medium mb-1">Fetching: {urlLabel}</div>
          <div className="text-black/50 dark:text-white/50">{truncatedPrompt}</div>
        </div>
      </div>
      <div className="text-black/30 dark:text-white/30 font-diatype-mono text-[10px] truncate" title={url}>
        {url}
      </div>
    </div>
  )
}
