import { describe, expect, it } from "vitest"
import {
  buildRoleSnapshotFromAriaSnapshot,
  normalizeTimeoutMs,
  parseRoleRef,
  requireRef,
  UserInputError,
} from "../snapshot-formatter.js"

describe("parseRoleRef", () => {
  it("parses bare ref like e3", () => {
    expect(parseRoleRef("e3")).toBe("e3")
  })

  it("parses @-prefixed ref", () => {
    expect(parseRoleRef("@e12")).toBe("e12")
  })

  it("parses ref= prefixed ref", () => {
    expect(parseRoleRef("ref=e5")).toBe("e5")
  })

  it("trims whitespace", () => {
    expect(parseRoleRef("  e7  ")).toBe("e7")
  })

  it("returns null for empty string", () => {
    expect(parseRoleRef("")).toBeNull()
  })

  it("returns null for invalid format", () => {
    expect(parseRoleRef("abc")).toBeNull()
    expect(parseRoleRef("x1")).toBeNull()
    expect(parseRoleRef("123")).toBeNull()
  })
})

describe("requireRef", () => {
  it("returns valid ref", () => {
    expect(requireRef("e5")).toBe("e5")
  })

  it("throws UserInputError for missing ref", () => {
    expect(() => requireRef(undefined)).toThrow(UserInputError)
    expect(() => requireRef("")).toThrow(UserInputError)
    expect(() => requireRef("  ")).toThrow(UserInputError)
  })

  it("throws UserInputError (not generic Error)", () => {
    try {
      requireRef("")
      expect.unreachable("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(UserInputError)
      expect((err as UserInputError).message).toBe("ref is required")
    }
  })
})

describe("normalizeTimeoutMs", () => {
  it("uses fallback when undefined", () => {
    expect(normalizeTimeoutMs(undefined, 5000)).toBe(5000)
  })

  it("clamps to minimum 500ms", () => {
    expect(normalizeTimeoutMs(100, 5000)).toBe(500)
  })

  it("clamps to maximum 120s", () => {
    expect(normalizeTimeoutMs(200_000, 5000)).toBe(120_000)
  })

  it("passes through values in range", () => {
    expect(normalizeTimeoutMs(10_000, 5000)).toBe(10_000)
  })
})

describe("buildRoleSnapshotFromAriaSnapshot", () => {
  const simpleTree = [
    "- navigation",
    '  - link "Home"',
    '  - link "About"',
    "- main",
    '  - heading "Welcome"',
    '  - textbox "Email"',
    '  - button "Submit"',
  ].join("\n")

  it("annotates interactive elements with refs", () => {
    const { snapshot, refs } = buildRoleSnapshotFromAriaSnapshot(simpleTree)

    expect(snapshot).toContain("[ref=e1]")
    expect(refs.e1).toBeDefined()
    expect(refs.e1.role).toBe("link")
  })

  it("generates sequential ref IDs", () => {
    const { refs } = buildRoleSnapshotFromAriaSnapshot(simpleTree)
    const keys = Object.keys(refs)
    expect(keys[0]).toBe("e1")
    expect(keys[1]).toBe("e2")
  })

  it("includes interactive elements in interactive-only mode", () => {
    const { refs } = buildRoleSnapshotFromAriaSnapshot(simpleTree, { interactive: true })

    const roles = Object.values(refs).map(r => r.role)
    expect(roles).toContain("link")
    expect(roles).toContain("textbox")
    expect(roles).toContain("button")
    // heading is content, not interactive
    expect(roles).not.toContain("heading")
  })

  it("returns empty message for empty input", () => {
    const { snapshot } = buildRoleSnapshotFromAriaSnapshot("")
    expect(snapshot).toBeTruthy()
  })

  it("tracks duplicate role+name pairs with nth", () => {
    const duplicateTree = ['- button "Save"', '- button "Save"', '- button "Cancel"'].join("\n")

    const { refs } = buildRoleSnapshotFromAriaSnapshot(duplicateTree)
    const saveRefs = Object.values(refs).filter(r => r.name === "Save")
    expect(saveRefs).toHaveLength(2)
    // Duplicates should have nth set
    expect(saveRefs[0].nth).toBe(0)
    expect(saveRefs[1].nth).toBe(1)
  })
})
