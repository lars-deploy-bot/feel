#!/usr/bin/env node
/**
 * Google Scraper MCP Server
 *
 * A standalone MCP server that provides Google Maps search functionality.
 * Runs as a separate process with stdio transport for process isolation.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { searchGoogleMapsTool, executeSearchGoogleMaps, searchGoogleMapsSchema } from "./tools/search-google-maps.js"

const server = new Server(
  {
    name: "google-scraper",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [searchGoogleMapsTool],
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params

  if (name === "search_google_maps") {
    try {
      const parsed = searchGoogleMapsSchema.parse(args)
      return await executeSearchGoogleMaps(parsed)
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid arguments: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  }
})

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Google Scraper MCP Server started")
}

main().catch(error => {
  console.error("Failed to start server:", error)
  process.exit(1)
})
