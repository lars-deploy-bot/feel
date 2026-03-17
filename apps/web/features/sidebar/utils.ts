/** Derive a clean project name: "larry.alive.best" → "Larry", "alive" → "Alive" */
export function deriveProjectName(domain: string): string {
  const first = domain.split(".")[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

/** Format timestamp as compact relative time: "now", "5m", "2h", "3d", "2w", "3mo" */
export function formatTimestamp(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w`
  return `${Math.floor(days / 30)}mo`
}

/** Extract lowercase workspace slug: "larry.alive.best" → "larry" */
export function workspaceSlug(domain: string): string {
  return domain.split(".")[0]
}
