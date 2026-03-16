import { describe, expect, it } from "vitest"
import { canInviteMembers, canRemoveMember, canUpdateOrganization } from "../permissions"

describe("canRemoveMember", () => {
  it("allows self-leave for all roles", () => {
    expect(canRemoveMember("owner", "owner", true)).toBe(true)
    expect(canRemoveMember("admin", "admin", true)).toBe(true)
    expect(canRemoveMember("member", "member", true)).toBe(true)
  })

  it("disallows self-leave without a role", () => {
    expect(canRemoveMember(null, "member", true)).toBe(false)
    expect(canRemoveMember(undefined, "member", true)).toBe(false)
  })

  it("allows owner to remove anyone", () => {
    expect(canRemoveMember("owner", "admin", false)).toBe(true)
    expect(canRemoveMember("owner", "member", false)).toBe(true)
    expect(canRemoveMember("owner", "owner", false)).toBe(true)
  })

  it("allows admin to remove member only", () => {
    expect(canRemoveMember("admin", "member", false)).toBe(true)
    expect(canRemoveMember("admin", "admin", false)).toBe(false)
    expect(canRemoveMember("admin", "owner", false)).toBe(false)
  })

  it("disallows member removing others", () => {
    expect(canRemoveMember("member", "member", false)).toBe(false)
    expect(canRemoveMember("member", "admin", false)).toBe(false)
    expect(canRemoveMember("member", "owner", false)).toBe(false)
  })

  it("disallows missing role", () => {
    expect(canRemoveMember(null, "member", false)).toBe(false)
    expect(canRemoveMember(undefined, "member", false)).toBe(false)
  })
})

describe("canUpdateOrganization", () => {
  it("allows owner and admin", () => {
    expect(canUpdateOrganization("owner")).toBe(true)
    expect(canUpdateOrganization("admin")).toBe(true)
  })

  it("disallows member and missing role", () => {
    expect(canUpdateOrganization("member")).toBe(false)
    expect(canUpdateOrganization(null)).toBe(false)
    expect(canUpdateOrganization(undefined)).toBe(false)
  })
})

describe("canInviteMembers", () => {
  it("allows owner and admin", () => {
    expect(canInviteMembers("owner")).toBe(true)
    expect(canInviteMembers("admin")).toBe(true)
  })

  it("disallows member and missing role", () => {
    expect(canInviteMembers("member")).toBe(false)
    expect(canInviteMembers(null)).toBe(false)
    expect(canInviteMembers(undefined)).toBe(false)
  })
})
