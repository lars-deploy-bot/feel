const AVATAR_COLORS = [
  "bg-blue-50 text-blue-500",
  "bg-emerald-50 text-emerald-500",
  "bg-amber-50 text-amber-500",
  "bg-violet-50 text-violet-500",
  "bg-rose-50 text-rose-500",
  "bg-sky-50 text-sky-500",
]

export function avatarColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function statusVariant(status: string) {
  if (status === "active") return "success" as const
  if (status === "suspended") return "danger" as const
  return "default" as const
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function roleBadgeVariant(role: string) {
  if (role === "owner") return "accent" as const
  if (role === "admin") return "warning" as const
  return "default" as const
}
