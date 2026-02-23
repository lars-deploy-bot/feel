/**
 * Shared automation API payload builders.
 *
 * Every UI flow (chat form, side panel, settings) calls these
 * instead of hand-rolling the create/update request objects.
 */

import type { AutomationConfigResult } from "@/components/ai/AutomationConfig"
import type { AutomationFormData } from "@/components/automations/types"
import type { TriggerType } from "@/lib/api/schemas"
import { isScheduleTrigger, validateRequest } from "@/lib/api/schemas"
import { scheduleResultToApiPayload } from "@/lib/automation/schedule-conversion"

// ── Create ──────────────────────────────────────────────────────────

export function buildCreatePayload(data: AutomationFormData) {
  const fields: Record<string, unknown> = {
    site_id: data.site_id,
    name: data.name,
    trigger_type: data.trigger_type,
    action_type: data.action_type,
    description: data.description || null,
    is_active: data.is_active,
    skills: data.skills,
    action_timeout_seconds: data.action_timeout_seconds,
    action_model: data.action_model,
  }

  assignScheduleFields(fields, data.trigger_type, data)
  assignActionFields(fields, data)

  return validateRequest("automations/create", fields)
}

// ── Update ──────────────────────────────────────────────────────────

export function buildUpdatePayload(data: AutomationFormData, existingTriggerType: TriggerType) {
  const fields: Record<string, unknown> = {
    name: data.name,
    description: data.description || null,
    is_active: data.is_active,
    skills: data.skills,
    action_timeout_seconds: data.action_timeout_seconds,
    action_model: data.action_model,
  }

  assignScheduleFields(fields, existingTriggerType, data)
  assignActionFields(fields, data)

  return validateRequest("automations/update", fields)
}

// ── Chat form adapter ───────────────────────────────────────────────

/**
 * Convert the chat-flow AutomationConfigResult into AutomationFormData
 * so it can be passed to buildCreatePayload. Schedule conversion
 * (including timezone-aware one-time dates) is handled by
 * scheduleResultToApiPayload.
 */
export function configResultToFormData(result: AutomationConfigResult): AutomationFormData {
  const schedule = scheduleResultToApiPayload(result)

  return {
    site_id: result.siteId,
    name: result.name,
    description: "",
    trigger_type: schedule.trigger_type === "one-time" ? "one-time" : "cron",
    cron_schedule: schedule.trigger_type === "cron" ? schedule.cron_schedule : "",
    cron_timezone: schedule.trigger_type === "cron" ? schedule.cron_timezone : "",
    run_at: schedule.trigger_type === "one-time" ? schedule.run_at : "",
    action_type: "prompt",
    action_prompt: result.prompt,
    action_source: "",
    action_target_page: "",
    action_timeout_seconds: null,
    action_model: result.model,
    skills: [],
    is_active: true,
  }
}

// ── Internals ───────────────────────────────────────────────────────

function assignScheduleFields(
  fields: Record<string, unknown>,
  triggerType: TriggerType,
  data: Pick<AutomationFormData, "cron_schedule" | "cron_timezone" | "run_at">,
) {
  if (!isScheduleTrigger(triggerType)) return

  if (triggerType === "cron") {
    fields.cron_schedule = data.cron_schedule
    fields.cron_timezone = data.cron_timezone
  } else if (triggerType === "one-time") {
    fields.run_at = data.run_at
  }
}

function assignActionFields(
  fields: Record<string, unknown>,
  data: Pick<AutomationFormData, "action_type" | "action_prompt" | "action_source" | "action_target_page">,
) {
  if (data.action_type === "prompt") {
    fields.action_prompt = data.action_prompt
  } else if (data.action_type === "sync") {
    fields.action_source = data.action_source
    fields.action_target_page = data.action_target_page
  }
}
