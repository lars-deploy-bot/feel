import { Badge } from "@/components/ui/Badge"
import type { AutomationRun } from "../automations.types"
import { formatDuration, runStatusBadge, timeAgo } from "./format-helpers"

interface RunRowProps {
  run: AutomationRun
}

export function RunRow({ run }: RunRowProps) {
  const badge = runStatusBadge(run.status)

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
