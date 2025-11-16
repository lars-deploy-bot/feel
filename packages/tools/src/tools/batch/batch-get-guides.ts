import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { GUIDE_CATEGORIES, type GuideCategory, getGuide } from "../guides/get-guide.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Batch operation: Retrieve multiple guides in one call
 * Implements Anthropic best practice: reduce round trips for bulk operations
 */

const GuideRequestSchema = z.object({
  category: z.enum(GUIDE_CATEGORIES).describe("Guide category"),
  topic: z.string().optional().describe("Topic keyword to filter by"),
})

export const batchGetGuidesParamsSchema = {
  requests: z
    .array(GuideRequestSchema)
    .min(1)
    .max(5)
    .describe("List of guide requests (max 5). Each specifies category and optional topic."),
  include_separator: z
    .boolean()
    .optional()
    .default(true)
    .describe("Add visual separators between guides (default: true)"),
}

export type BatchGetGuidesParams = {
  requests: Array<{
    category: GuideCategory
    topic?: string
  }>
  include_separator?: boolean
}

export type BatchGetGuidesResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

export async function batchGetGuides(params: BatchGetGuidesParams): Promise<BatchGetGuidesResult> {
  const { requests, include_separator = true } = params
  // Use source location, not dist - works in both dev and production
  const packageRoot = join(__dirname, "../../..")
  const guidesBasePath = join(packageRoot, "lovable-folder-only-use-for-inspiration")

  try {
    if (requests.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "# No Guides Requested\n\nProvide at least one guide request.",
          },
        ],
        isError: false,
      }
    }

    if (requests.length > 5) {
      return {
        content: [
          {
            type: "text" as const,
            text: "# Too Many Requests\n\nMaximum 5 guides per batch. Split into multiple calls if needed.",
          },
        ],
        isError: true,
      }
    }

    let output = `# Batch Guide Retrieval (${requests.length} guides)\n\n`
    const results: Array<{ success: boolean; category: string; topic?: string; error?: string }> = []

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i]

      try {
        const result = await getGuide({ category: req.category, topic: req.topic }, guidesBasePath)

        if (result.isError) {
          results.push({
            success: false,
            category: req.category,
            topic: req.topic,
            error: result.content[0].text,
          })
          continue
        }

        results.push({
          success: true,
          category: req.category,
          topic: req.topic,
        })

        if (include_separator && i > 0) {
          output += `\n\n${"=".repeat(80)}\n\n`
        }

        output += `## Guide ${i + 1}/${requests.length}: ${req.category}${req.topic ? ` (topic: "${req.topic}")` : ""}\n\n`
        output += result.content[0].text
        output += "\n"
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.push({
          success: false,
          category: req.category,
          topic: req.topic,
          error: errorMessage,
        })
      }
    }

    // Add summary at the end
    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount

    output += `\n\n${"=".repeat(80)}\n\n`
    output += "## Batch Summary\n\n"
    output += `- **Total requests:** ${requests.length}\n`
    output += `- **Successful:** ${successCount}\n`
    output += `- **Failed:** ${failCount}\n\n`

    if (failCount > 0) {
      output += "### Failed Requests\n\n"
      for (const result of results) {
        if (!result.success) {
          output += `- **${result.category}**${result.topic ? ` (topic: "${result.topic}")` : ""}: ${result.error}\n`
        }
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: output,
        },
      ],
      isError: failCount === requests.length, // Only error if ALL failed
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text" as const,
          text: `# Batch Operation Failed\n\n**Error:** ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const batchGetGuidesTool = tool(
  "batch_get_guides",
  `Batch operation: Retrieve multiple guides in one call. Reduces round trips from N calls to 1.

Efficient for:
- Comparing multiple guides
- Gathering related documentation
- Building comprehensive context

Limit: 5 guides per batch (prevents context overload)

Examples:
- batch_get_guides({ requests: [{ category: "workflows" }, { category: "30-guides" }] })
- batch_get_guides({
    requests: [
      { category: "workflows", topic: "auth" },
      { category: "design-system", topic: "components" }
    ]
  })`,
  batchGetGuidesParamsSchema,
  async args => {
    return batchGetGuides(args)
  },
)
