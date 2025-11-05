# Tools Package - Claude Guidelines

## Documentation Rules

**CRITICAL**: Do NOT create implementation notes, changelogs, or other documentation files unless absolutely necessary.

- No `IMPLEMENTATION_NOTES.md`, `CHANGELOG.md`, `MIGRATION.md` etc. unless explicitly requested
- Code should be self-documenting through comments and types
- If documentation IS needed, always place in nested `/docs` folders (e.g., `docs/BEST_PRACTICES_BY_ANTHROPIC_NOV_4_ARTICLE.md`)
- Never clutter root directories with documentation files

## Tool Development

When adding new tools to this package:

1. Create tool file in appropriate category folder (`src/tools/<category>/`)
2. Export from `src/index.ts`
3. Register in `src/mcp-server.ts`
4. Update tool registry in `src/tools/meta/search-tools.ts`
5. Build: `bun run build`

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
