import { inputClass, selectChevron } from "@/components/automations/form-styles"
import type { TriggerType } from "@/lib/api/schemas"
import { TIMEZONE_OPTIONS } from "@/lib/automation/form-options"
import type { AutomationJob } from "@/lib/hooks/useSettingsQueries"
import { ScheduleInput } from "../ScheduleInput"

interface ScheduleTriggerProps {
  isEditing: boolean
  isOneTime: boolean
  onOneTimeChange: (v: boolean) => void
  scheduleText: string
  onScheduleTextChange: (v: string) => void
  oneTimeDate: string
  onOneTimeDateChange: (v: string) => void
  oneTimeTime: string
  onOneTimeTimeChange: (v: string) => void
  timezone: string
  onTimezoneChange: (v: string) => void
  effectiveIsOneTime: boolean
}

interface EventTriggerProps {
  triggerType: TriggerType
  editingJob: AutomationJob
}

interface TriggerTabProps {
  hasSchedule: boolean
  schedule?: ScheduleTriggerProps
  event?: EventTriggerProps
}

export function TriggerTab({ hasSchedule, schedule, event }: TriggerTabProps) {
  if (hasSchedule && schedule) {
    return <ScheduleTrigger {...schedule} />
  }

  if (!hasSchedule && event) {
    return <EventTrigger {...event} />
  }

  return <p className="text-sm text-black/40 dark:text-white/40">Trigger type is set when creating the agent.</p>
}

function ScheduleTrigger({
  isEditing,
  isOneTime,
  onOneTimeChange,
  scheduleText,
  onScheduleTextChange,
  oneTimeDate,
  onOneTimeDateChange,
  oneTimeTime,
  onOneTimeTimeChange,
  timezone,
  onTimezoneChange,
  effectiveIsOneTime,
}: ScheduleTriggerProps) {
  return (
    <div className="space-y-3">
      <ScheduleInput
        value={scheduleText}
        onChange={onScheduleTextChange}
        showOneTime={true}
        lockOneTimeToggle={isEditing}
        isOneTime={isOneTime}
        onOneTimeChange={onOneTimeChange}
        oneTimeDate={oneTimeDate}
        oneTimeTime={oneTimeTime}
        onOneTimeDateChange={onOneTimeDateChange}
        onOneTimeTimeChange={onOneTimeTimeChange}
      />

      {!effectiveIsOneTime && (
        <div className="space-y-1.5">
          <label htmlFor="auto-tz" className="text-xs font-medium text-black/60 dark:text-white/60">
            Timezone
          </label>
          <select
            id="auto-tz"
            value={timezone}
            onChange={e => onTimezoneChange(e.target.value)}
            className={`${inputClass} cursor-pointer appearance-none`}
            style={selectChevron}
          >
            {TIMEZONE_OPTIONS.map(tz => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

function EventTrigger({ triggerType, editingJob }: EventTriggerProps) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.03]">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-black dark:text-white">
          {triggerType === "email" ? "Email trigger" : "Webhook trigger"}
        </p>
        {triggerType === "email" && editingJob.email_address && (
          <p className="text-[11px] text-black/40 dark:text-white/40 mt-0.5 font-mono truncate">
            {editingJob.email_address}
          </p>
        )}
      </div>
    </div>
  )
}
