import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const GUIDE_CATEGORIES = [
  "30-guides",
  "workflows",
  "design-system",
  "extra/knowledge-base",
  "extra/execution-model",
  "extra/prompt-patterns",
  "extra/read-only",
  "extra/tool-api",
  "extra/virtual-fs",
] as const

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number]

export const getGuideParamsSchema = {
  category: z
    .enum(GUIDE_CATEGORIES)
    .describe(
      "The category of guide to search in (e.g., '30-guides', 'workflows', 'design-system', 'extra/knowledge-base', etc.)",
    ),
  topic: z
    .string()
    .optional()
    .describe("Optional search term to filter guides by topic (e.g., 'stripe', 'email', 'ai')"),
}

export type GetGuideParams = {
  category: GuideCategory
  topic?: string
}

export type GetGuideResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

export async function getGuide(params: GetGuideParams, guidesBasePath: string): Promise<GetGuideResult> {
  try {
    const { category, topic } = params
    const pathParts = category.split("/")
    const guidesRoot = join(guidesBasePath, ...pathParts)

    const files = await readdir(guidesRoot)
    const mdFiles = files.filter(f => f.endsWith(".md"))

    let relevantFiles = mdFiles
    if (topic) {
      const searchTerm = topic.toLowerCase()
      relevantFiles = mdFiles.filter(f => f.toLowerCase().includes(searchTerm))
    }

    if (relevantFiles.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: topic
              ? `No guides found in category "${category}" matching topic "${topic}"`
              : `No guides found in category "${category}"`,
          },
        ],
        isError: false,
      }
    }

    const fileToRead = relevantFiles[0]
    const filePath = join(guidesRoot, fileToRead)
    const content = await readFile(filePath, "utf-8")

    const resultText =
      relevantFiles.length > 1
        ? `Found ${relevantFiles.length} guides. Showing: ${fileToRead}\n\nOther matches: ${relevantFiles.slice(1).join(", ")}\n\n---\n\n${content}`
        : `# ${fileToRead}\n\n${content}`

    return {
      content: [
        {
          type: "text" as const,
          text: resultText,
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
          text: `Failed to retrieve guide\n\nError: ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const getGuideTool = tool(
  "get_guide",
  "Retrieves development guides and documentation from the Alive Brug internals knowledge base. Use this to get best practices, patterns, and implementation guidelines for various topics like Stripe payments, email integration, AI integration, security, and more.",
  getGuideParamsSchema,
  async args => {
    const guidesBasePath = join(__dirname, "../../internals-folder")
    return getGuide(args, guidesBasePath)
  },
)
