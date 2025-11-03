/**
 * @alive-brug/guides
 *
 * MCP server providing access to Alive Brug development guides and documentation.
 *
 * This package exports an MCP server that can be imported and registered in the
 * Claude Bridge web application to provide Claude with access to internal guides,
 * best practices, and implementation patterns.
 *
 * @example
 * ```typescript
 * import { guidesMcp } from "@alive-brug/guides"
 *
 * const claudeOptions = {
 *   mcpServers: {
 *     "guides": guidesMcp
 *   },
 *   allowedTools: [
 *     "mcp__guides__list_guides",
 *     "mcp__guides__get_guide"
 *   ]
 * }
 * ```
 */

export { guidesMcp } from "./mcp-server.js"
export { getGuideTool } from "./tools/get-guide.js"
export { listGuidesTool } from "./tools/list-guides.js"
