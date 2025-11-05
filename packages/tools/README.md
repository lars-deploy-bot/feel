# @alive-brug/tools

MCP (Model Context Protocol) server providing development guides, documentation, and debugging tools for the Claude Bridge application.

## Overview

This package exposes an integrated suite of tools through an MCP server that can be used by Claude during conversations:

- **Guides & Documentation**: Development best practices and implementation patterns
- **Debugging Tools**: Server log inspection from systemd journals (work in progress)

## Features

### Guides & Documentation

- **list_guides**: Discover available guides across different categories
- **get_guide**: Retrieve specific guide content by category and topic

### Workspace Management

- **restart_dev_server**: Restart the systemd dev server for a workspace
- **install_package**: Install a package in the user's workspace using bun

### Debug Tools

- **read_server_logs**: Read systemd journal logs from workspace dev servers (currently disabled in main terminal)

## Installation

```bash
# Install dependencies
bun install

# Build the package
bun run build
```

## Usage in Claude Bridge

### Import and Register

In `apps/web/app/api/claude/stream/route.ts`:

```typescript
import { toolsMcp } from "@alive-brug/tools"

const claudeOptions: Options = {
  mcpServers: {
    "workspace-management": restartServerMcp,
    "tools": toolsMcp
  },
  allowedTools: [
    "Write", "Edit", "Read", "Glob", "Grep",
    "mcp__workspace-management__restart_dev_server",
    "mcp__tools__list_guides",
    "mcp__tools__get_guide"
  ]
}
```

## Tool Reference

### list_guides

Lists all available guides in a category or shows all categories.

**Parameters:**
- `category` (optional): Specific category to list guides from

**Examples:**
```typescript
// List all categories with guide counts
{ tool: "mcp__tools__list_guides" }

// List guides in specific category
{ tool: "mcp__tools__list_guides", category: "workflows" }
```

### get_guide

Retrieves guide content by category and optional topic search.

**Parameters:**
- `category` (required): The category to search in
- `topic` (optional): Filter guides by topic keyword

**Examples:**
```typescript
{ tool: "mcp__tools__get_guide", category: "workflows", topic: "authentication" }
{ tool: "mcp__tools__get_guide", category: "design-system", topic: "color" }
```

### restart_dev_server

Restarts the systemd dev server for a workspace.

**Parameters:**
- `workspaceRoot` (required): The root path of the workspace (e.g., "/srv/webalive/sites/example.com/user")

**Example:**
```typescript
{
  tool: "mcp__workspace-management__restart_dev_server",
  workspaceRoot: "/srv/webalive/sites/example.com/user"
}
```

### install_package

Installs a package in the user's workspace using bun. Runs in the child process with proper isolation.

**Parameters:**
- `workspaceRoot` (required): The root path of the workspace (e.g., "/srv/webalive/sites/example.com/user")
- `packageName` (required): The package name to install (e.g., "react", "lodash", "@types/node")
- `dev` (optional): Whether to install as a dev dependency (default: false)

**Examples:**
```typescript
// Install regular dependency
{
  tool: "mcp__workspace-management__install_package",
  workspaceRoot: "/srv/webalive/sites/example.com/user",
  packageName: "react"
}

// Install dev dependency
{
  tool: "mcp__workspace-management__install_package",
  workspaceRoot: "/srv/webalive/sites/example.com/user",
  packageName: "@types/node",
  dev: true
}
```

### read_server_logs

Reads systemd journal logs from a workspace's dev server. Currently disabled in the main terminal.

**Parameters:**
- `workspace` (required): Workspace domain (e.g., "two.goalive.nl")
- `search` (optional): Filter logs by search term
- `lines` (optional): Number of log lines (default: 100, max: 1000)
- `since` (optional): Time range (e.g., "5 minutes ago")

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
packages/tools/
├── src/
│   ├── index.ts                    # Main export
│   ├── mcp-server.ts               # MCP server definition
│   ├── tools/
│   │   ├── guides/
│   │   │   ├── list-guides.ts     # List available guides
│   │   │   └── get-guide.ts       # Retrieve guide content
│   │   └── debug/
│   │       └── read-server-logs.ts # Read systemd journal logs
│   └── internals-folder/           # Markdown knowledge base
├── dist/                           # Compiled output (generated)
├── package.json
├── tsconfig.json
└── README.md
```

### Tool Naming Convention

MCP tools follow the pattern: `mcp__[serverName]__[toolName]`

For this server:
- Server name: `tools`
- Tools: `list_guides`, `get_guide`, `read_server_logs`
- Full names: `mcp__tools__list_guides`, `mcp__tools__get_guide`, `mcp__tools__read_server_logs`

## Security

- Guide tools only read from the `internals-folder` directory
- No file write operations
- Path traversal is prevented by design
- Only markdown files are accessible
- Server log tool validates workspace domains before querying systemd

## Extending the System

### Adding New Guides

1. Add markdown files to appropriate category folder in `internals-folder/`
2. Rebuild: `bun run build`
3. Tools automatically discover new guides

### Adding New Tools

1. Create new tool file in `src/tools/` with:
   - Zod schema for parameters
   - Business logic function
   - MCP tool registration
2. Import and register in `src/mcp-server.ts`
3. Export from `src/index.ts`
4. Update `allowedTools` in web app if needed
5. Rebuild: `bun run build`

## License

Internal package for Alive Brug project.
