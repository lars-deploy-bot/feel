import type { BadgeVariant } from "@/components/ui/Badge"
import { Badge } from "@/components/ui/Badge"
import type { AutomationJob } from "../automations.types"

function statusBadge(job: AutomationJob): { label: string; variant: BadgeVariant } {
  if (!job.is_active) return { label: "disabled", variant: "default" }
  if (job.status === "running") return { label: "running", variant: "accent" }
  return { label: "active", variant: "success" }
}

function runStatusBadge(status: string | null): { label: string; variant: BadgeVariant } {
  if (!status) return { label: "never", variant: "default" }
  if (status === "success") return { label: "success", variant: "success" }
  if (status === "failure") return { label: "failure", variant: "danger" }
  if (status === "running") return { label: "running", variant: "accent" }
  return { label: status, variant: "warning" }
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-"
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "-"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

interface JobRowProps {
  job: AutomationJob
}

export function JobRow({ job }: JobRowProps) {
  const status = statusBadge(job)
  const lastRun = runStatusBadge(job.last_run_status)

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-surface-secondary/30 transition-colors">
      <td className="py-2 px-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-text-primary font-medium">{job.name}</span>
          <span className="text-[11px] text-text-tertiary">{job.hostname}</span>
        </div>
      </td>
      <td className="py-2 px-3">
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className="py-2 px-3">
        <span className="text-[12px] text-text-secondary">{job.trigger_type}</span>
        {job.cron_schedule && <span className="text-[11px] text-text-tertiary ml-1.5">{job.cron_schedule}</span>}
      </td>
      <td className="py-2 px-3">
        <span className="text-[12px] text-text-secondary tabular-nums">{job.action_model ?? "default"}</span>
      </td>
      <td className="py-2 px-3">
        <Badge variant={lastRun.variant}>{lastRun.label}</Badge>
      </td>
      <td className="py-2 px-3">
        <span className="text-[12px] text-text-secondary tabular-nums">{timeAgo(job.last_run_at)}</span>
      </td>
      <td className="py-2 px-3">
        <span className="text-[12px] text-text-secondary tabular-nums">{job.runs_30d}</span>
      </td>
      <td className="py-2 px-3">
        <span className="text-[12px] text-text-secondary tabular-nums">{formatDuration(job.avg_duration_ms)}</span>
      </td>
      <td className="py-2 px-3">
        {job.failure_runs_30d > 0 ? (
          <span className="text-[12px] text-red-600 tabular-nums">{job.failure_runs_30d}</span>
        ) : (
          <span className="text-[12px] text-text-tertiary">0</span>
        )}
      </td>
    </tr>
  )
}
