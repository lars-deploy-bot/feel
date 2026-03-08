import { automationsApi } from "../automations.api"
import type { AutomationJob } from "../automations.types"
import { EditableField } from "./EditableField"
import { EditableSchedule } from "./EditableSchedule"
import { RunRow } from "./RunRow"

interface JobDetailProps {
  job: AutomationJob
  onChanged: () => void
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

export function JobDetail({ job, onChanged }: JobDetailProps) {
  async function saveField(field: string, value: string) {
    await automationsApi.update(job.id, { [field]: value || null })
    onChanged()
  }

  return (
    <div className="pl-6 pb-4 pt-1">
      {/* Config */}
      <div className="mb-4">
        <EditableField label="Name" value={job.name} onSave={v => saveField("name", v)} />
        <EditableField
          label="Description"
          value={job.description}
          onSave={v => saveField("description", v)}
          placeholder="No description"
        />
        <EditableField
          label="Prompt"
          value={job.action_prompt}
          onSave={v => saveField("action_prompt", v)}
          placeholder="No prompt"
          multiline
        />
        <EditableField label="Model" value={job.action_model ?? "default"} onSave={v => saveField("action_model", v)} />
        {job.trigger_type === "cron" && (
          <EditableSchedule
            jobId={job.id}
            cronSchedule={job.cron_schedule}
            cronTimezone={job.cron_timezone}
            onSaved={onChanged}
          />
        )}
        {job.trigger_type === "email" && <DetailField label="Email" value={job.email_address} />}
        <EditableField
          label="Target"
          value={job.action_target_page}
          onSave={v => saveField("action_target_page", v)}
          placeholder="No target page"
        />
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
