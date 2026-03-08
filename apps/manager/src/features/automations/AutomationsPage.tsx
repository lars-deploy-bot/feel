import { EmptyState } from "@/components/data/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/Button"
import { Spinner } from "@/components/ui/Spinner"
import { OrgSection } from "./components/OrgSection"
import { useAutomations } from "./hooks/useAutomations"

export function AutomationsPage() {
  const { orgSummaries, loading, error, refresh } = useAutomations()

  if (loading && orgSummaries.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error && orgSummaries.length === 0) {
    return (
      <EmptyState
        title="Failed to load automations"
        description={error}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    )
  }

  const totalJobs = orgSummaries.reduce((s, o) => s + o.total_jobs, 0)
  const activeJobs = orgSummaries.reduce((s, o) => s + o.active_jobs, 0)
  const totalRuns = orgSummaries.reduce((s, o) => s + o.total_runs_30d, 0)
  const totalCost = orgSummaries.reduce((s, o) => s + o.estimated_monthly_cost_usd, 0)

  return (
    <>
      <PageHeader
        title="Automations"
        description={`${totalJobs} job${totalJobs !== 1 ? "s" : ""} across ${orgSummaries.length} org${orgSummaries.length !== 1 ? "s" : ""}`}
      />

      {/* Stats */}
      <div className="flex gap-10 pb-8 border-b border-border">
        <div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums tracking-tight">{activeJobs}</p>
          <p className="text-[12px] text-text-tertiary mt-1">Active jobs</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums tracking-tight">{totalRuns}</p>
          <p className="text-[12px] text-text-tertiary mt-1">Runs (30d)</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums tracking-tight">
            ${totalCost.toFixed(2)}
          </p>
          <p className="text-[12px] text-text-tertiary mt-1">Est. monthly</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-text-primary tabular-nums tracking-tight">
            ${activeJobs > 0 ? (totalCost / activeJobs).toFixed(2) : "0.00"}
          </p>
          <p className="text-[12px] text-text-tertiary mt-1">Avg / job</p>
        </div>
      </div>

      {/* Org sections */}
      <div className="mt-6">
        {orgSummaries.map(summary => (
          <OrgSection key={summary.org_id} summary={summary} onChanged={refresh} />
        ))}
      </div>

      {orgSummaries.length === 0 && <EmptyState title="No automations" description="No automation jobs found" />}
    </>
  )
}
