import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { GUIDE_CATEGORIES, type GuideCategory, getGuide } from "../guides/get-guide.js"
import { listGuides } from "../guides/list-guides.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Composite tool: Searches for guides and retrieves best match automatically
 * Implements Anthropic best practice: reduce tool call round trips
 */

export const findGuideParamsSchema = {
  query: z
    .string()
    .min(1)
    .describe(
      'Search query to find relevant guide (e.g., "authentication", "vite errors", "deployment"). Searches across all categories.',
    ),
  category: z
    .enum(GUIDE_CATEGORIES)
    .optional()
    .describe("Optional: limit search to specific category (e.g., '30-guides', 'workflows')"),
  auto_retrieve: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "If true, automatically retrieves best matching guide. If false, just lists matches (context-efficient).",
    ),
}

export type FindGuideParams = {
  query: string
  category?: GuideCategory
  auto_retrieve?: boolean
}

export type FindGuideResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

/**
 * Debug function: Check which categories were searched and why matches failed
 * Can be called independently for diagnostics
 */
export async function debugFindGuide(query: string, category?: GuideCategory) {
  const packageRoot = join(__dirname, "../../..")
  const guidesBasePath = join(packageRoot, "internals-folder")
  const categoriesToSearch = category ? [category] : GUIDE_CATEGORIES
  const debug: Array<{
    category: GuideCategory
    searched: boolean
    listError: boolean
    queryFound: boolean
    listPreview?: string
  }> = []

  for (const cat of categoriesToSearch) {
    const result = await listGuides({ category: cat, detail_level: "full" }, guidesBasePath)

    debug.push({
      category: cat,
      searched: true,
      listError: result.isError,
      queryFound: result.isError ? false : result.content[0].text.toLowerCase().includes(query.toLowerCase()),
      listPreview: result.isError ? undefined : result.content[0].text.substring(0, 200),
    })
  }

  return debug
}

export async function findGuide(params: FindGuideParams): Promise<FindGuideResult> {
  const { query, category, auto_retrieve = true } = params
  // Use source location, not dist - works in both dev and production
  const packageRoot = join(__dirname, "../../..")
  const guidesBasePath = join(packageRoot, "internals-folder")

  try {
    const categoriesToSearch = category ? [category] : GUIDE_CATEGORIES
    const matches: Array<{ category: GuideCategory; score: number; reason: string }> = []

    // Search across categories
    for (const cat of categoriesToSearch) {
      const result = await listGuides({ category: cat, detail_level: "full" }, guidesBasePath)

      if (result.isError) continue

      const listOutput = result.content[0].text
      const queryLower = query.toLowerCase()

      // Simple relevance scoring
      if (listOutput.toLowerCase().includes(queryLower)) {
        let score = 0

        // Category name match
        if (cat.toLowerCase().includes(queryLower)) score += 10

        // Count query word occurrences
        const occurrences = (listOutput.toLowerCase().match(new RegExp(queryLower, "g")) || []).length
        score += occurrences * 2

        matches.push({
          category: cat,
          score,
          reason: `Found ${occurrences} matches in ${cat}`,
        })
      }
    }

    if (matches.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `# No Guides Found\n\n**Query:** "${query}"\n${category ? `**Category:** "${category}"\n` : ""}\n\nNo guides match your search. Try:\n- Different keywords\n- Broader search terms\n- Browse all categories: \`mcp__tools__list_guides({})\``,
          },
        ],
        isError: false,
      }
    }

    // Sort by relevance
    matches.sort((a, b) => b.score - a.score)

    // Auto-retrieve best match
    if (auto_retrieve) {
      const bestMatch = matches[0]
      const guideResult = await getGuide({ category: bestMatch.category, topic: query }, guidesBasePath)

      if (guideResult.isError) {
        return guideResult
      }

      let output = `# Guide Found: ${bestMatch.category}\n\n`
      output += `**Search query:** "${query}"\n`
      output += `**Relevance:** ${bestMatch.reason}\n\n`
      output += "---\n\n"
      output += guideResult.content[0].text

      // Add alternative suggestions
      if (matches.length > 1) {
        output += "\n\n---\n\n"
        output += "### Other Relevant Guides\n\n"
        for (let i = 1; i < Math.min(4, matches.length); i++) {
          output += `- **${matches[i].category}**: ${matches[i].reason}\n`
          output += `  Use: \`mcp__tools__get_guide({ category: "${matches[i].category}", topic: "${query}" })\`\n`
        }
      }

      return {
        content: [{ type: "text" as const, text: output }],
        isError: false,
      }
    }

    // List mode: just show matches
    let output = "# Guide Search Results\n\n"
    output += `**Query:** "${query}"\n`
    output += `**Matches:** ${matches.length}\n\n`

    for (let i = 0; i < matches.length; i++) {
      output += `${i + 1}. **${matches[i].category}** (score: ${matches[i].score})\n`
      output += `   ${matches[i].reason}\n`
      output += `   Retrieve: \`mcp__tools__get_guide({ category: "${matches[i].category}", topic: "${query}" })\`\n\n`
    }

    output += "\n**Tip:** Use `auto_retrieve: true` to automatically get the best match.\n"

    return {
      content: [{ type: "text" as const, text: output }],
      isError: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text" as const,
          text: `# Guide Search Failed\n\n**Query:** "${query}"\n\n**Error:** ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const findGuideTool = tool(
  "find_guide",
  `Composite tool: Searches for and retrieves guides in one step. Reduces round trips from 2+ tool calls to 1.

Automatically:
- Searches across all categories
- Scores relevance
- Retrieves best match (or lists all matches)

Context-efficient: Use auto_retrieve: false to just list matches without fetching content.

Examples:
- find_guide({ query: "authentication" }) - Find and retrieve auth guide
- find_guide({ query: "vite errors", category: "workflows" }) - Search in specific category
- find_guide({ query: "deployment", auto_retrieve: false }) - Just list matches`,
  findGuideParamsSchema,
  async args => {
    return findGuide(args)
  },
)
