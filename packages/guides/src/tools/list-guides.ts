import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { GUIDE_CATEGORIES, type GuideCategory } from "./get-guide.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parameter schema
export const listGuidesParamsSchema = {
  category: z
    .enum(GUIDE_CATEGORIES)
    .optional()
    .describe(
      "The category to list guides from (e.g., '30-guides', 'workflows', 'extra/knowledge-base'). If omitted, lists all categories with their guide counts.",
    ),
}

export type ListGuidesParams = {
  category?: GuideCategory
}

export type ListGuidesResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

/**
 * Business logic: List all available guides in a category.
 * Helps discover what documentation is available.
 */
export async function listGuides(params: ListGuidesParams, guidesBasePath: string): Promise<ListGuidesResult> {
  try {
    const { category } = params

    // If no category specified, list all categories with counts
    if (!category) {
      const categorySummaries: string[] = []

      for (const cat of GUIDE_CATEGORIES) {
        try {
          const pathParts = cat.split("/")
          const guidesRoot = join(guidesBasePath, ...pathParts)
          const files = await readdir(guidesRoot)
          const mdFiles = files.filter(f => f.endsWith(".md"))
          categorySummaries.push(`- **${cat}**: ${mdFiles.length} guide(s)`)
        } catch {
          categorySummaries.push(`- **${cat}**: (not accessible)`)
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `# Available Guide Categories\n\n${categorySummaries.join("\n")}\n\nUse the get_guide tool with a specific category to view guides.`,
          },
        ],
        isError: false,
      }
    }

    // List guides in specific category (support paths like "extra/knowledge-base")
    const pathParts = category.split("/")
    const guidesRoot = join(guidesBasePath, ...pathParts)
    const files = await readdir(guidesRoot)
    const mdFiles = files.filter(f => f.endsWith(".md"))

    if (mdFiles.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No guides found in category "${category}"`,
          },
        ],
        isError: false,
      }
    }

    // Get first line (title) from each guide
    const guideSummaries: string[] = []
    for (const file of mdFiles) {
      try {
        const filePath = join(guidesRoot, file)
        const content = await readFile(filePath, "utf-8")
        const firstLine = content.split("\n")[0].replace(/^#\s*/, "")
        guideSummaries.push(`- **${file}**: ${firstLine}`)
      } catch {
        guideSummaries.push(`- **${file}**`)
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `# Guides in "${category}" (${mdFiles.length})\n\n${guideSummaries.join("\n")}\n\nUse the get_guide tool to read a specific guide.`,
        },
      ],
      isError: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to list guides\n\nError: ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

/**
 * MCP Tool Registration
 */
export const listGuidesTool = tool(
  "list_guides",
  "Lists all available development guides in a specific category. Use this to discover what documentation and guides are available before retrieving specific content.",
  listGuidesParamsSchema,
  async args => {
    const guidesBasePath = join(__dirname, "../../internals-folder")
    return listGuides(args, guidesBasePath)
  },
)
