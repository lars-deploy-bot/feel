import { describe, expect, it } from "vitest"
import type { AutomationScheduleInput } from "../schedule-conversion"
import { scheduleResultToApiPayload } from "../schedule-conversion"

function buildResult(overrides: Partial<AutomationScheduleInput> = {}): AutomationScheduleInput {
  return {
    scheduleType: "custom",
    scheduleTime: "09:00",
    timezone: "Europe/Amsterdam",
    ...overrides,
  }
}

describe("scheduleResultToApiPayload", () => {
  it("converts one-time schedules to one-time trigger with timezone-aware run_at", () => {
    const runDate = "2026-03-01"
    const runTime = "14:30"

    const result = scheduleResultToApiPayload(
      buildResult({
        scheduleType: "once",
        scheduleDate: runDate,
        scheduleTime: runTime,
      }),
    )

    expect(result).toEqual({
      trigger_type: "one-time",
      run_at: "2026-03-01T13:30:00.000Z",
    })
  })

  it("uses the provided timezone for one-time schedules", () => {
    const result = scheduleResultToApiPayload(
      buildResult({
        scheduleType: "once",
        scheduleDate: "2026-03-01",
        scheduleTime: "14:30",
        timezone: "America/New_York",
      }),
    )

    expect(result).toEqual({
      trigger_type: "one-time",
      run_at: "2026-03-01T19:30:00.000Z",
    })
  })

  it("passes custom cron expressions through unchanged", () => {
    const result = scheduleResultToApiPayload(
      buildResult({
        scheduleType: "custom",
        cronExpression: "0 9 * * 1-5",
      }),
    )

    expect(result).toEqual({
      trigger_type: "cron",
      cron_schedule: "0 9 * * 1-5",
      cron_timezone: "Europe/Amsterdam",
    })
  })

  it("throws for one-time local times that do not exist in the selected timezone", () => {
    expect(() =>
      scheduleResultToApiPayload(
        buildResult({
          scheduleType: "once",
          scheduleDate: "2026-03-29",
          scheduleTime: "02:30",
          timezone: "Europe/Amsterdam",
        }),
      ),
    ).toThrow('Invalid local date/time "2026-03-29T02:30" for timezone "Europe/Amsterdam"')
  })

  it("throws when one-time schedule is missing scheduleDate", () => {
    expect(() =>
      scheduleResultToApiPayload(
        buildResult({
          scheduleType: "once",
          scheduleDate: undefined,
        }),
      ),
    ).toThrow("Missing scheduleDate for one-time automation")
  })

  it("throws when custom schedule is missing cronExpression", () => {
    expect(() =>
      scheduleResultToApiPayload(
        buildResult({
          scheduleType: "custom",
          cronExpression: undefined,
        }),
      ),
    ).toThrow("Missing cron expression for custom schedule")
  })
})
