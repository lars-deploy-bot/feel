# Alive AI Agent Internal Architecture

> **Educational Resource**: This folder demonstrates the internal architecture that the Alive AI agent uses. These are NOT part of your application code - they're here to help engineers understand how the AI works.

## What is This?

When you interact with Alive's AI agent, it has access to several layers of infrastructure:
- **Read-only files**: System files it cannot modify
- **Virtual file systems**: Temporary storage for tool results
- **Tool API**: 31+ tools for code manipulation, debugging, security
- **Knowledge base**: Patterns and best practices
- **Execution model**: How requests are processed

This folder visualizes that internal architecture.

## Folder Structure

```
.Alive-internals/
├── read-only/              → Files the AI cannot modify
├── virtual-fs/             → Temporary file systems for tool results
├── tool-api/               → Documentation of all 31 tools
├── knowledge-base/         → Categories of built-in knowledge
└── execution-model/        → Request processing workflow
```

## Quick Navigation

| Want to understand... | Go to |
|----------------------|--------|
| What files AI can't touch | `read-only/` |
| Where parsed documents go | `virtual-fs/parsed-documents/` |
| What tools AI can use | `tool-api/` |
<!-- SUPABASE DISABLED: | What AI knows about Supabase | `knowledge-base/` | -->
| How AI processes requests | `execution-model/` |

## Important Notes

1. **This is NOT executable code** - It's educational documentation
2. **Don't modify system files** - The files referenced in `read-only/` are managed by Alive
3. **Virtual file systems are temporary** - They exist only during AI execution
4. **Tool calls happen automatically** - You don't invoke tools manually

## Relationship to Your Project

```
Your Project              Alive AI Internals
-----------              --------------------
src/                     → AI can read/write
components/              → AI can modify
server/                  → AI can create edge functions

package.json             → READ-ONLY (AI uses tools to modify)
tsconfig.json            → READ-ONLY
.gitignore               → READ-ONLY

[No direct access]       → virtual-fs/ (temporary storage)
[No direct access]       → tool-api/ (function calls)
[No direct access]       → knowledge-base/ (AI training)
```

## How the AI Works

1. **Receives your message** with context:
   - Your project files (`<current-code>`)
   - Knowledge base (`<useful-context>`)
   - UI state (`<current-view>`)

2. **Plans tool sequence** based on:
   - Decision trees from `/workflows/`
   - Best practices from `/guidance/`
   - Architecture principles from `/core/`

3. **Executes tools** (parallel when possible):
   - File operations: read, write, search, modify
   - Backend: enable Cloud, add secrets
   - Debug: logs, network, screenshots
   - Security: scans, findings

4. **Returns results** and updates state

## For More Details

- **User project architecture**: See `/workflows/architecture.md`
- **How AI makes decisions**: See `/workflows/README.md`
- **Platform architecture**: See `/core/01-platform-architecture.md`

---

**Last Updated**: 2025-01-27  
**Version**: 1.0.0
