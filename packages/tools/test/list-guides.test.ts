import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { type ListGuidesParams, listGuides } from "../src/tools/list-guides.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixturesPath = join(__dirname, "fixtures")

describe("listGuides", () => {
  it("should list all categories when no category specified", async () => {
    const params: ListGuidesParams = {}

    const result = await listGuides(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content).toHaveLength(1)
    expect(result.content[0].text).toContain("Available Guide Categories")
    expect(result.content[0].text).toContain("30-guides")
    expect(result.content[0].text).toContain("workflows")
    expect(result.content[0].text).toContain("extra/knowledge-base")
  })

  it("should show guide counts for each category", async () => {
    const params: ListGuidesParams = {}

    const result = await listGuides(params, fixturesPath)

    expect(result.isError).toBe(false)
    // 30-guides has 1 file
    expect(result.content[0].text).toMatch(/30-guides.*1 guide/)
    // workflows has 1 file
    expect(result.content[0].text).toMatch(/workflows.*1 guide/)
  })

  it("should list guides in a specific category", async () => {
    const params: ListGuidesParams = {
      category: "30-guides",
    }

    const result = await listGuides(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain('Guides in "30-guides"')
    expect(result.content[0].text).toContain("01-test-guide.md")
  })

  it("should show guide titles from first line", async () => {
    const params: ListGuidesParams = {
      category: "30-guides",
    }

    const result = await listGuides(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("Test Guide One")
  })

  it("should handle nested categories with slash paths", async () => {
    const params: ListGuidesParams = {
      category: "extra/knowledge-base",
    }

    const result = await listGuides(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("extra/knowledge-base")
    expect(result.content[0].text).toContain("01-patterns.md")
  })

  it("should return error when category does not exist", async () => {
    const params: ListGuidesParams = {
      category: "30-guides",
    }

    const result = await listGuides(params, "/nonexistent/path")

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Failed to list guides")
  })

  it("should show count in category listing", async () => {
    const params: ListGuidesParams = {
      category: "workflows",
    }

    const result = await listGuides(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toMatch(/Guides in "workflows" \(1\)/)
  })

  it("should handle categories with no markdown files", async () => {
    const params: ListGuidesParams = {
      category: "design-system",
    }

    const result = await listGuides(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("No guides found")
  })

  it("should mark inaccessible categories in overview", async () => {
    const params: ListGuidesParams = {}

    const result = await listGuides(params, fixturesPath)

    expect(result.isError).toBe(false)
    // design-system exists but has no .md files
    expect(result.content[0].text).toMatch(/design-system.*0 guide|not accessible/)
  })

  // Edge Cases
  describe("edge cases", () => {
    it("should handle empty string as base path", async () => {
      const params: ListGuidesParams = {
        category: "30-guides",
      }

      const result = await listGuides(params, "")

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Failed to list guides")
    })

    it("should handle null/undefined-like base path gracefully when listing all", async () => {
      const params: ListGuidesParams = {}

      // @ts-expect-error Testing runtime behavior with invalid input
      const result = await listGuides(params, null)

      expect(result.isError).toBe(false)
      // When no category specified, it gracefully marks all as not accessible
      expect(result.content[0].text).toContain("not accessible")
    })

    it("should handle null base path with specific category", async () => {
      const params: ListGuidesParams = {
        category: "30-guides",
      }

      // @ts-expect-error Testing runtime behavior with invalid input
      const result = await listGuides(params, null)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Failed to list guides")
    })

    it("should handle completely non-existent base path", async () => {
      const params: ListGuidesParams = {}

      const result = await listGuides(params, "/absolutely/nonexistent/path/xyz")

      expect(result.isError).toBe(false)
      // All categories should be marked as not accessible
      expect(result.content[0].text).toContain("not accessible")
    })

    it("should gracefully handle file read errors for guide titles", async () => {
      const params: ListGuidesParams = {
        category: "30-guides",
      }

      const result = await listGuides(params, fixturesPath)

      expect(result.isError).toBe(false)
      // Should still list files even if title extraction fails for some
      expect(result.content[0].text).toContain("01-test-guide.md")
    })

    it("should handle empty category list request", async () => {
      const params: ListGuidesParams = {}

      const result = await listGuides(params, fixturesPath)

      expect(result.isError).toBe(false)
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe("text")
      // Should contain the markdown formatted category list
      expect(result.content[0].text).toContain("# Available Guide Categories")
    })

    it("should show accurate count even with mixed file types in directory", async () => {
      // This tests that only .md files are counted
      const params: ListGuidesParams = {
        category: "30-guides",
      }

      const result = await listGuides(params, fixturesPath)

      expect(result.isError).toBe(false)
      // Should only count .md files, showing (1)
      expect(result.content[0].text).toMatch(/\(1\)/)
    })

    it("should handle category with files that have no title line", async () => {
      // Create a test file with no title
      const params: ListGuidesParams = {
        category: "workflows",
      }

      const result = await listGuides(params, fixturesPath)

      expect(result.isError).toBe(false)
      // Should still list the file even without a title
      expect(result.content[0].text).toContain("01-authentication-workflow.md")
    })

    it("should not throw error when overview encounters permission issues", async () => {
      const params: ListGuidesParams = {}

      const result = await listGuides(params, fixturesPath)

      expect(result.isError).toBe(false)
      // Should gracefully mark problematic categories
      expect(result.content[0].text).toContain("Available Guide Categories")
    })
  })
})
