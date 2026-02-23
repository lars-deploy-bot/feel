import { CLAUDE_MODELS, getModelDisplayName } from "@webalive/shared"
import { describe, expect, it } from "vitest"
import { MODEL_OPTIONS, TIMEZONE_OPTIONS } from "../form-options"

describe("MODEL_OPTIONS", () => {
  it("has one entry per CLAUDE_MODELS value", () => {
    const modelValues = Object.values(CLAUDE_MODELS)
    expect(MODEL_OPTIONS).toHaveLength(modelValues.length)
    for (const id of modelValues) {
      expect(MODEL_OPTIONS.find(o => o.value === id)).toBeDefined()
    }
  })

  it("labels match getModelDisplayName", () => {
    for (const opt of MODEL_OPTIONS) {
      expect(opt.label).toBe(getModelDisplayName(opt.value))
    }
  })
})

describe("TIMEZONE_OPTIONS", () => {
  it("contains expected timezones", () => {
    const values = TIMEZONE_OPTIONS.map(t => t.value)
    expect(values).toContain("Europe/Amsterdam")
    expect(values).toContain("UTC")
    expect(values).toContain("America/New_York")
  })

  it("has no duplicate values", () => {
    const values = TIMEZONE_OPTIONS.map(t => t.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it("every entry has a non-empty label and value", () => {
    for (const tz of TIMEZONE_OPTIONS) {
      expect(tz.label.length).toBeGreaterThan(0)
      expect(tz.value.length).toBeGreaterThan(0)
    }
  })
})
