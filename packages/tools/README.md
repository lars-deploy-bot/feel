# @alive-brug/tools

MCP (Model Context Protocol) server providing development guides, documentation, and debugging tools for the Claude Bridge application.

## Overview

This package exposes an integrated suite of tools through an MCP server that can be used by Claude during conversations:

- **Templates**: Complete, step-by-step instructions for building specific features (carousels, maps, file upload, blog CMS) with exact file structure and code patterns
- **Guides & Documentation**: General development best practices, patterns, and reference material (NOT feature implementation)
- **Debugging Tools**: Server log inspection from systemd journals (work in progress)

## Features

### Templates

**Purpose**: Complete implementation blueprints for specific UI components and features.

Templates are **ready-to-build instructions** that include:
- Exact file structure and naming
- Step-by-step implementation requirements
- Dependencies needed
- Code architecture and patterns
- Time estimates

**Tool**: `get_template` - Retrieve implementation templates by versioned ID

Available templates:
- Auto-Scrolling Carousel (carousel-thumbnails-v1.0.0) - Smooth infinite scrolling image carousel
- Maps: Interactive Leaflet maps with markers (map-basic-markers-v1.0.0)
- File Upload: Image upload with crop/resize (upload-image-crop-v1.0.0)
- Blog: Complete CMS with posts, categories, and tags (blog-cms-system-v1.0.0)

**Key Difference from Guides**: Templates are feature-specific with exact implementation details. Guides are general reference material.

### Guides & Documentation

**Purpose**: General development patterns, best practices, and reference material.

Guides cover topics like:
- Architecture patterns and design decisions
- Code organization strategies
- Security best practices
- Performance optimization
- Configuration and setup

**Tools**:
- `list_guides` - Discover available guides across different categories
- `get_guide` - Retrieve specific guide content by category and topic

**Key Difference from Templates**: Guides provide general knowledge and patterns, not specific feature implementations. Templates are for building concrete features.

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
    "mcp__tools__get_guide",
    "mcp__tools__get_template"
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

### get_template

Retrieves a complete, step-by-step implementation blueprint for a specific feature.

**IMPORTANT**: Templates are different from guides. Use templates when you need to **build a specific feature with exact implementation details**.

**Parameters:**
- `id` (required): Versioned template ID (format: `{template-name}-v{X.Y.Z}`)

**When to Use Templates:**
- User says: "Build a carousel" → Use template
- User says: "Create file upload with crop" → Use template
- User says: "I need a blog CMS" → Use template
- User wants specific component with implementation

**Do NOT use for:**
- General architecture questions → Use guides instead
- Best practices and patterns → Use guides instead
- Code organization advice → Use guides instead

**Available Templates:**
- `carousel-thumbnails-v1.0.0` - Auto-scrolling carousel with continuous smooth animation
- `map-basic-markers-v1.0.0` - Interactive Leaflet map with custom markers
- `upload-image-crop-v1.0.0` - Image upload with crop/resize functionality
- `blog-cms-system-v1.0.0` - Complete blog CMS with posts, categories, and tags

**Examples:**
```typescript
// Get carousel template - use when building a carousel feature
{ tool: "mcp__tools__get_template", id: "carousel-thumbnails-v1.0.0" }

// Get map template - use when building a map feature
{ tool: "mcp__tools__get_template", id: "map-basic-markers-v1.0.0" }
```

**Template Contents:**
Each template provides:
- **Description** - What the feature does and how it works
- **File structure** - Exact file paths and names to create
- **Implementation steps** - Detailed requirements and architecture
- **Code patterns** - Specific code structure and examples
- **Dependencies** - Packages needed and how to install
- **Time estimate** - How long to implement

**How Templates Work:**
Templates contain all the information Claude needs to build a feature without asking clarifying questions. They are feature-focused and comprehensive.

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
│   │   ├── templates/
│   │   │   └── get-template.ts     # Retrieve implementation templates
│   │   ├── guides/
│   │   │   ├── list-guides.ts      # List available guides
│   │   │   └── get-guide.ts        # Retrieve guide content
│   │   └── debug/
│   │       └── read-server-logs.ts # Read systemd journal logs
│   └── internals-folder/
│       ├── templates/              # Implementation templates (markdown)
│       └── 30-guides/              # Development guides (markdown)
├── dist/                           # Compiled output (generated)
├── package.json
├── tsconfig.json
└── README.md
```

### Tool Naming Convention

MCP tools follow the pattern: `mcp__[serverName]__[toolName]`

For this server:
- Server name: `tools`
- Tools: `get_template`, `list_guides`, `get_guide`, `read_server_logs`
- Full names: `mcp__tools__get_template`, `mcp__tools__list_guides`, `mcp__tools__get_guide`, `mcp__tools__read_server_logs`

## Security

- Guide tools only read from the `internals-folder` directory
- No file write operations
- Path traversal is prevented by design
- Only markdown files are accessible
- Server log tool validates workspace domains before querying systemd

## Extending the System

### Adding New Templates

Templates are feature-specific implementation blueprints. Create one when you have a concrete feature that needs detailed step-by-step instructions.

**Steps:**

1. Add template markdown file to `internals-folder/templates/` with versioned name (e.g., `new-template-v1.0.0.md`)
2. Update `apps/web/data/template-ids.ts`:
   - Add template ID to `TEMPLATE_IDS` constant
   - Add version to `TEMPLATE_VERSION_REGISTRY`
3. Add template metadata to `apps/web/data/templates.ts`
4. Rebuild: `bun run build`
5. Template is now accessible via `get_template` tool

**Template File Structure:**

```markdown
# Feature Name (e.g., "Auto-Scrolling Carousel")

**Category:** category-name (e.g., "Photo Sliders")
**Complexity:** Simple/Medium/Complex
**Files:** X (number of files to create)
**Dependencies:** package1, package2 (or "None" for custom implementations)
**Estimated Time:** X-Y minutes

## Description

Clear one-sentence description of what this feature does.
Brief explanation of the use case.

## Implementation

Create a [feature description]:

### Files to create:
- List each file with purpose

### Key Architecture:
- Core technical approach
- How it works conceptually

### Requirements:
- Numbered list of specific requirements
- Be detailed and clear

### Installation/Setup:
- Dependencies
- Installation commands

### Code Example:
```typescript
// Simplified code structure showing the pattern
```
```

**Template Guidelines:**
- Be specific and actionable - Claude should know exactly what to build
- Include code patterns and structure
- Explain the "how" not just the "what"
- Keep requirements clear and measurable
- This is NOT a guide - it's implementation instructions

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
