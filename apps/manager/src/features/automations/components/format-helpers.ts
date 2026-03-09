import type { RunStatus } from "@webalive/database"
import type { BadgeVariant } from "@/components/ui/Badge"

export function runStatusBadge(status: RunStatus | string | null): { label: string; variant: BadgeVariant } {
  if (!status) return { label: "never", variant: "default" }
  if (status === "success") return { label: "success", variant: "success" }
  if (status === "failure") return { label: "failure", variant: "danger" }
  if (status === "running") return { label: "running", variant: "accent" }
  if (status === "pending") return { label: "pending", variant: "default" }
  if (status === "skipped") return { label: "skipped", variant: "warning" }
  return { label: status, variant: "warning" }
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "-"
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "-"
  const timestamp = Date.parse(dateStr)
  if (Number.isNaN(timestamp)) return "-"
  const diff = Date.now() - timestamp
  if (diff < -60_000) return "-"
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
