import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { type GetTemplateParams, getTemplate } from "../src/tools/templates/get-template.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const templatesPath = join(__dirname, "../supertemplate/templates")

describe("getTemplate", () => {
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
      expect(result.content[0].text).toContain("Photo Sliders")
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

    it("should retrieve blog CMS template by valid versioned ID", async () => {
      const params: GetTemplateParams = {
        id: "blog-cms-system-v1.0.0",
      }

      const result = await getTemplate(params, templatesPath)

      expect(result.isError).toBe(false)
      expect(result.content[0].text).toContain("Complete Blog CMS")
      expect(result.content[0].text).toContain("zustand")
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

      // Should pass validation but not be found (case-sensitive filesystem)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("not found")
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
