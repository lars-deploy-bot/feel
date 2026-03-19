import { describe, expect, it } from "vitest"
import type { AutomationFormData } from "@/components/automations/types"
import { buildCreatePayload, buildUpdatePayload, configResultToFormData } from "../build-payload"

function buildFormData(overrides: Partial<AutomationFormData> = {}): AutomationFormData {
  return {
    site_id: "site-1",
    name: "Test Automation",
    description: "",
    trigger_type: "cron",
    schedule_text: "",
    cron_schedule: "0 9 * * *",
    cron_timezone: "Europe/Amsterdam",
    run_at: "",
    action_type: "prompt",
    action_prompt: "Do something",
    action_source: "",
    action_target_page: "",
    action_timeout_seconds: null,
    action_model: null,
    skills: [],
    is_active: true,
    ...overrides,
  }
}

describe("buildCreatePayload", () => {
  it("includes cron fields for cron trigger", () => {
    const data = buildFormData({ trigger_type: "cron", cron_schedule: "0 9 * * 1-5", cron_timezone: "UTC" })
    const payload = buildCreatePayload(data)

    expect(payload).toMatchObject({
      trigger_type: "cron",
      cron_schedule: "0 9 * * 1-5",
      cron_timezone: "UTC",
    })
    // run_at should not be in the payload
    expect("run_at" in payload).toBe(false)
  })

  it("sends schedule_text instead of cron_schedule when schedule_text is set", () => {
    const data = buildFormData({
      trigger_type: "cron",
      schedule_text: "every weekday at 9am",
      cron_schedule: "",
      cron_timezone: "Europe/Amsterdam",
    })
    const payload = buildCreatePayload(data)

    expect(payload).toMatchObject({
      trigger_type: "cron",
      schedule_text: "every weekday at 9am",
      cron_timezone: "Europe/Amsterdam",
    })
    // When schedule_text is set, cron_schedule should not be sent
    expect("cron_schedule" in payload).toBe(false)
  })

  it("includes run_at for one-time trigger", () => {
    const data = buildFormData({
      trigger_type: "one-time",
      run_at: "2026-03-01T13:30:00.000Z",
      cron_schedule: "",
      cron_timezone: "",
    })
    const payload = buildCreatePayload(data)

    expect(payload).toMatchObject({
      trigger_type: "one-time",
      run_at: "2026-03-01T13:30:00.000Z",
    })
    expect("cron_schedule" in payload).toBe(false)
    expect("cron_timezone" in payload).toBe(false)
  })

  it("omits schedule fields for event triggers", () => {
    const data = buildFormData({ trigger_type: "email", cron_schedule: "leftover", run_at: "leftover" })
    const payload = buildCreatePayload(data)

    expect(payload).toMatchObject({ trigger_type: "email" })
    expect("cron_schedule" in payload).toBe(false)
    expect("run_at" in payload).toBe(false)
  })

  it("includes action_prompt for prompt action type", () => {
    const data = buildFormData({ action_type: "prompt", action_prompt: "Run daily sync" })
    const payload = buildCreatePayload(data)

    expect(payload).toMatchObject({ action_prompt: "Run daily sync" })
    expect("action_source" in payload).toBe(false)
  })

  it("includes required fields", () => {
    const payload = buildCreatePayload(buildFormData())

    expect(payload).toMatchObject({
      site_id: "site-1",
      name: "Test Automation",
      action_type: "prompt",
      is_active: true,
      skills: [],
    })
  })
})

describe("buildUpdatePayload", () => {
  it("includes cron fields for cron trigger type", () => {
    const data = buildFormData({ cron_schedule: "30 14 * * *" })
    const payload = buildUpdatePayload(data, "cron")

    expect(payload).toMatchObject({
      cron_schedule: "30 14 * * *",
      cron_timezone: "Europe/Amsterdam",
    })
  })

  it("sends schedule_text for cron trigger when set", () => {
    const data = buildFormData({ schedule_text: "daily at 2:30pm", cron_schedule: "" })
    const payload = buildUpdatePayload(data, "cron")

    expect(payload).toMatchObject({
      schedule_text: "daily at 2:30pm",
      cron_timezone: "Europe/Amsterdam",
    })
    expect("cron_schedule" in payload).toBe(false)
  })

  it("strips schedule fields for event triggers", () => {
    const data = buildFormData({ cron_schedule: "leftover" })
    const payload = buildUpdatePayload(data, "webhook")

    expect("cron_schedule" in payload).toBe(false)
    expect("run_at" in payload).toBe(false)
  })

  it("does not include site_id or trigger_type (immutable on update)", () => {
    const payload = buildUpdatePayload(buildFormData(), "cron")

    expect("site_id" in payload).toBe(false)
    expect("trigger_type" in payload).toBe(false)
  })
})

describe("configResultToFormData", () => {
  it("converts recurring schedule to form data with schedule_text", () => {
    const result = {
      siteId: "site-1",
      siteName: "test.test.example",
      name: "Daily Task",
      prompt: "Update content",
      model: "claude-sonnet-4-6" as const,
      scheduleType: "custom" as const,
      scheduleText: "every day at 9am",
      scheduleTime: "09:00",
      timezone: "Europe/Amsterdam",
    }

    const formData = configResultToFormData(result)

    expect(formData).toMatchObject({
      site_id: "site-1",
      name: "Daily Task",
      trigger_type: "cron",
      schedule_text: "every day at 9am",
      cron_schedule: "",
      cron_timezone: "Europe/Amsterdam",
      action_type: "prompt",
      action_prompt: "Update content",
      action_model: "claude-sonnet-4-6",
      is_active: true,
    })
  })

  it("converts one-time schedule with timezone-aware run_at", () => {
    const result = {
      siteId: "site-1",
      siteName: "test.test.example",
      name: "One-time Task",
      prompt: "Do once",
      model: "claude-sonnet-4-6" as const,
      scheduleType: "once" as const,
      scheduleText: "",
      scheduleTime: "14:30",
      scheduleDate: "2026-03-01",
      timezone: "Europe/Amsterdam",
    }

    const formData = configResultToFormData(result)

    expect(formData).toMatchObject({
      trigger_type: "one-time",
      // 14:30 Amsterdam (CET, UTC+1) = 13:30 UTC
      run_at: "2026-03-01T13:30:00.000Z",
    })
    expect(formData.cron_schedule).toBe("")
    expect(formData.schedule_text).toBe("")
  })
})
