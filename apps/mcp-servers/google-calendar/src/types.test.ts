import { describe, expect, it } from "vitest"
import { DeleteEventDraftSchema, EventDraftSchema } from "./types.js"

const baseDraft = {
  summary: "Planning",
  start: { dateTime: "2026-02-18T09:00:00" },
  end: { dateTime: "2026-02-18T09:30:00" },
}

describe("EventDraftSchema datetime formats", () => {
  it("accepts local datetime strings", () => {
    const parsed = EventDraftSchema.safeParse(baseDraft)
    expect(parsed.success).toBe(true)
  })

  it("accepts UTC Z datetime strings", () => {
    const parsed = EventDraftSchema.safeParse({
      ...baseDraft,
      start: { dateTime: "2026-02-18T09:00:00Z" },
      end: { dateTime: "2026-02-18T09:30:00Z" },
    })
    expect(parsed.success).toBe(true)
  })

  it("accepts offset datetime strings", () => {
    const parsed = EventDraftSchema.safeParse({
      ...baseDraft,
      start: { dateTime: "2026-02-18T09:00:00-05:00" },
      end: { dateTime: "2026-02-18T09:30:00-05:00" },
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects invalid datetime strings", () => {
    const parsed = EventDraftSchema.safeParse({
      ...baseDraft,
      start: { dateTime: "not-a-date" },
    })
    expect(parsed.success).toBe(false)
  })
})

describe("DeleteEventDraftSchema", () => {
  it("accepts required delete identifiers", () => {
    const parsed = DeleteEventDraftSchema.safeParse({
      eventId: "evt_123",
      calendarId: "primary",
    })
    expect(parsed.success).toBe(true)
  })

  it("defaults calendarId to primary", () => {
    const parsed = DeleteEventDraftSchema.parse({
      eventId: "evt_123",
    })
    expect(parsed.calendarId).toBe("primary")
  })

  it("rejects empty eventId", () => {
    const parsed = DeleteEventDraftSchema.safeParse({
      eventId: "",
    })
    expect(parsed.success).toBe(false)
  })
})
