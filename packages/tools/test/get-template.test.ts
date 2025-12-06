import { readFile, readdir, stat } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { type GetTemplateParams, getTemplate } from "../src/tools/templates/get-template.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const templatesPath = join(__dirname, "../supertemplate/templates")

interface TemplateFrontmatter {
  name?: string
  description?: string
  category?: string
  complexity?: number
  files?: number
  dependencies?: string[]
  estimatedTime?: string
  estimatedTokens?: number
  tags?: string[]
  requires?: string[]
  previewImage?: string
  available?: boolean
}

/**
 * Parse YAML frontmatter from a template file.
 * Returns null if no valid frontmatter found.
 */
function parseFrontmatter(content: string): TemplateFrontmatter | null {
  if (!content.startsWith("---")) {
    return null
  }

  const endIndex = content.indexOf("---", 3)
  if (endIndex === -1) {
    return null
  }

  const frontmatter = content.slice(3, endIndex).trim()
  const result: TemplateFrontmatter = {}

  // Simple YAML parsing for our known fields
  for (const line of frontmatter.split("\n")) {
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()

    // Skip array items (lines starting with -)
    if (key.startsWith("-")) continue

    switch (key) {
      case "name":
      case "description":
      case "category":
      case "estimatedTime":
      case "previewImage":
        result[key] = value
        break
      case "complexity":
      case "files":
      case "estimatedTokens":
        result[key] = Number.parseInt(value, 10)
        break
      case "available":
        result.available = value.toLowerCase() === "true"
        break
      case "tags":
        // Parse inline array [a, b, c]
        if (value.startsWith("[")) {
          result.tags = value
            .slice(1, -1)
            .split(",")
            .map(s => s.trim())
        }
        break
      case "dependencies":
        // If inline array
        if (value.startsWith("[")) {
          result.dependencies = value
            .slice(1, -1)
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
        } else if (!value) {
          // Multi-line array follows, parse next lines
          result.dependencies = []
        }
        break
      case "requires":
        if (!value) {
          result.requires = []
        }
        break
    }
  }

  // Parse multi-line arrays (dependencies, requires)
  const lines = frontmatter.split("\n")
  let currentArray: "dependencies" | "requires" | null = null

  for (const line of lines) {
    if (line.match(/^dependencies:\s*$/)) {
      currentArray = "dependencies"
      result.dependencies = []
    } else if (line.match(/^requires:\s*$/)) {
      currentArray = "requires"
      result.requires = []
    } else if (line.match(/^\s+-\s+/)) {
      if (currentArray && result[currentArray]) {
        const value = line
          .replace(/^\s+-\s+/, "")
          .trim()
          .replace(/^["']|["']$/g, "")
        ;(result[currentArray] as string[]).push(value)
      }
    } else if (!line.startsWith(" ") && !line.startsWith("\t") && line.includes(":")) {
      currentArray = null
    }
  }

  return result
}

/**
 * Check if a template is marked as available via YAML frontmatter.
 * Templates with `available: false` in frontmatter are unavailable.
 * Defaults to true if no frontmatter or not specified.
 */
async function isTemplateAvailable(filePath: string): Promise<boolean> {
  const content = await readFile(filePath, "utf-8")
  const frontmatter = parseFrontmatter(content)
  return frontmatter?.available !== false
}

/**
 * Recursively find all .md template files in the templates directory.
 * Returns array of { filePath, category, id } for each template.
 */
async function findAllTemplateFiles(): Promise<Array<{ filePath: string; category: string; id: string }>> {
  const results: Array<{ filePath: string; category: string; id: string }> = []
  const categories = await readdir(templatesPath, { withFileTypes: true })

  for (const entry of categories) {
    if (!entry.isDirectory()) continue
    const category = entry.name
    const categoryPath = join(templatesPath, category)
    const files = await readdir(categoryPath)

    for (const file of files) {
      if (!file.endsWith(".md")) continue
      const id = file.replace(".md", "")
      results.push({
        filePath: join(categoryPath, file),
        category,
        id,
      })
    }
  }
  return results
}

describe("getTemplate", () => {
  describe("All template files accessible", () => {
    it("should have at least one template file", async () => {
      const templates = await findAllTemplateFiles()
      expect(templates.length).toBeGreaterThan(0)
    })

    it("all template files should be world-readable (catches permission issues)", async () => {
      const templates = await findAllTemplateFiles()
      const errors: string[] = []

      for (const template of templates) {
        const fileStat = await stat(template.filePath)
        const mode = fileStat.mode

        // Check if file has "others read" permission (0o004)
        // This catches files with 600 permissions even when running as root
        const othersCanRead = (mode & 0o004) !== 0

        if (!othersCanRead) {
          const octalMode = (mode & 0o777).toString(8)
          errors.push(`${template.category}/${template.id}.md - mode ${octalMode}, missing world-read permission`)
        }
      }

      if (errors.length > 0) {
        throw new Error(`Template files with permission issues:\n${errors.join("\n")}\n\nFix with: chmod 644 <file>`)
      }
    })

    it("all available templates should be retrievable via getTemplate()", async () => {
      const templates = await findAllTemplateFiles()
      const errors: string[] = []
      let skipped = 0

      for (const template of templates) {
        const available = await isTemplateAvailable(template.filePath)
        if (!available) {
          skipped++
          continue
        }

        const result = await getTemplate({ id: template.id }, templatesPath)
        if (result.isError) {
          errors.push(`${template.id}: ${result.content[0].text}`)
        }
      }

      if (errors.length > 0) {
        throw new Error(`Templates that failed to load:\n${errors.join("\n")}`)
      }

      // Sanity check: we should have tested at least one template
      const tested = templates.length - skipped
      expect(tested).toBeGreaterThan(0)
    })

    it("unavailable templates should return error when retrieved", async () => {
      const templates = await findAllTemplateFiles()
      let unavailableCount = 0

      for (const template of templates) {
        const available = await isTemplateAvailable(template.filePath)
        if (!available) {
          unavailableCount++
          // Verify the actual getTemplate function returns an error
          const result = await getTemplate({ id: template.id }, templatesPath)
          expect(result.isError).toBe(true)
          expect(result.content[0].text).toContain("not available")
        }
      }

      // We expect at least one unavailable template (template-browser-v1.0.0)
      expect(unavailableCount).toBeGreaterThanOrEqual(1)
    })

    it("all templates should have valid frontmatter", async () => {
      const templates = await findAllTemplateFiles()
      const errors: string[] = []
      const requiredFields = ["name", "description", "category", "complexity", "available"]

      for (const template of templates) {
        const content = await readFile(template.filePath, "utf-8")
        const frontmatter = parseFrontmatter(content)

        if (!frontmatter) {
          errors.push(`${template.category}/${template.id}.md - missing frontmatter`)
          continue
        }

        for (const field of requiredFields) {
          if (frontmatter[field as keyof TemplateFrontmatter] === undefined) {
            errors.push(`${template.category}/${template.id}.md - missing required field: ${field}`)
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(`Templates with invalid frontmatter:\n${errors.join("\n")}`)
      }
    })
  })

  describe("Valid template retrieval", () => {
    it("should retrieve carousel template by valid versioned ID", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(false)
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe("text")
      expect(result.content[0].text).toContain("Auto-Scrolling Carousel")
      expect(result.content[0].text).toContain("category: components")
      expect(result.content[0].text).toContain("Ready to implement this template")
    })

    it("should retrieve map template by valid versioned ID", async () => {
      const params: GetTemplateParams = {
        id: "map-basic-markers-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("Interactive Map with Markers")
      expect(result.content[0].text).toContain("Leaflet")
    })

    it("should retrieve image upload template by valid versioned ID", async () => {
      const params: GetTemplateParams = {
        id: "upload-image-crop-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("Image Upload with Crop")
      expect(result.content[0].text).toContain("react-dropzone")
    })

    it("should retrieve recipe system template by valid versioned ID", async () => {
      const params: GetTemplateParams = {
        id: "recipe-system-interactive-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("Interactive Recipe System")
      expect(result.content[0].text).toContain("Recipe Template Interface")
    })
  })

  describe("Template not found", () => {
    it("should return error when template does not exist", async () => {
      const params: GetTemplateParams = {
        id: "nonexistent-template-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Template "nonexistent-template-v1.0.0" not found')
    })

    it("should return error when templates path does not exist", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails-v1.0.0",
      }

      const result = await getTemplate(params, "/nonexistent/path")

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("not found")
    })
  })

  describe("Version format validation", () => {
    it("should reject template ID without version", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Invalid template ID format")
      expect(result.content[0].text).toContain("{name}-v{major}.{minor}.{patch}")
    })

    it("should reject malformed version (missing patch)", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails-v1.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Invalid template ID format")
    })

    it("should reject version without 'v' prefix", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails-1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Invalid template ID format")
    })

    it("should reject version with pre-release tag", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails-v1.0.0-beta",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Invalid template ID format")
    })

    it("should reject version with metadata", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails-v1.0.0+build.123",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("invalid characters")
    })

    it("should handle template ID with multiple dashes (valid format)", async () => {
      const params: GetTemplateParams = {
        id: "my-complex-template-name-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      // Should be valid format (just doesn't exist)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("not found")
      expect(result.content[0].text).not.toContain("Invalid template ID format")
    })
  })

  describe("Security: Path traversal attacks", () => {
    it("should reject path traversal with ../", async () => {
      const params: GetTemplateParams = {
        id: "../etc/passwd-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("path traversal detected")
    })

    it("should reject path traversal with multiple ../", async () => {
      const params: GetTemplateParams = {
        id: "../../secret-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("path traversal detected")
    })

    it("should reject absolute paths", async () => {
      const params: GetTemplateParams = {
        id: "/etc/passwd-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("path traversal detected")
    })

    it("should reject Windows-style paths", async () => {
      const params: GetTemplateParams = {
        id: "C:\\Windows\\System32-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("path traversal detected")
    })

    it("should reject backslashes", async () => {
      const params: GetTemplateParams = {
        id: "templates\\..\\secret-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("path traversal detected")
    })

    it("should reject encoded path traversal attempts", async () => {
      const params: GetTemplateParams = {
        id: "..%2F..%2Fetc%2Fpasswd-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("path traversal detected")
    })
  })

  describe("Security: Input validation", () => {
    it("should reject empty string as template ID", async () => {
      const params: GetTemplateParams = {
        id: "",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Template ID cannot be empty")
    })

    it("should reject whitespace-only template ID", async () => {
      const params: GetTemplateParams = {
        id: "   ",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Template ID cannot be empty")
    })

    it("should reject template ID with only newlines", async () => {
      const params: GetTemplateParams = {
        id: "\n\n\n",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Template ID cannot be empty")
    })

    it("should reject template ID that's too long", async () => {
      const params: GetTemplateParams = {
        id: `${"a".repeat(101)}-v1.0.0`,
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Template ID too long")
      expect(result.content[0].text).toContain("Maximum length is 100 characters")
    })

    it("should reject template ID with null bytes", async () => {
      const params: GetTemplateParams = {
        id: "template\0-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("invalid characters")
    })

    it("should reject template ID with special characters", async () => {
      const params: GetTemplateParams = {
        id: "template@special#chars-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("invalid characters")
      expect(result.content[0].text).toContain("Only alphanumeric, hyphens, and dots are allowed")
    })

    it("should reject template ID with spaces", async () => {
      const params: GetTemplateParams = {
        id: "my template-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("invalid characters")
    })

    it("should reject template ID with unicode characters", async () => {
      const params: GetTemplateParams = {
        id: "template-™️-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("invalid characters")
    })

    it("should reject template ID with shell metacharacters", async () => {
      const params: GetTemplateParams = {
        id: "template;rm -rf /-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("path traversal detected")
    })
  })

  describe("Edge cases", () => {
    it("should handle case-insensitive template IDs", async () => {
      const params: GetTemplateParams = {
        id: "CAROUSEL-THUMBNAILS-V1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      // Template IDs are normalized to lowercase, so this should succeed
      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("Auto-Scrolling Carousel")
      expect(result.content[0].text).not.toContain("Invalid template ID format")
    })

    it("should handle template ID at exactly 100 characters", async () => {
      const id = `${"a".repeat(89)}-v1.0.0` // Exactly 100 chars
      const params: GetTemplateParams = { id }

      const result = await getTemplate(params, templatesPath)

      // Should pass length validation (but not be found)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("not found")
      expect(result.content[0].text).not.toContain("too long")
    })

    it("should handle version with leading zeros", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails-v01.00.00",
      }

      const result = await getTemplate(params, templatesPath)

      // Should be valid format (just doesn't exist)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("not found")
      expect(result.content[0].text).not.toContain("Invalid template ID format")
    })

    it("should handle large version numbers", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails-v999.999.999",
      }

      const result = await getTemplate(params, templatesPath)

      // Should be valid format
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("not found")
      expect(result.content[0].text).not.toContain("Invalid template ID format")
    })
  })

  describe("Error handling", () => {
    it("should handle invalid base path gracefully", async () => {
      const params: GetTemplateParams = {
        id: "carousel-thumbnails-v1.0.0",
      }

      const result = await getTemplate(params, "")

      expect(result.isError).toBe(true)
    })

    it("should include template ID in error messages", async () => {
      const params: GetTemplateParams = {
        id: "nonexistent-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("nonexistent-v1.0.0")
    })
  })
})
