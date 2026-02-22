import { describe, expect, it } from "vitest"
import { MIN_CRON_INTERVAL_MINUTES, validateCronSchedule } from "../validation"

describe("validateCronSchedule", () => {
  it("accepts schedules at the minimum interval", () => {
    const result = validateCronSchedule("*/5 * * * *", "UTC")

    expect(result.valid).toBe(true)
    expect(result.nextRuns).toBeDefined()
    expect(result.nextRuns?.length).toBeGreaterThan(0)
  })

  it("rejects every-minute schedules", () => {
    const result = validateCronSchedule("* * * * *", "UTC")

    expect(result.valid).toBe(false)
    expect(result.error).toContain(`every ${MIN_CRON_INTERVAL_MINUTES} minutes`)
  })

  it("rejects dense minute windows", () => {
    const result = validateCronSchedule("0-59 9 * * *", "UTC")

    expect(result.valid).toBe(false)
    expect(result.error).toContain(`every ${MIN_CRON_INTERVAL_MINUTES} minutes`)
  })
})
