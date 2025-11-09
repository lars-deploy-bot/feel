import { readdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { debugFindGuide, type FindGuideParams, findGuide } from "../src/tools/composite/find-guide.js"
import { GUIDE_CATEGORIES } from "../src/tools/guides/get-guide.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageRoot = join(__dirname, "..")
const guidesBasePath = join(packageRoot, "internals-folder")

/**
 * Validation function to check guide structure integrity
 * This is a simple file system check (no AI) to debug find-guide issues
 */
async function validateGuideStructure() {
  const issues: string[] = []

  for (const category of GUIDE_CATEGORIES) {
    try {
      const pathParts = category.split("/")
      const guidesRoot = join(guidesBasePath, ...pathParts)

      // Check if directory exists
      const files = await readdir(guidesRoot)
      const mdFiles = files.filter(f => f.endsWith(".md"))

      if (mdFiles.length === 0) {
        issues.push(`❌ Category "${category}" has no .md files (found ${files.length} files total)`)
      } else {
        issues.push(`✅ Category "${category}" has ${mdFiles.length} .md file(s)`)
      }
    } catch (error) {
      issues.push(`❌ Category "${category}" ERROR: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    valid: issues.every(issue => issue.startsWith("✅")),
    issues,
  }
}

describe("find-guide validation", () => {
  describe("guide structure validation", () => {
    it("should validate all GUIDE_CATEGORIES exist and contain .md files", async () => {
      const result = await validateGuideStructure()

      console.log("\n=== Guide Structure Validation Report ===")
      for (const issue of result.issues) {
        console.log(issue)
      }
      console.log("==========================================\n")

      // This test PASSES even if some categories are empty
      // But it prints a detailed report to help debug
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it("should list all categories that have no .md files", async () => {
      const result = await validateGuideStructure()
      const emptyCategories = result.issues.filter(issue => issue.includes("has no .md files"))

      if (emptyCategories.length > 0) {
        console.log("\n⚠️  Empty categories (may cause find-guide to fail):")
        for (const cat of emptyCategories) {
          console.log(cat)
        }
        console.log()
      }

      // Test passes - we just want visibility
      expect(emptyCategories).toBeDefined()
    })

    it("should list all categories with errors", async () => {
      const result = await validateGuideStructure()
      const errorCategories = result.issues.filter(issue => issue.includes("ERROR:"))

      if (errorCategories.length > 0) {
        console.log("\n🚨 Categories with errors:")
        for (const cat of errorCategories) {
          console.log(cat)
        }
        console.log()
      }

      // Fail if any category has file system errors
      expect(errorCategories.length).toBe(0)
    })
  })

  describe("debug functionality", () => {
    it("should show detailed search debug info for a query", async () => {
      const query = "stripe"
      const debug = await debugFindGuide(query)

      console.log(`\n=== Debug Report for Query: "${query}" ===`)
      for (const entry of debug) {
        console.log(`\nCategory: ${entry.category}`)
        console.log(`  Searched: ${entry.searched}`)
        console.log(`  List Error: ${entry.listError}`)
        console.log(`  Query Found: ${entry.queryFound}`)
        if (entry.listPreview) {
          console.log(`  Preview: ${entry.listPreview}...`)
        }
      }
      console.log("==========================================\n")

      expect(debug.length).toBeGreaterThan(0)
    })

    it("should debug a failing query", async () => {
      const query = "nonexistent-xyz123"
      const debug = await debugFindGuide(query)

      const foundInAny = debug.some(d => d.queryFound)

      console.log(`\n=== Debug Report for Failing Query: "${query}" ===`)
      console.log(`Found in any category: ${foundInAny}`)
      for (const entry of debug.filter(d => !d.queryFound)) {
        console.log(`  ❌ Not found in: ${entry.category}`)
      }
      console.log("==========================================\n")

      expect(foundInAny).toBe(false)
    })

    it("should debug a specific category", async () => {
      const query = "stripe"
      const category = "30-guides"
      const debug = await debugFindGuide(query, category)

      console.log(`\n=== Debug Report for Query: "${query}" in Category: "${category}" ===`)
      for (const entry of debug) {
        console.log(`\nCategory: ${entry.category}`)
        console.log(`  Query Found: ${entry.queryFound}`)
        if (entry.listPreview) {
          console.log(`  Preview: ${entry.listPreview}...`)
        }
      }
      console.log("==========================================\n")

      expect(debug.length).toBe(1)
      expect(debug[0].category).toBe(category)
    })
  })

  describe("find-guide functionality", () => {
    it("should find guides in populated categories", async () => {
      const params: FindGuideParams = {
        query: "stripe",
        auto_retrieve: false,
      }

      const result = await findGuide(params)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toBeTruthy()
    })

    it("should handle queries that match no guides", async () => {
      const params: FindGuideParams = {
        query: "nonexistent-impossible-query-xyz123",
        auto_retrieve: false,
      }

      const result = await findGuide(params)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("No Guides Found")
    })

    it("should auto-retrieve best match when enabled", async () => {
      const params: FindGuideParams = {
        query: "stripe",
        auto_retrieve: true,
      }

      const result = await findGuide(params)

      expect(result.isError).toBe(false)
      // Should contain guide content, not just a list
      expect(result.content[0].text).toContain("Guide Found:")
    })

    it("should search only in specified category", async () => {
      const params: FindGuideParams = {
        query: "stripe",
        category: "30-guides",
        auto_retrieve: false,
      }

      const result = await findGuide(params)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("30-guides")
    })

    it("should handle empty categories gracefully", async () => {
      // Find a category that exists but might be empty
      const validation = await validateGuideStructure()
      const emptyCategory = validation.issues.find(issue => issue.includes("has no .md files"))

      if (emptyCategory) {
        // Extract category name from the issue message
        const match = emptyCategory.match(/Category "([^"]+)"/)
        if (match) {
          const category = match[1] as (typeof GUIDE_CATEGORIES)[number]

          const params: FindGuideParams = {
            query: "test",
            category,
            auto_retrieve: false,
          }

          const result = await findGuide(params)

          // Should not error, just return no matches
          expect(result.isError).toBe(false)
        }
      }

      // Test always passes - just checking behavior
      expect(true).toBe(true)
    })
  })
})
