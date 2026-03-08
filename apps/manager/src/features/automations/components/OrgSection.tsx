import { useState } from "react"
import type { OrgAutomationSummary } from "../automations.types"
import { JobRow } from "./JobRow"

interface OrgSectionProps {
  summary: OrgAutomationSummary
  onJobToggled: () => void
}

export function OrgSection({ summary, onJobToggled }: OrgSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const successRate =
    summary.total_runs_30d > 0 ? Math.round((summary.success_runs_30d / summary.total_runs_30d) * 100) : 0

  return (
    <div>
      {/* Org header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-3 transition-colors cursor-pointer group"
      >
        <svg
          className={`w-3 h-3 text-text-tertiary transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6 3l5 5-5 5V3z" />
        </svg>

        <span className="text-[13px] font-semibold text-text-primary">{summary.org_name}</span>

        <div className="flex items-center gap-4 text-[12px] text-text-tertiary">
          <span>
            <span className="text-text-secondary font-medium tabular-nums">{summary.active_jobs}</span>/
            {summary.total_jobs} active
          </span>
          <span>
            <span className="text-text-secondary font-medium tabular-nums">{summary.total_runs_30d}</span> runs
          </span>
          <span>
            <span className="text-text-secondary font-medium tabular-nums">{successRate}%</span> success
          </span>
          <span className="text-text-secondary font-medium tabular-nums">
            ${summary.estimated_monthly_cost_usd.toFixed(2)}/mo
          </span>
        </div>
      </button>

      {/* Jobs */}
      {expanded && (
        <div className="divide-y divide-border">
          {summary.jobs.map(job => (
            <JobRow key={job.id} job={job} onToggled={onJobToggled} />
          ))}
        </div>
      )}
    </div>
  )
}
