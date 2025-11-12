# Tools Package - Claude Guidelines

## Templates vs Guides

**CRITICAL DISTINCTION**: Templates and Guides are fundamentally different tools.

### Templates
- **Purpose**: Step-by-step implementation blueprints for specific features
- **Content**: Exact file structure, requirements, code patterns, and architecture
- **Use When**: Building a concrete feature (carousel, map, file upload, blog CMS)
- **Location**: `supertemplate/templates/{category}/` (markdown files organized by category with version numbers)
- **Tool**: `get_template` tool retrieves these
- **Example**: `carousel-thumbnails-v1.0.0.md` contains all info needed to build a carousel

**Two-System Architecture:**
- **Backend (MCP Tool)**: Auto-discovers templates via directory scanning - no registration needed
- **Frontend (UI Browser)**: Requires manual registration in 5 files for templates to appear in UI

**CRITICAL**: Creating only the `.md` file is insufficient - templates won't show in the UI browser without full registration!

**Documentation:**
- **Comprehensive guide**: See `../../docs/features/alive-super-templates.md` for complete system architecture
- **Adding templates**: See `supertemplate/ADDING_TEMPLATES.md` for step-by-step registration process
- **Quality requirements**: See `supertemplate/TEMPLATE_CHECKLIST.md` for all 49 quality standards

### Guides
- **Purpose**: General development patterns, best practices, reference material
- **Content**: Knowledge about architecture, security, performance, organization
- **Use When**: Learning best practices, design patterns, general advice
- **Location**: `internals-folder/30-guides/` and other category folders
- **Tool**: `list_guides` and `get_guide` tools discover and retrieve these
- **Example**: A guide about "component organization" or "state management patterns"

## Documentation Rules

**CRITICAL**: Do NOT create implementation notes, changelogs, or other documentation files unless absolutely necessary.

- No `IMPLEMENTATION_NOTES.md`, `CHANGELOG.md`, `MIGRATION.md` etc. unless explicitly requested
- Code should be self-documenting through comments and types
- If documentation IS needed, always place in nested `/docs` folders (e.g., `docs/BEST_PRACTICES_BY_ANTHROPIC_NOV_4_ARTICLE.md`)
- Never clutter root directories with documentation files

## Adding Templates vs Guides

### When to Create a Template
Create a template when you have a **specific feature** that needs implementation:
- UI components (carousel, map, file upload)
- Complete systems (blog CMS)
- Feature sets that users will build from scratch
- Something that needs "here's exactly what to create and how"

**Template files** go in `supertemplate/templates/{category}/` with names like `feature-name-v1.0.0.md`

**Template categories:**
- `photo-sliders/` - Image carousels, galleries, lightboxes
- `maps/` - Interactive maps, geocoding, markers
- `forms-and-inputs/` - Upload, validation, multi-step forms
- `backend/` - API servers, databases, backend logic
- `ui-components/` - Buttons, modals, accordions, UI patterns

**Registration Process** (CRITICAL):
After creating the `.md` file, you MUST register it in 5 additional files for UI browser visibility:
1. `apps/web/data/template-ids.ts` - Add ID constant and version registry
2. `apps/web/data/templates.ts` - Add category type (if new) and template entry
3. `apps/web/components/modals/SuperTemplatesModal.tsx` - Add category type and label (if new)
4. `packages/tools/src/tools/templates/get-template.ts` - Add to TEMPLATE_CATEGORIES (if new)
5. `supertemplate/README.md` - Update total count and category description (if new)

**See `supertemplate/ADDING_TEMPLATES.md` for complete step-by-step guide.**

### When to Create a Guide
Create a guide when you have **general knowledge** to share:
- Best practices and patterns
- Architecture decisions
- Security or performance tips
- Code organization strategies
- Configuration and setup advice
- "Here's how to think about X" type content

**Guide files** go in appropriate category folder in `internals-folder/` (e.g., `30-guides/`, `40-architecture/`)

## Tool Development

When adding new tools to this package:

1. Create tool file in appropriate category folder (`src/tools/<category>/`)
2. Export from `src/index.ts`
3. Register in `src/mcp-server.ts`
4. Update tool registry in `src/tools/meta/search-tools.ts`
5. Build: `bun run build`

### Workspace Tools

**CRITICAL**: See `../../docs/security/workspace-tools.md` for complete security patterns.

**Quick rules:**
- ✅ ALWAYS use `process.cwd()` (set by Bridge based on authenticated workspace)
- ❌ NEVER accept `workspaceRoot` parameter from Claude
- ✅ API tools: Use `callBridgeApi()` (auto-validated)
- ✅ Direct tools: Call `validateWorkspacePath()` explicitly

## Context Efficiency Best Practices

Following Anthropic's November 2024 MCP best practices:

1. **Progressive Disclosure**: Use `search_tools` for tool discovery with detail levels
2. **Context-Efficient Modes**: All tools should support summary/brief modes
3. **Filter Before Return**: Process data in tool, return only what's needed
4. **Detail Levels**: `minimal` (names) → `standard` (descriptions) → `full` (schemas)

Examples:
- `list_guides` has `detail_level: "brief" | "full"`
- `read_server_logs` has `summary_only: boolean`
- `search_tools` has `detail_level: "minimal" | "standard" | "full"`
