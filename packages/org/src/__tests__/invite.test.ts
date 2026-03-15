import { describe, expect, it } from "vitest"
import { buildInviteLink } from "../invite"

describe("buildInviteLink", () => {
  it("builds link from code and base URL", () => {
    expect(buildInviteLink("ABC123", "https://app.alive.best")).toBe("https://app.alive.best/invite/ABC123")
  })

  it("works with trailing slash-free base URL", () => {
    expect(buildInviteLink("XYZ", "https://example.com")).toBe("https://example.com/invite/XYZ")
  })

  it("throws if baseUrl is empty", () => {
    expect(() => buildInviteLink("ABC", "")).toThrow("[referral] baseUrl is required")
  })
})
