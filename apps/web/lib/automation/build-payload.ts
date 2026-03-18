/**
 * Shared automation API payload builders.
 *
 * Every UI flow (chat form, side panel, settings) calls these
 * instead of hand-rolling the create/update request objects.
 */

import type { AutomationConfigResult } from "@/components/ai/AutomationConfig"
import type { AutomationFormData } from "@/components/automations/types"
import type { ReqInput, TriggerType } from "@/lib/api/schemas"
import { isScheduleTrigger, validateRequest } from "@/lib/api/schemas"
import { scheduleResultToApiPayload } from "@/lib/automation/schedule-conversion"

// ── Create ──────────────────────────────────────────────────────────

export function buildCreatePayload(data: AutomationFormData) {
  // If schedule_text is set, send it to the API for server-side conversion.
  // Otherwise fall back to raw cron_schedule (legacy/direct cron input).
  const scheduleFields =
    isScheduleTrigger(data.trigger_type) && data.trigger_type === "cron"
      ? data.schedule_text
        ? { schedule_text: data.schedule_text, cron_timezone: data.cron_timezone }
        : { cron_schedule: data.cron_schedule, cron_timezone: data.cron_timezone }
      : {}

  const fields: ReqInput<"automations/create"> = {
    site_id: data.site_id,
    name: data.name,
    trigger_type: data.trigger_type,
    action_type: data.action_type,
    description: data.description || null,
    is_active: data.is_active,
    skills: data.skills,
    action_timeout_seconds: data.action_timeout_seconds,
    action_model: data.action_model,
    ...scheduleFields,
    ...(isScheduleTrigger(data.trigger_type) && data.trigger_type === "one-time" ? { run_at: data.run_at } : {}),
    ...(data.action_type === "prompt" ? { action_prompt: data.action_prompt } : {}),
    ...(data.action_type === "sync"
      ? { action_source: data.action_source, action_target_page: data.action_target_page }
      : {}),
  }

  return validateRequest("automations/create", fields)
}

// ── Update ──────────────────────────────────────────────────────────

export function buildUpdatePayload(data: AutomationFormData, existingTriggerType: TriggerType) {
  const scheduleFields =
    isScheduleTrigger(existingTriggerType) && existingTriggerType === "cron"
      ? data.schedule_text
        ? { schedule_text: data.schedule_text, cron_timezone: data.cron_timezone }
        : { cron_schedule: data.cron_schedule, cron_timezone: data.cron_timezone }
      : {}

  const fields: ReqInput<"automations/update"> = {
    name: data.name,
    description: data.description || null,
    is_active: data.is_active,
    skills: data.skills,
    action_timeout_seconds: data.action_timeout_seconds,
    action_model: data.action_model,
    ...scheduleFields,
    ...(isScheduleTrigger(existingTriggerType) && existingTriggerType === "one-time" ? { run_at: data.run_at } : {}),
    ...(data.action_type === "prompt" ? { action_prompt: data.action_prompt } : {}),
    ...(data.action_type === "sync"
      ? { action_source: data.action_source, action_target_page: data.action_target_page }
      : {}),
  }

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
  const isCron = result.scheduleType !== "once"

  // For cron triggers, pass schedule_text so the API converts server-side.
  // For one-time triggers, compute run_at directly.
  if (!isCron) {
    const schedule = scheduleResultToApiPayload(result)
    return {
      site_id: result.siteId,
      name: result.name,
      description: "",
      trigger_type: "one-time",
      schedule_text: "",
      cron_schedule: "",
      cron_timezone: "",
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

  return {
    site_id: result.siteId,
    name: result.name,
    description: "",
    trigger_type: "cron",
    schedule_text: result.scheduleText || "",
    cron_schedule: "",
    cron_timezone: result.timezone,
    run_at: "",
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
