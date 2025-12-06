/**
 * Search Google Maps Tool
 *
 * MCP tool definition for searching Google Maps.
 */

import { z } from "zod"
import { searchGoogleMaps } from "../scraper/main.js"

export const searchGoogleMapsSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(500)
    .describe("Search query for Google Maps (e.g., 'coffee shops in Amsterdam', 'Albert Heijn Den Bosch')"),
  maxResults: z.number().min(1).max(20).default(10).describe("Maximum number of results to return (1-20, default: 10)"),
  domainFilter: z
    .string()
    .optional()
    .describe(
      "Optional: Filter results to only include businesses with websites matching this domain (e.g., 'albertheijn.nl', 'starbucks.com'). Use only the domain.tld format.",
    ),
  includeDetails: z
    .boolean()
    .default(false)
    .describe(
      "Whether to fetch full details (hours, phone, full address) for each result. Slower but more complete. Default: false",
    ),
})

export type SearchGoogleMapsInput = z.infer<typeof searchGoogleMapsSchema>

export const searchGoogleMapsTool = {
  name: "search_google_maps",
  description: `Search Google Maps for business information including addresses, phone numbers, opening hours, ratings, and websites.

USE CASES:
- Find physical store locations for a business
- Get contact information for local businesses
- Find opening hours and ratings
- Search for specific types of businesses in an area

LIMITATIONS:
- Maximum 20 results per search
- Cannot interact with map elements or click buttons
- Cannot handle pages requiring authentication
- Rate limited to avoid blocking

TIPS:
- Use specific queries for better results (e.g., "Starbucks Amsterdam Centraal" instead of just "Starbucks")
- Use domainFilter to find locations of a specific chain (e.g., domainFilter="starbucks.com")
- Enable includeDetails for complete information (slower but includes hours, full address)`,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query for Google Maps",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results (1-20, default: 10)",
        default: 10,
      },
      domainFilter: {
        type: "string",
        description: "Filter by website domain (e.g., 'albertheijn.nl')",
      },
      includeDetails: {
        type: "boolean",
        description: "Fetch complete details including hours (slower, default: false)",
        default: false,
      },
    },
    required: ["query"],
  },
}

export async function executeSearchGoogleMaps(
  params: SearchGoogleMapsInput,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const { query, maxResults = 10, domainFilter, includeDetails = false } = params

  try {
    const result = await searchGoogleMaps(
      {
        mode: "auto",
        query,
        resultCount: maxResults,
        includeDetails,
      },
      {
        onlyIncludeWithWebsite: domainFilter,
        concurrency: 3,
      },
    )

    if (!result.success) {
      return {
        content: [{ type: "text", text: `Error: ${result.error}` }],
        isError: true,
      }
    }

    if (result.data.businesses.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No businesses found for query "${query}"${domainFilter ? ` with domain filter "${domainFilter}"` : ""}.`,
          },
        ],
      }
    }

    // Format the results
    const formattedResults = result.data.businesses.map((biz, i) => {
      const parts = [`${i + 1}. ${biz.storeName || "Unknown Business"}`]

      if (biz.address) parts.push(`   Address: ${biz.address}`)
      if (biz.phone) parts.push(`   Phone: ${biz.phone}`)
      if (biz.bizWebsite) parts.push(`   Website: ${biz.bizWebsite}`)
      if (biz.category) parts.push(`   Category: ${biz.category}`)
      if (biz.stars) parts.push(`   Rating: ${biz.stars} stars (${biz.numberOfReviews ?? 0} reviews)`)
      if (biz.status) parts.push(`   Status: ${biz.status}`)

      if (biz.hours) {
        const hoursStr = Object.entries(biz.hours)
          .filter(([, v]) => v)
          .map(([day, hours]) => `${day}: ${hours}`)
          .join(", ")
        if (hoursStr) parts.push(`   Hours: ${hoursStr}`)
      }

      return parts.join("\n")
    })

    return {
      content: [
        {
          type: "text",
          text: `Found ${result.data.businesses.length} business(es) for "${query}":\n\n${formattedResults.join("\n\n")}`,
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
}
