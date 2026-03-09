import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { timeAgo } from "@/features/automations/components/format-helpers"

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-09T00:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns '-' for invalid dates", () => {
    expect(timeAgo("not-a-date")).toBe("-")
  })

  it("returns 'just now' for timestamps within the current minute", () => {
    expect(timeAgo("2026-03-08T23:59:45.000Z")).toBe("just now")
  })

  it("returns '-' for timestamps that are meaningfully in the future", () => {
    expect(timeAgo("2026-03-09T00:05:00.000Z")).toBe("-")
  })

  it("renders elapsed minutes for valid past timestamps", () => {
    expect(timeAgo("2026-03-08T23:30:00.000Z")).toBe("30m ago")
  })
})
