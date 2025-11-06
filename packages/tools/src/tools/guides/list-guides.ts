import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { GUIDE_CATEGORIES, type GuideCategory } from "./get-guide.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const listGuidesParamsSchema = {
  category: z
    .enum(GUIDE_CATEGORIES)
    .optional()
    .describe(
      "The category to list guides from (e.g., '30-guides', 'workflows', 'extra/knowledge-base'). If omitted, lists all categories with their guide counts.",
    ),
  detail_level: z
    .enum(["brief", "full"])
    .optional()
    .default("brief")
    .describe(
      "'brief' (titles only, context-efficient) or 'full' (titles + first line descriptions). Default: 'brief'",
    ),
}

export type ListGuidesParams = {
  category?: GuideCategory
  detail_level?: "brief" | "full"
}

export type ListGuidesResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

export async function listGuides(params: ListGuidesParams, guidesBasePath: string): Promise<ListGuidesResult> {
  try {
    const { category, detail_level = "brief" } = params

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

    const guideSummaries: string[] = []

    if (detail_level === "brief") {
      // Brief mode: just filenames (context-efficient)
      for (const file of mdFiles) {
        guideSummaries.push(`- ${file}`)
      }
    } else {
      // Full mode: filenames + first line descriptions
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
    }

    const modeNote =
      detail_level === "brief"
        ? "\n\n*Brief mode (context-efficient). Use `detail_level: 'full'` for descriptions.*"
        : ""

    // Result hints: suggest next actions
    let hints = "\n\n### Quick Actions\n"
    hints += `- **Read a guide:** \`mcp__tools__get_guide({ category: "${category}", topic: "your-topic" })\`\n`
    hints += `- **Search across all categories:** \`mcp__tools__find_guide({ query: "your-search" })\`\n`
    if (detail_level === "brief") {
      hints += `- **See descriptions:** \`mcp__tools__list_guides({ category: "${category}", detail_level: "full" })\`\n`
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `# Guides in "${category}" (${mdFiles.length})\n\n${guideSummaries.join("\n")}${modeNote}${hints}`,
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

export const listGuidesTool = tool(
  "list_guides",
  `Lists all available development guides in a specific category. Use this to discover what documentation and guides are available before retrieving specific content.

Context-efficient mode: Use detail_level: 'brief' (default) to see only guide filenames, reducing token usage. Use 'full' when you need descriptions.

Examples:
- list_guides({ category: "workflows" }) - Brief list (context-efficient)
- list_guides({ category: "30-guides", detail_level: "full" }) - With descriptions`,
  listGuidesParamsSchema,
  async args => {
    // Use source location, not dist - works in both dev and production
    const packageRoot = join(__dirname, "../../..")
    const guidesBasePath = join(packageRoot, "internals-folder")
    return listGuides(args, guidesBasePath)
  },
)
