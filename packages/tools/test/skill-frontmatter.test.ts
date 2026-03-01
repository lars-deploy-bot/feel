import { describe, expect, it } from "vitest"
import { parseSkillContent, validateSkillContent } from "../src/lib/skill-frontmatter.js"

describe("skill-frontmatter", () => {
  it("parses valid skill content", () => {
    const content = [
      "---",
      "name: test-skill",
      "description: A simple description",
      "---",
      "",
      "# Test",
      "",
      "Prompt body.",
    ].join("\n")

    const parsed = parseSkillContent(content)
    expect(parsed).not.toBeNull()
    expect(parsed?.frontmatter.name).toBe("test-skill")
    expect(parsed?.frontmatter.description).toBe("A simple description")
    expect(parsed?.body).toBe("# Test\n\nPrompt body.")
    expect(validateSkillContent(content)).toBeNull()
  })

  it("accepts quoted descriptions with colons", () => {
    const content = [
      "---",
      "name: e2e",
      'description: "Write strict zero-mock E2E tests: real backend flows only."',
      "---",
      "",
      "Body",
    ].join("\n")

    const parsed = parseSkillContent(content)
    expect(parsed).not.toBeNull()
    expect(parsed?.frontmatter.description).toBe("Write strict zero-mock E2E tests: real backend flows only.")
    expect(validateSkillContent(content)).toBeNull()
  })

  it("rejects unquoted descriptions with colon-space", () => {
    const content = [
      "---",
      "name: e2e",
      "description: Write strict zero-mock E2E tests: real backend flows only.",
      "---",
      "",
      "Body",
    ].join("\n")

    expect(parseSkillContent(content)).toBeNull()
    expect(validateSkillContent(content)).toBe(
      'invalid YAML: unquoted ":" in value at line 2 column 46 (wrap the value in quotes)',
    )
  })
})
