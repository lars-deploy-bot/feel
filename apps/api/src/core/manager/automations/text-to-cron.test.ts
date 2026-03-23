import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@webalive/automation", () => ({
  textToCron: vi.fn(),
}))

vi.mock("../../../config/env", () => ({
  env: { GROQ_API_SECRET: "test-groq-key" },
}))

import { textToCron as textToCronBase } from "@webalive/automation"
import { _cacheSize, _clearCache, textToCron } from "./text-to-cron"

describe("textToCron (cached)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearCache()
  })

  it("calls Groq on first request", async () => {
    vi.mocked(textToCronBase).mockResolvedValueOnce({
      cron: "0 9 * * *",
      description: "Every day at 9:00 AM",
      timezone: null,
    })

    const result = await textToCron("every day at 9am")
    expect(result.cron).toBe("0 9 * * *")
    expect(textToCronBase).toHaveBeenCalledOnce()
    expect(textToCronBase).toHaveBeenCalledWith("every day at 9am", "test-groq-key")
  })

  it("returns cached result on second request — no Groq call", async () => {
    vi.mocked(textToCronBase).mockResolvedValueOnce({
      cron: "0 9 * * *",
      description: "Every day at 9:00 AM",
      timezone: null,
    })

    await textToCron("every day at 9am")
    const result = await textToCron("every day at 9am")

    expect(result.cron).toBe("0 9 * * *")
    expect(textToCronBase).toHaveBeenCalledOnce()
    expect(_cacheSize()).toBe(1)
  })

  it("normalizes cache key — case and whitespace insensitive", async () => {
    vi.mocked(textToCronBase).mockResolvedValueOnce({
      cron: "0 9 * * *",
      description: "Every day at 9:00 AM",
      timezone: null,
    })

    await textToCron("Every Day At 9am")
    const result = await textToCron("  every day at 9am  ")

    expect(result.cron).toBe("0 9 * * *")
    expect(textToCronBase).toHaveBeenCalledOnce()
  })

  it("caches different texts separately", async () => {
    vi.mocked(textToCronBase)
      .mockResolvedValueOnce({ cron: "0 9 * * *", description: "Daily at 9", timezone: null })
      .mockResolvedValueOnce({ cron: "0 9 * * 1-5", description: "Weekdays at 9", timezone: null })

    await textToCron("every day at 9am")
    await textToCron("weekdays at 9am")

    expect(textToCronBase).toHaveBeenCalledTimes(2)
    expect(_cacheSize()).toBe(2)
  })

  it("does not cache Groq errors", async () => {
    vi.mocked(textToCronBase).mockRejectedValueOnce(new Error("Groq API error"))
    vi.mocked(textToCronBase).mockResolvedValueOnce({
      cron: "0 9 * * *",
      description: "Daily at 9",
      timezone: null,
    })

    await expect(textToCron("every day at 9am")).rejects.toThrow("Groq API error")
    expect(_cacheSize()).toBe(0)

    const result = await textToCron("every day at 9am")
    expect(result.cron).toBe("0 9 * * *")
    expect(textToCronBase).toHaveBeenCalledTimes(2)
  })
})
