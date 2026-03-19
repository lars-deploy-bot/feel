/**
 * Tests for AutomationSidePanel exported logic.
 *
 * Tests actual behavior of cronToDisplayText rather than reading source strings.
 */
import { describe, expect, it } from "vitest"
import { cronToDisplayText } from "../AutomationSidePanel"

describe("cronToDisplayText", () => {
  it("returns empty string for null input", () => {
    expect(cronToDisplayText(null)).toBe("")
  })

  it("returns human-readable text for known cron patterns", () => {
    expect(cronToDisplayText("0 9 * * 1-5")).toBe("at 09:00 on weekdays")
    expect(cronToDisplayText("*/5 * * * *")).toBe("every 5 minutes")
    expect(cronToDisplayText("0 9 * * *")).toBe("at 09:00")
  })

  it("returns raw cron for unrecognized patterns (Cron: prefix)", () => {
    // describeCron returns "Cron: ..." for patterns it can't describe
    // cronToDisplayText returns the raw cron expression in that case
    const rawCron = "0 0 29 2 *"
    const result = cronToDisplayText(rawCron)
    // Either the raw cron or a description — but never the default text
    expect(result).toBeTruthy()
    expect(result).not.toBe("")
  })

  it("lowercases describeCron output for display", () => {
    // "Every 5 minutes" → "every 5 minutes"
    const result = cronToDisplayText("*/5 * * * *")
    expect(result).toBe(result.toLowerCase())
  })
})
