import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk"
import { getGuideTool } from "./tools/get-guide.js"
import { listGuidesTool } from "./tools/list-guides.js"

/**
 * Guides MCP Server
 *
 * Provides tools for accessing the Alive Brug development guides and documentation.
 *
 * Available tools:
 * - list_guides: Discover available guides across different categories
 * - get_guide: Retrieve specific guide content by category and topic
 *
 * Usage in Claude Bridge:
 * - Tool names: mcp__guides__list_guides, mcp__guides__get_guide
 * - Register in mcpServers config
 * - Add to allowedTools whitelist
 */
export const guidesMcp = createSdkMcpServer({
  name: "guides",
  version: "1.0.0",
  tools: [listGuidesTool, getGuideTool],
})
