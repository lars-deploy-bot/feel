import { useState } from "react"
import type { BadgeVariant } from "@/components/ui/Badge"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { automationsApi } from "../automations.api"
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
  onToggled: () => void
}

export function JobRow({ job, onToggled }: JobRowProps) {
  const [toggling, setToggling] = useState(false)
  const status = statusBadge(job)
  const lastRun = runStatusBadge(job.last_run_status)

  async function handleToggle() {
    setToggling(true)
    try {
      await automationsApi.setActive(job.id, !job.is_active)
      onToggled()
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex items-center gap-6 py-3 hover:bg-surface-secondary/30 transition-colors duration-100 -mx-2 px-2 rounded-lg">
      {/* Name + hostname */}
      <div className="w-48 min-w-0 flex-shrink-0">
        <p className="text-[13px] text-text-primary font-medium truncate">{job.name}</p>
        <p className="text-[11px] text-text-tertiary truncate">{job.hostname}</p>
      </div>

      {/* Status */}
      <div className="w-20 flex-shrink-0">
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {/* Trigger */}
      <div className="w-36 flex-shrink-0 min-w-0">
        <span className="text-[12px] text-text-secondary">{job.trigger_type}</span>
        {job.cron_schedule && <span className="text-[11px] text-text-tertiary ml-1.5">{job.cron_schedule}</span>}
      </div>

      {/* Model */}
      <div className="w-24 flex-shrink-0">
        <span className="text-[12px] text-text-secondary tabular-nums">{job.action_model ?? "default"}</span>
      </div>

      {/* Last run status */}
      <div className="w-20 flex-shrink-0">
        <Badge variant={lastRun.variant}>{lastRun.label}</Badge>
      </div>

      {/* Last run at */}
      <div className="w-20 flex-shrink-0">
        <span className="text-[12px] text-text-secondary tabular-nums">{timeAgo(job.last_run_at)}</span>
      </div>

      {/* Runs (30d) */}
      <div className="w-16 flex-shrink-0">
        <span className="text-[12px] text-text-secondary tabular-nums">{job.runs_30d}</span>
      </div>

      {/* Avg duration */}
      <div className="w-20 flex-shrink-0">
        <span className="text-[12px] text-text-secondary tabular-nums">{formatDuration(job.avg_duration_ms)}</span>
      </div>

      {/* Failures */}
      <div className="w-16 flex-shrink-0">
        {job.failure_runs_30d > 0 ? (
          <span className="text-[12px] text-red-600 tabular-nums">{job.failure_runs_30d}</span>
        ) : (
          <span className="text-[12px] text-text-tertiary">0</span>
        )}
      </div>

      {/* Est. weekly cost */}
      <div className="w-16 flex-shrink-0">
        <span className="text-[12px] text-text-secondary tabular-nums">
          {job.estimated_weekly_cost_usd > 0 ? `$${job.estimated_weekly_cost_usd.toFixed(2)}` : "-"}
        </span>
      </div>

      {/* Action */}
      <div className="flex-shrink-0 ml-auto">
        <Button variant="ghost" size="sm" loading={toggling} onClick={handleToggle}>
          {job.is_active ? "Pause" : "Resume"}
        </Button>
      </div>
    </div>
  )
}
