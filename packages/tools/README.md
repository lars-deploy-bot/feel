# @alive-brug/guides

MCP (Model Context Protocol) server providing access to Alive Brug development guides and documentation.

## Overview

This package exposes internal development guides, best practices, and implementation patterns through an MCP server that can be used by Claude in the Claude Bridge application.

### How It Works

The `@alive-brug/guides` package is an **MCP server** that gives Claude AI access to a curated knowledge base during conversations. Think of it as a library system:

1. **Storage**: Development guides are stored as markdown files in `internals-folder/`
2. **Server**: An MCP server (`guidesMcp`) exposes these guides through two tools
3. **Tools**: Claude can discover (`list_guides`) and read (`get_guide`) documentation
4. **Integration**: The web app registers these tools, making them available during Claude conversations

This architecture is inspired by Alive AI's internal documentation system, adapted for the Claude Bridge multi-tenant platform.

## Core Concept

This package is an **MCP (Model Context Protocol) server** that gives Claude AI access to development documentation during conversations. Instead of embedding guides in prompts, Claude can query for specific documentation when needed.

**The mechanism:**
```
User asks question → Claude recognizes need → Calls tool → Reads guide → Applies knowledge
```

## Features

- **list_guides**: Discover available guides across different categories
- **get_guide**: Retrieve specific guide content by category and topic

## Benefits

- **Token efficiency**: Guides loaded only when needed, not upfront
- **Maintainability**: Update guides by editing markdown files
- **Discoverability**: Claude can explore what documentation exists
- **Separation of concerns**: Knowledge base separate from application code

## Installation

This is an internal package in the Alive Brug monorepo. To use it:

```bash
# Install dependencies
bun install

# Build the package
bun run build
```

## Usage in Claude Bridge

### 1. Add to web app dependencies

In `apps/web/package.json`:

```json
{
  "dependencies": {
    "@alive-brug/guides": "workspace:*"
  }
}
```

### 2. Import and register the MCP server

In `apps/web/app/api/claude/stream/route.ts`:

```typescript
import { guidesMcp } from "@alive-brug/guides"

const claudeOptions: Options = {
  // ... other options
  mcpServers: {
    "workspace-management": restartServerMcp,
    "guides": guidesMcp  // Add guides MCP server
  },
  allowedTools: [
    "Write", "Edit", "Read", "Glob", "Grep",
    "mcp__workspace-management__restart_dev_server",
    "mcp__guides__list_guides",    // Add guides tools
    "mcp__guides__get_guide"
  ]
}
```

### 3. Update tool allowlist

In the `canUseTool` callback, add guides tools to the ALLOWED set:

```typescript
const ALLOWED = new Set([
  "Write", "Edit", "Read", "Glob", "Grep",
  "mcp__guides__list_guides",
  "mcp__guides__get_guide"
])
```

## How Claude Uses These Tools

During a conversation in Claude Bridge, Claude can autonomously use these tools to access documentation:

### Example Conversation Flow

```
User: "Help me implement authentication"

Claude (thinking):
  1. I need best practices for authentication
  2. Uses: list_guides to discover available categories
  3. Uses: get_guide with relevant category and topic
  4. Reads the guide content
  5. Implements auth following documented patterns

User: "Now add security policies"

Claude (thinking):
  1. Uses: get_guide to fetch security documentation
  2. Applies the patterns from the guide
  3. Implements policies following best practices
```

### Tool Reference

#### list_guides

Lists all available guides in a category or shows all categories.

**Parameters:**
- `category` (optional): Specific category to list guides from

**Examples:**
```typescript
// List all categories
{ tool: "mcp__guides__list_guides" }
// Returns: Available categories with guide counts

// List guides in specific category
{ tool: "mcp__guides__list_guides", category: "workflows" }
// Returns: List of guides in that category with titles
```

#### get_guide

Retrieves guide content by category and optional topic search.

**Parameters:**
- `category` (required): The category to search in
- `topic` (optional): Filter guides by topic keyword

**Examples:**
```typescript
// Get authentication guide
{
  tool: "mcp__guides__get_guide",
  category: "workflows",
  topic: "authentication"
}
// Returns: Full markdown content of matching guide

// Get design patterns
{
  tool: "mcp__guides__get_guide",
  category: "design-system",
  topic: "color"
}
// Returns: Guide content about color systems
```

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Watch mode
bun run dev

# Lint
bun run lint

# Format
bun run format
```

## Architecture

### Directory Structure

```
packages/guides/
├── src/                      # TypeScript source code
│   ├── index.ts              # Main export: guidesMcp
│   ├── mcp-server.ts         # MCP server definition
│   └── tools/                # Tool implementations
│       ├── list-guides.ts    # List available guides in categories
│       └── get-guide.ts      # Retrieve guide content
├── internals-folder/         # Markdown knowledge base
│   └── [categories]/         # Organized by category (structure may vary)
├── test/                     # Unit tests with fixtures
├── dist/                     # Compiled output (generated)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Component Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Bridge (apps/web)                                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ /api/claude/stream/route.ts                         │   │
│  │                                                       │   │
│  │  import { guidesMcp } from "@alive-brug/guides"     │   │
│  │                                                       │   │
│  │  claudeOptions = {                                   │   │
│  │    mcpServers: { "guides": guidesMcp },             │   │
│  │    allowedTools: [                                   │   │
│  │      "mcp__guides__list_guides",                     │   │
│  │      "mcp__guides__get_guide"                        │   │
│  │    ]                                                  │   │
│  │  }                                                    │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│                     │ Claude SDK query()                      │
│                     │ with mcpServers                         │
│                     ▼                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Claude AI (Anthropic API)                           │   │
│  │                                                       │   │
│  │ During conversation, Claude decides:                 │   │
│  │ "I need documentation about [topic]"                 │   │
│  │                                                       │   │
│  │ Calls: mcp__guides__get_guide({                      │   │
│  │   category: "[relevant-category]",                   │   │
│  │   topic: "[search-term]"                             │   │
│  │ })                                                    │   │
│  └──────────────────┬───────────────────────────────────┘   │
└────────────────────┼─────────────────────────────────────────┘
                     │
                     │ Tool execution routed to MCP server
                     │
┌────────────────────▼─────────────────────────────────────────┐
│ @alive-brug/guides package                                   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ src/mcp-server.ts                                    │   │
│  │                                                       │   │
│  │  export const guidesMcp = createSdkMcpServer({      │   │
│  │    name: "guides",                                   │   │
│  │    tools: [listGuidesTool, getGuideTool]            │   │
│  │  })                                                   │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│                     ▼                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ src/tools/get-guide.ts                               │   │
│  │                                                       │   │
│  │  1. Parse params (category, topic)                  │   │
│  │  2. Scan: internals-folder/[category]/*.md          │   │
│  │  3. Filter: files matching topic keyword            │   │
│  │  4. Read: first matching markdown file               │   │
│  │  5. Return: Full markdown content                    │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│                     │ File I/O                                │
│                     ▼                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ internals-folder/                                    │   │
│  │   [category]/[matching-guide].md                     │   │
│  │                                                       │   │
│  │ # Guide Title                                        │   │
│  │ [Full markdown content with best practices]          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  Result flows back through Claude SDK to web app             │
└───────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Separation of Logic and Registration**: Each tool file (`get-guide.ts`, `list-guides.ts`) contains:
   - Pure business logic function (testable)
   - Zod schema for parameter validation
   - MCP tool registration with SDK

2. **Filesystem-based Knowledge Base**: Guides are markdown files that can be edited without code changes

3. **Category-based Organization**: Mimics Alive AI's internal structure (30 guides, workflows, design system, knowledge base)

4. **Path Safety**: All file operations use Node.js path joining to prevent traversal attacks

5. **TypeScript Strict Mode**: Full type safety with Zod schemas and TypeScript 5.x

## Tool Naming Convention

MCP tools follow the pattern: `mcp__[serverName]__[toolName]`

For this server:
- Server name: `guides`
- Tools: `list_guides`, `get_guide`
- Full names: `mcp__guides__list_guides`, `mcp__guides__get_guide`

## Security

- Tools only read from the `internals-folder` directory
- No file write operations
- Path traversal is prevented by design
- Only markdown files are accessible

## Extending the System

### Adding New Guides

1. Add markdown files to appropriate category folder
2. Rebuild the package: `bun run build`
3. Tools automatically discover new guides (no code changes needed)

### Adding New Tools

1. Create new tool file in `src/tools/` with:
   - Zod schema for parameters
   - Business logic function
   - MCP tool registration
2. Import and register in `src/mcp-server.ts`
3. Export from `src/index.ts`
4. Update `allowedTools` in web app
5. Rebuild: `bun run build`

### Adding New Categories

Update the `GUIDE_CATEGORIES` array in `src/tools/get-guide.ts` to include new category paths.

## License

Internal package for Alive Brug project.
