import { describe, expect, it, vi } from "vitest"
import { executeTool } from "./index.js"

describe("google-calendar tools", () => {
  it("keeps delete_event disabled in MCP", async () => {
    const cal = {} as never

    const result = await executeTool(cal, "delete_event", {
      calendarId: "primary",
      eventId: "evt_123",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("disabled")
  })

  it("compose_delete_event returns provided event metadata", async () => {
    const getMock = vi.fn()
    const cal = {
      events: {
        get: getMock,
      },
    } as never

    const result = await executeTool(cal, "compose_delete_event", {
      eventId: "evt_123",
      calendarId: "primary",
      summary: "pap 55",
      start: { dateTime: "2026-02-24T17:00:00+01:00" },
      end: { dateTime: "2026-02-24T20:00:00+01:00" },
    })

    expect(result.isError).toBeUndefined()
    const payload = JSON.parse(result.content[0]?.text || "{}") as Record<string, unknown>
    expect(payload.type).toBe("delete_event_draft")
    expect(payload.eventId).toBe("evt_123")
    expect(payload.summary).toBe("pap 55")
    expect(getMock).not.toHaveBeenCalled()
  })

  it("compose_delete_event fetches details when summary is missing", async () => {
    const getMock = vi.fn().mockResolvedValue({
      data: {
        id: "evt_123",
        summary: "pap 55",
        location: "Amsterdam",
        start: { dateTime: "2026-02-24T17:00:00+01:00" },
        end: { dateTime: "2026-02-24T20:00:00+01:00" },
        htmlLink: "https://calendar.google.com/calendar/event?eid=abc",
      },
    })

    const cal = {
      events: {
        get: getMock,
      },
    } as never

    const result = await executeTool(cal, "compose_delete_event", {
      eventId: "evt_123",
      calendarId: "primary",
    })

    expect(result.isError).toBeUndefined()
    const payload = JSON.parse(result.content[0]?.text || "{}") as Record<string, unknown>
    expect(payload.summary).toBe("pap 55")
    expect(payload.location).toBe("Amsterdam")
    expect(payload.calendarId).toBe("primary")
    expect(getMock).toHaveBeenCalledWith({
      calendarId: "primary",
      eventId: "evt_123",
    })
  })
})
