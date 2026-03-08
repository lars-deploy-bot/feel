import type { RunStatus } from "@webalive/database"
import type { BadgeVariant } from "@/components/ui/Badge"
import { Badge } from "@/components/ui/Badge"
import type { AutomationRun } from "../automations.types"

function runBadge(status: RunStatus): { label: string; variant: BadgeVariant } {
  if (status === "success") return { label: "success", variant: "success" }
  if (status === "failure") return { label: "failure", variant: "danger" }
  if (status === "running") return { label: "running", variant: "accent" }
  if (status === "pending") return { label: "pending", variant: "default" }
  if (status === "skipped") return { label: "skipped", variant: "warning" }
  return { label: status, variant: "warning" }
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface RunRowProps {
  run: AutomationRun
}

export function RunRow({ run }: RunRowProps) {
  const badge = runBadge(run.status)

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-16 flex-shrink-0">
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <span className="text-[12px] text-text-secondary tabular-nums w-16 flex-shrink-0">{timeAgo(run.started_at)}</span>
      <span className="text-[12px] text-text-secondary tabular-nums w-16 flex-shrink-0">
        {formatDuration(run.duration_ms)}
      </span>
      {run.triggered_by && <span className="text-[11px] text-text-tertiary">{run.triggered_by}</span>}
      {run.error && <span className="text-[12px] text-red-600 truncate min-w-0">{run.error}</span>}
    </div>
  )
}
