/**
 * List all available templates by reading from filesystem.
 * Single source of truth: YAML frontmatter in template .md files.
 */
import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseFrontmatter, type PartialTemplateFrontmatter } from "../../lib/template-frontmatter.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Template list item structure for UI consumption.
 * Maps frontmatter fields to UI-compatible format.
 */
export interface TemplateListItem {
  /** Template ID from filename: "carousel-thumbnails" */
  id: string
  /** Same as id (for UI compatibility with legacy code) */
  templateId: string
  /** Human-readable name */
  name: string
  /** Template description */
  description: string
  /** Category: "components" or "setup" */
  category: "components" | "setup"
  /** Complexity level 1-3 */
  complexity: 1 | 2 | 3
  /** Number of files in template (renamed from 'files' for UI compat) */
  fileCount: number
  /** Dependencies with versions */
  dependencies: string[]
  /** Human-readable time estimate */
  estimatedTime: string
  /** Estimated token count */
  estimatedTokens: number
  /** Searchable tags */
  tags: string[]
  /** Preview image URL */
  previewImage: string
}

/**
 * Template categories with display names
 */
export const TEMPLATE_CATEGORIES = {
  components: "Components",
  setup: "Setup",
} as const

export type TemplateCategory = keyof typeof TEMPLATE_CATEGORIES

/**
 * Convert parsed frontmatter to TemplateListItem
 */
function frontmatterToListItem(id: string, frontmatter: PartialTemplateFrontmatter): TemplateListItem | null {
  // Validate required fields
  if (!frontmatter.name || !frontmatter.description || !frontmatter.category || frontmatter.complexity === undefined) {
    return null
  }

  // Validate category is valid
  if (frontmatter.category !== "components" && frontmatter.category !== "setup") {
    return null
  }

  // Validate complexity is 1, 2, or 3
  if (![1, 2, 3].includes(frontmatter.complexity)) {
    return null
  }

  return {
    id,
    templateId: id,
    name: frontmatter.name,
    description: frontmatter.description,
    category: frontmatter.category as "components" | "setup",
    complexity: frontmatter.complexity as 1 | 2 | 3,
    fileCount: frontmatter.files ?? 0,
    dependencies: frontmatter.dependencies ?? [],
    estimatedTime: frontmatter.estimatedTime ?? "",
    estimatedTokens: frontmatter.estimatedTokens ?? 0,
    tags: frontmatter.tags ?? [],
    previewImage: frontmatter.previewImage ?? "/templates/previews/placeholder.svg",
  }
}

/**
 * List all available templates from the filesystem.
 *
 * @param templatesPath - Optional path to templates directory. Defaults to package's supertemplate/templates.
 * @returns Array of available templates with metadata from frontmatter
 */
export async function listTemplates(templatesPath?: string): Promise<TemplateListItem[]> {
  const basePath = templatesPath ?? join(__dirname, "../../../supertemplate/templates")
  const results: TemplateListItem[] = []

  try {
    // Get all category subdirectories
    const entries = await readdir(basePath, { withFileTypes: true })
    const categories = entries.filter(entry => entry.isDirectory())

    // Process each category directory
    for (const category of categories) {
      const categoryPath = join(basePath, category.name)

      try {
        const files = await readdir(categoryPath)

        for (const file of files) {
          if (!file.endsWith(".md")) continue

          const filePath = join(categoryPath, file)
          const id = file.replace(".md", "")

          try {
            const content = await readFile(filePath, "utf-8")
            const frontmatter = parseFrontmatter(content)

            if (!frontmatter) continue

            // Skip unavailable templates
            if (frontmatter.available === false) continue

            const item = frontmatterToListItem(id, frontmatter)
            if (item) {
              results.push(item)
            }
          } catch {
            // Skip files that can't be read
            continue
          }
        }
      } catch {
        // Skip categories that can't be read
        continue
      }
    }
  } catch {
    // Return empty array if templates directory doesn't exist
    return []
  }

  // Sort by category, then by name
  return results.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category)
    }
    return a.name.localeCompare(b.name)
  })
}

/**
 * Get templates filtered by category
 */
export function getTemplatesByCategory(templates: TemplateListItem[], category: TemplateCategory): TemplateListItem[] {
  return templates.filter(t => t.category === category)
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(templates: TemplateListItem[], id: string): TemplateListItem | undefined {
  return templates.find(t => t.id === id || t.templateId === id)
}
