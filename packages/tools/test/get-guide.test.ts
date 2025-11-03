import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { type GetGuideParams, getGuide } from "../src/tools/get-guide.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixturesPath = join(__dirname, "fixtures")

describe("getGuide", () => {
  it("should retrieve a guide from 30-guides category", async () => {
    const params: GetGuideParams = {
      category: "30-guides",
    }

    const result = await getGuide(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe("text")
    expect(result.content[0].text).toContain("Test Guide One")
  })

  it("should filter guides by topic", async () => {
    const params: GetGuideParams = {
      category: "30-guides",
      topic: "test",
    }

    const result = await getGuide(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("Test Guide One")
  })

  it("should return error when category does not exist", async () => {
    const params: GetGuideParams = {
      category: "30-guides",
    }

    const result = await getGuide(params, "/nonexistent/path")

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Failed to retrieve guide")
  })

  it("should return no matches when topic filter finds nothing", async () => {
    const params: GetGuideParams = {
      category: "30-guides",
      topic: "nonexistent-topic",
    }

    const result = await getGuide(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("No guides found")
    expect(result.content[0].text).toContain("nonexistent-topic")
  })

  it("should handle nested categories with slash paths", async () => {
    const params: GetGuideParams = {
      category: "extra/knowledge-base",
    }

    const result = await getGuide(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("Design Patterns")
  })

  it("should retrieve guide when only one exists", async () => {
    const params: GetGuideParams = {
      category: "30-guides",
    }

    const result = await getGuide(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("Test Guide One")
  })

  it("should retrieve workflows category guides", async () => {
    const params: GetGuideParams = {
      category: "workflows",
    }

    const result = await getGuide(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("Authentication Workflow")
  })

  it("should filter by case-insensitive topic", async () => {
    const params: GetGuideParams = {
      category: "30-guides",
      topic: "TEST",
    }

    const result = await getGuide(params, fixturesPath)

    expect(result.isError).toBe(false)
    expect(result.content[0].text).toContain("Test Guide One")
  })

  // Edge Cases
  describe("edge cases", () => {
    it("should handle empty string as base path", async () => {
      const params: GetGuideParams = {
        category: "30-guides",
      }

      const result = await getGuide(params, "")

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Failed to retrieve guide")
    })

    it("should handle category with no markdown files", async () => {
      const params: GetGuideParams = {
        category: "design-system",
      }

      const result = await getGuide(params, fixturesPath)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("No guides found in category")
    })

    it("should handle empty topic string", async () => {
      const params: GetGuideParams = {
        category: "30-guides",
        topic: "",
      }

      const result = await getGuide(params, fixturesPath)

      // Empty topic should match all files
      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("Test Guide One")
    })

    it("should handle topic with special characters", async () => {
      const params: GetGuideParams = {
        category: "30-guides",
        topic: "test-guide",
      }

      const result = await getGuide(params, fixturesPath)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("Test Guide One")
    })

    it("should handle null/undefined-like base path gracefully", async () => {
      const params: GetGuideParams = {
        category: "30-guides",
      }

      // @ts-expect-error Testing runtime behavior with invalid input
      const result = await getGuide(params, null)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Failed to retrieve guide")
    })

    it("should handle whitespace-only topic", async () => {
      const params: GetGuideParams = {
        category: "30-guides",
        topic: "   ",
      }

      const result = await getGuide(params, fixturesPath)

      // Whitespace topic shouldn't match anything
      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("No guides found")
    })

    it("should return file when single match and no topic", async () => {
      const params: GetGuideParams = {
        category: "30-guides",
      }

      const result = await getGuide(params, fixturesPath)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("Test Guide One")
    })
  })
})
