import { describe, expect, it } from "vitest"
import { validateCalendarEventDeleteDraft } from "../CalendarEventDeleteOutput"

describe("validateCalendarEventDeleteDraft", () => {
  it("accepts a valid delete draft", () => {
    const valid = validateCalendarEventDeleteDraft({
      type: "delete_event_draft",
      eventId: "evt_123",
      calendarId: "primary",
      summary: "pap 55",
    })

    expect(valid).toBe(true)
  })

  it("rejects payloads without eventId", () => {
    const valid = validateCalendarEventDeleteDraft({
      type: "delete_event_draft",
      calendarId: "primary",
    })

    expect(valid).toBe(false)
  })

  it("rejects payloads with non-string calendarId", () => {
    const valid = validateCalendarEventDeleteDraft({
      eventId: "evt_123",
      calendarId: 123,
    })

    expect(valid).toBe(false)
  })
})
