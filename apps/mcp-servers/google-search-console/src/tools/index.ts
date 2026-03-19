/**
 * MCP tool definitions and execution for Google Search Console.
 */

import type { AnalyticsQuery, DimensionFilterGroup } from "../google-api.js"
import { inspectUrl, listSites, querySearchAnalytics } from "../google-api.js"

// ============================================================
// Arg helpers — runtime narrowing instead of `as` casts
// ============================================================

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const val = args[key]
  return typeof val === "string" ? val : undefined
}

function getNumber(args: Record<string, unknown>, key: string): number | undefined {
  const val = args[key]
  return typeof val === "number" ? val : undefined
}

function getStringArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const val = args[key]
  return Array.isArray(val) ? val.filter((v): v is string => typeof v === "string") : undefined
}

function requireString(args: Record<string, unknown>, key: string): string {
  const val = getString(args, key)
  if (!val) throw new Error(`${key} is required`)
  return val
}

// ============================================================
// Tool definitions
// ============================================================

export const tools = [
  {
    name: "list_sites",
    description:
      "List all Google Search Console properties accessible to the authenticated account. Returns site URLs and permission levels. Call this first to discover siteUrl values needed for other tools.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "query_search_analytics",
    description:
      "Query Google Search Console search performance data. Returns clicks, impressions, CTR, and average position. Supports dimensions (query, page, date, device, country), date ranges, filters, and pagination up to 25,000 rows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        siteUrl: {
          type: "string",
          description:
            'Search Console property URL. Use the exact value from list_sites (e.g. "sc-domain:example.com" or "https://example.com/")',
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format (Pacific Time). Data available from ~16 months ago.",
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format (Pacific Time). Latest data is typically 2-3 days ago.",
        },
        dimensions: {
          type: "array",
          items: { type: "string", enum: ["country", "device", "page", "query", "searchAppearance", "date"] },
          description:
            "Group results by these dimensions. Common: ['query'] for top keywords, ['page'] for top pages, ['query', 'page'] for keyword-page pairs, ['date'] for trends.",
        },
        type: {
          type: "string",
          enum: ["web", "discover", "googleNews", "news", "image", "video"],
          description: "Search type to filter by (default: 'web')",
          default: "web",
        },
        dimensionFilterGroups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              groupType: { type: "string", enum: ["and"], description: "Filter group type (only 'and' supported)" },
              filters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    dimension: {
                      type: "string",
                      enum: ["country", "device", "page", "query", "searchAppearance"],
                    },
                    operator: {
                      type: "string",
                      enum: ["equals", "contains", "notEquals", "notContains", "includingRegex", "excludingRegex"],
                      default: "equals",
                    },
                    expression: {
                      type: "string",
                      description: "Filter value (e.g. page URL, query string, country code like 'usa')",
                    },
                  },
                  required: ["dimension", "expression"],
                },
              },
            },
            required: ["filters"],
          },
          description:
            "Filters to narrow results. Example: [{filters: [{dimension: 'page', operator: 'contains', expression: '/blog/'}]}]",
        },
        aggregationType: {
          type: "string",
          enum: ["auto", "byPage", "byProperty"],
          description: "How to aggregate data (default: 'auto')",
          default: "auto",
        },
        rowLimit: {
          type: "number",
          description: "Maximum rows to return (1-25000, default: 25)",
          default: 25,
        },
        startRow: {
          type: "number",
          description: "Zero-based pagination offset (default: 0)",
          default: 0,
        },
        dataState: {
          type: "string",
          enum: ["all", "final"],
          description:
            "Data freshness: 'all' includes partial recent data, 'final' is complete only (default: 'final')",
          default: "final",
        },
      },
      required: ["siteUrl", "startDate", "endDate"],
    },
  },
  {
    name: "inspect_url",
    description:
      "Inspect a URL's indexing status in Google Search. Returns coverage state, last crawl time, indexing verdict, mobile usability, and rich result status. Useful for debugging why a page isn't appearing in search results.",
    inputSchema: {
      type: "object" as const,
      properties: {
        inspectionUrl: {
          type: "string",
          description: "The fully-qualified URL to inspect (e.g. 'https://example.com/page')",
        },
        siteUrl: {
          type: "string",
          description: 'The Search Console property that owns this URL (e.g. "sc-domain:example.com")',
        },
        languageCode: {
          type: "string",
          description: "IETF BCP-47 language code for translated messages (default: 'en-US')",
          default: "en-US",
        },
      },
      required: ["inspectionUrl", "siteUrl"],
    },
  },
]

// ============================================================
// Tool execution
// ============================================================

export async function executeTool(
  accessToken: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{
  content: Array<{ type: string; text: string }>
  isError?: boolean
}> {
  try {
    let result: unknown

    switch (toolName) {
      case "list_sites": {
        result = { sites: await listSites(accessToken) }
        break
      }

      case "query_search_analytics": {
        const query: AnalyticsQuery = {
          siteUrl: requireString(args, "siteUrl"),
          startDate: requireString(args, "startDate"),
          endDate: requireString(args, "endDate"),
          dimensions: getStringArray(args, "dimensions"),
          type: getString(args, "type") ?? "web",
          dimensionFilterGroups: Array.isArray(args.dimensionFilterGroups)
            ? (args.dimensionFilterGroups as DimensionFilterGroup[])
            : undefined,
          aggregationType: getString(args, "aggregationType") ?? "auto",
          rowLimit: getNumber(args, "rowLimit") ?? 25,
          startRow: getNumber(args, "startRow") ?? 0,
          dataState: getString(args, "dataState") ?? "final",
        }
        result = await querySearchAnalytics(accessToken, query)
        break
      }

      case "inspect_url": {
        result = await inspectUrl(
          accessToken,
          requireString(args, "inspectionUrl"),
          requireString(args, "siteUrl"),
          getString(args, "languageCode"),
        )
        break
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${toolName}` }], isError: true }
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { content: [{ type: "text", text: `Error executing ${toolName}: ${message}` }], isError: true }
  }
}
