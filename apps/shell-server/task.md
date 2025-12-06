# Shell Server File Editor Task

## Status: COMPLETE

The file editor portal has been implemented using **Preact components** (not inline HTML/JS).

## Architecture

```
src/client/
├── editor-main.tsx          # Editor entry point
├── api/
│   └── edit.ts              # API functions for editor
├── store/
│   └── editor.ts            # Editor state (signals)
└── components/
    └── editor/
        ├── EditorApp.tsx        # Main editor app
        ├── DirectorySelector.tsx # Directory dropdown
        ├── EditorFileTree.tsx   # File tree browser
        └── CodeEditor.tsx       # CodeMirror wrapper
```

## What Was Built

### 1. Homepage Update (dashboard.html)
- Added third button "Edit Files" to dashboard
- Updated grid layout to 3 columns on desktop (md:grid-cols-3)
- New button links to `/edit` route

### 2. File Editor Portal (/edit)
- **Preact-based** single-page app (no inline JS garbage)
- Directory selector dropdown
- File tree browser for allowed directories
- CodeMirror 5 editor with syntax highlighting
- Supported languages: JavaScript/TypeScript, Markdown, CSS, HTML, XML, YAML, Shell
- Save functionality with Ctrl+S shortcut
- Unsaved changes warning on page leave
- Dark theme (material-darker)

### 3. API Endpoints Created
- `POST /api/edit/list-files` - List files in editable directory
- `POST /api/edit/read-file` - Read file content (max 2MB)
- `POST /api/edit/write-file` - Save file content (max 2MB)

### 4. Configured Editable Directories
1. **Workflows** (`packages/tools/workflows/`)
   - AI agent decision trees and step-by-step guides
2. **Claude Skills** (`.claude/skills/`)
   - Claude Code skill definitions

### 5. Build Output
```
dist/
├── client/
│   ├── main.js      # Upload app (37.78 KB)
│   └── editor.js    # Editor app (31.1 KB)  <-- NEW
└── templates/
    └── edit.html    # Minimal shell loading editor.js
```

---

## Workflow System Explained

### What it is
The workflow system provides step-by-step decision trees that the AI agent loads on-demand. When a user asks "is my site ready to ship?" or "help me debug this", the agent calls `get_workflow({ workflow_type: "website-shippable-check" })` and receives a complete markdown guide with checklists, grep patterns, and decision logic.

### Where files live
All workflow files are in `packages/tools/workflows/` with a numbered naming convention like `01-bug-debugging-request.md`, `02-new-feature-request.md`, etc.

### How to register a new workflow
1. In `get-workflow.ts`, add to `WORKFLOW_CATEGORIES`
2. Add the filename mapping to `WORKFLOW_FILE_MAP`
3. Update `list-workflows.ts` to include it in the tool description
4. Run `make dev` to rebuild

### File permissions
Workflow files need 644 permissions (rw-r--r--). Run `chmod 644 packages/tools/workflows/your-file.md` for newly created files.

---

## Files Changed/Created
- `src/templates/dashboard.html` - 3-column grid + Edit button
- `src/templates/edit.html` - Minimal shell (loads Preact app)
- `src/index.ts` - Routes + API endpoints
- `src/client/editor-main.tsx` - Editor entry point
- `src/client/api/edit.ts` - API functions
- `src/client/store/editor.ts` - State management
- `src/client/components/editor/*.tsx` - UI components
- `package.json` - Updated build script
