import type { AutomationJob } from "../automations.types"
import { formatCron } from "./format-cron"
import { RunRow } from "./RunRow"

interface JobDetailProps {
  job: AutomationJob
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-4 py-1.5">
      <span className="text-[12px] text-text-tertiary w-20 flex-shrink-0">{label}</span>
      <span className="text-[12px] text-text-primary min-w-0">{value}</span>
    </div>
  )
}

export function JobDetail({ job }: JobDetailProps) {
  return (
    <div className="pl-6 pb-4 pt-1">
      {/* Config */}
      <div className="mb-4">
        {job.description && <DetailField label="Description" value={job.description} />}
        {job.action_prompt && (
          <div className="flex gap-4 py-1.5">
            <span className="text-[12px] text-text-tertiary w-20 flex-shrink-0">Prompt</span>
            <span className="text-[12px] text-text-primary min-w-0 line-clamp-3 whitespace-pre-wrap">
              {job.action_prompt}
            </span>
          </div>
        )}
        <DetailField label="Model" value={job.action_model ?? "default"} />
        {job.trigger_type === "cron" && (
          <DetailField label="Schedule" value={formatCron(job.cron_schedule, job.cron_timezone)} />
        )}
        {job.trigger_type === "email" && <DetailField label="Email" value={job.email_address} />}
        <DetailField label="Target" value={job.action_target_page} />
        {job.skills && job.skills.length > 0 && <DetailField label="Skills" value={job.skills.join(", ")} />}
        <DetailField label="Site" value={job.hostname} />
        {job.next_run_at && <DetailField label="Next run" value={new Date(job.next_run_at).toLocaleString()} />}
        {job.last_run_error && (
          <div className="flex gap-4 py-1.5">
            <span className="text-[12px] text-text-tertiary w-20 flex-shrink-0">Last error</span>
            <span className="text-[12px] text-red-600 min-w-0 line-clamp-2">{job.last_run_error}</span>
          </div>
        )}
      </div>

      {/* Recent runs */}
      {job.recent_runs.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">Recent runs</p>
          <div className="divide-y divide-border-subtle">
            {job.recent_runs.map(run => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
