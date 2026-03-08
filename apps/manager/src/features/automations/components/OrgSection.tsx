import { useState } from "react"
import type { OrgAutomationSummary } from "../automations.types"
import { CostBar } from "./CostBar"
import { JobRow } from "./JobRow"

interface OrgSectionProps {
  summary: OrgAutomationSummary
  maxCost: number
  onJobToggled: () => void
}

export function OrgSection({ summary, maxCost, onJobToggled }: OrgSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const successRate =
    summary.total_runs_30d > 0 ? Math.round((summary.success_runs_30d / summary.total_runs_30d) * 100) : 0

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Org header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-4 py-3 bg-surface-secondary/30 hover:bg-surface-secondary/50 transition-colors cursor-pointer"
      >
        <svg
          className={`w-3.5 h-3.5 text-text-tertiary transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6 3l5 5-5 5V3z" />
        </svg>

        <div className="flex-1 flex items-center gap-6 min-w-0">
          <span className="text-[14px] font-semibold text-text-primary truncate">{summary.org_name}</span>

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
          </div>
        </div>

        <div className="w-48">
          <CostBar cost={summary.estimated_monthly_cost_usd} maxCost={maxCost} />
        </div>
      </button>

      {/* Jobs table */}
      {expanded && (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-secondary/20">
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Name
              </th>
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Status
              </th>
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Trigger
              </th>
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Model
              </th>
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Last Run
              </th>
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Last Run At
              </th>
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Runs (30d)
              </th>
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Avg Duration
              </th>
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Failures
              </th>
              <th className="text-left py-1.5 px-3 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.jobs.map(job => (
              <JobRow key={job.id} job={job} onToggled={onJobToggled} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
