import { describe, expect, it } from "vitest"
import { getMissingTerminalResultError } from "../src/query-guard"

describe("getMissingTerminalResultError", () => {
  it("returns an error when the query ends without any result", () => {
    expect(getMissingTerminalResultError(null, 0, false)).toBe("Claude query ended without a result after 0 messages")
  })

  it("returns null for cancelled queries", () => {
    expect(getMissingTerminalResultError(null, 0, true)).toBeNull()
  })

  it("returns null when a result exists", () => {
    expect(getMissingTerminalResultError({ subtype: "success" }, 3, false)).toBeNull()
  })
})
