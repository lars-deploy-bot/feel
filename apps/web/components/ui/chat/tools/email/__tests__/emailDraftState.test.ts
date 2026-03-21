import { describe, expect, it } from "vitest"
import { patchEmailDraftToolResultContent, toPersistedEmailDraftStatus } from "../emailDraftState"

describe("emailDraftState", () => {
  it("patches MCP wrapper payloads for email drafts", () => {
    const original = [
      {
        type: "text",
        text: JSON.stringify({
          to: ["user@example.com"],
          subject: "Re: FW: Online versie van het Romeinse bordspel",
          body: "Concept body",
          status: "draft",
        }),
      },
    ]

    const next = patchEmailDraftToolResultContent(original, {
      status: "sent",
      id: "gmail-msg-123",
      threadId: "thread-456",
    })

    expect(Array.isArray(next)).toBe(true)
    if (!Array.isArray(next)) throw new Error("Expected patched content array")
    expect(next).toHaveLength(1)

    const parsedUnknown: unknown = JSON.parse(next[0].text)
    expect(parsedUnknown).toMatchObject({
      status: "sent",
      id: "gmail-msg-123",
      threadId: "thread-456",
    })
  })

  it("returns original content for non-email payloads", () => {
    const original = [{ type: "text", text: JSON.stringify({ ok: true }) }]
    const next = patchEmailDraftToolResultContent(original, { status: "sent", id: "x" })
    expect(next).toBe(original)
  })

  it("normalizes persisted status values", () => {
    expect(toPersistedEmailDraftStatus("draft")).toBe("draft")
    expect(toPersistedEmailDraftStatus("saved")).toBe("saved")
    expect(toPersistedEmailDraftStatus("sent")).toBe("sent")
    expect(toPersistedEmailDraftStatus("sending")).toBe("draft")
    expect(toPersistedEmailDraftStatus(null)).toBe("draft")
  })
})
