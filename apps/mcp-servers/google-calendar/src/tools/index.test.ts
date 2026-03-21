import type { calendar_v3 } from "@googleapis/calendar"
import { describe, expect, it, vi } from "vitest"
import { executeTool } from "./index.js"

/** Minimal typed Calendar mock — only the `events` subset executeTool needs. */
function mockCalendar(overrides?: { get?: ReturnType<typeof vi.fn> }): calendar_v3.Calendar {
  return {
    events: {
      // @ts-expect-error - partial Calendar mock: vi.fn() satisfies runtime needs
      get: overrides?.get ?? vi.fn(),
    },
  }
}

function parsePayload(result: { content: Array<{ type: string; text: string }> }): Record<string, unknown> {
  const raw = JSON.parse(result.content[0]?.text ?? "{}")
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw
  }
  return {}
}

describe("google-calendar tools", () => {
  it("keeps delete_event disabled in MCP", async () => {
    const cal = mockCalendar()

    const result = await executeTool(cal, "delete_event", {
      calendarId: "primary",
      eventId: "evt_123",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("disabled")
  })

  it("compose_delete_event returns provided event metadata", async () => {
    const getMock = vi.fn()
    const cal = mockCalendar({ get: getMock })

    const result = await executeTool(cal, "compose_delete_event", {
      eventId: "evt_123",
      calendarId: "primary",
      summary: "pap 55",
      start: { dateTime: "2026-02-24T17:00:00+01:00" },
      end: { dateTime: "2026-02-24T20:00:00+01:00" },
    })

    expect(result.isError).toBeUndefined()
    const payload = parsePayload(result)
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

    const cal = mockCalendar({ get: getMock })

    const result = await executeTool(cal, "compose_delete_event", {
      eventId: "evt_123",
      calendarId: "primary",
    })

    expect(result.isError).toBeUndefined()
    const payload = parsePayload(result)
    expect(payload.summary).toBe("pap 55")
    expect(payload.location).toBe("Amsterdam")
    expect(payload.calendarId).toBe("primary")
    expect(getMock).toHaveBeenCalledWith({
      calendarId: "primary",
      eventId: "evt_123",
    })
  })

  it("compose_delete_event returns error for empty eventId", async () => {
    const cal = mockCalendar()

    const result = await executeTool(cal, "compose_delete_event", {
      eventId: "",
      calendarId: "primary",
    })

    expect(result.isError).toBe(true)
  })

  it("compose_delete_event returns error when getEvent rejects", async () => {
    const getMock = vi.fn().mockRejectedValue(new Error("404 Not Found"))
    const cal = mockCalendar({ get: getMock })

    const result = await executeTool(cal, "compose_delete_event", {
      eventId: "evt_gone",
      calendarId: "primary",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("404 Not Found")
  })
})
