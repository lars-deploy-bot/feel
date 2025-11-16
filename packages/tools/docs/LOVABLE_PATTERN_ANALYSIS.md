# Lovable Pattern Analysis: On-Demand Knowledge Discovery

## Executive Summary

Lovable's approach uses **structured, discoverable documentation** that the AI retrieves **on-demand** rather than loading everything into the system prompt. This prevents prompt bloat while providing comprehensive knowledge when needed.

**Key Insight**: Instead of a massive system prompt, Lovable provides:
1. **Lightweight system prompt** with core behavioral rules
2. **Structured knowledge base** organized by category (guides, workflows, patterns)
3. **Tool-based discovery** (`search_tools`, `find_guide`, `list_guides`) for progressive disclosure
4. **Execution model documentation** that explains HOW the AI should work, not just WHAT it knows

## What's Good About Lovable's Approach

### 1. **Progressive Disclosure Pattern**

**Lovable's Pattern:**
- System prompt: ~500 tokens (core rules only)
- Knowledge base: Retrieved via tools when needed
- Tools support `detail_level`: `minimal` → `standard` → `full`

**Our Current State:**
- System prompt: ~200 tokens (relatively clean)
- Guides: Available via `get_guide` / `list_guides` tools ✅
- But: No structured "execution model" or "tool API" documentation

**What We Can Learn:**
- Keep system prompt minimal (core identity + critical rules)
- Use tools for knowledge discovery (we already do this!)
- Add detail levels to more tools for context efficiency

### 2. **Structured Knowledge Organization**

**Lovable's Structure:**
```
.Alive-internals/
├── read-only/              → What AI can't modify
├── virtual-fs/             → Temporary storage patterns
├── tool-api/               → Complete tool specifications
├── knowledge-base/         → Categorized patterns
└── execution-model/        → HOW AI processes requests
```

**Our Current Structure:**
```
packages/tools/
├── lovable-folder-only-use-for-inspiration/  → Lovable reference (inspiration only)
│   ├── 30-guides/
│   ├── workflows/
│   └── extra/  → execution-model, tool-api, knowledge-base (Lovable's patterns)
├── src/tools/
│   ├── guides/  → Tools to retrieve guides
│   └── meta/    → Tool discovery
```

**What We Need:**
```
packages/tools/
└── alive-patterns-folder-only-use-for-inspiration/  → OUR patterns (to be created)
    ├── execution-model/  → OUR request lifecycle
    ├── tool-api/        → OUR tool catalog
    ├── knowledge-base/  → OUR knowledge categories
    └── workspace-patterns/  → OUR workspace management patterns
```

**What We Can Learn:**
- Create our OWN pattern folder structure (not copy Lovable's)
- Document OUR execution model (how OUR tools work)
- Document OUR tool API (what tools exist, when to use them)
- Organize OUR knowledge base by OUR categories

### 3. **Execution Model Documentation**

**Lovable's Approach:**
- Documents the complete request lifecycle (11 steps)
- Explains decision trees and workflow matching
- Shows parallel vs sequential execution patterns
- Documents state management and token budgets

**Our Current State:**
- No structured execution model documentation
- Workflow patterns exist but aren't documented for AI
- Tool usage patterns exist but aren't discoverable

**What We Can Learn:**
- Document OUR request lifecycle:
  1. Request ingestion (workspace auth, session resume)
  2. Intent analysis (what does user want?)
  3. Tool selection (which tools to use?)
  4. Execution (parallel when possible)
  5. Result processing (streaming, tool results)
  6. Response generation (SSE events, message grouping)

### 4. **Tool API Documentation**

**Lovable's Approach:**
- Complete catalog of 31 tools with categories
- Clear descriptions of when to use each tool
- Examples of parallel execution patterns
- Tool priority guidelines (file ops → backend → debug → security)

**Our Current State:**
- Tool registry exists (`tool-registry.ts`) ✅
- `search_tools` tool for discovery ✅
- But: No structured "tool API" documentation that AI can read

**What We Can Learn:**
- Create `internals-folder/tool-api/README.md` documenting OUR tools
- Organize by category (workspace, debug, guides, templates, batch)
- Include usage patterns and priority guidelines
- Reference from execution model docs

### 5. **Knowledge Base Organization**

**Lovable's Approach:**
- Categories: API keys, file ops, security, platform docs, design system
- Each category has specific patterns
- Injected via `<useful-context>` tags (but still tool-discoverable)

**Our Current State:**
- Guides exist in `lovable-folder-only-use-for-inspiration/30-guides/`
- But: These are Lovable-specific (not our patterns)
- We have `docs/` folders but they're not tool-discoverable

**What We Can Learn:**
- Create OUR knowledge base categories:
  - Workspace management (systemd, PM2, file ownership)
  - Security (workspace enforcement, path validation, auth)
  - Deployment (Caddy, subdomains, DNS verification)
  - Architecture (streaming, message handling, session management)
  - Tools (MCP servers, tool registration, progressive disclosure)

### 6. **Read-Only Files Documentation**

**Lovable's Approach:**
- Documents which files AI can't modify
- Explains WHY (system integrity, version control)
- Shows HOW to modify via tools instead

**Our Current State:**
- No explicit read-only file documentation
- Workspace enforcement prevents path traversal ✅
- But: No documentation explaining what's protected and why

**What We Can Learn:**
- Document OUR read-only patterns:
  - System files (Caddyfile, systemd units)
  - Workspace boundaries (can't access outside `/srv/webalive/sites/*`)
  - Tool permissions (workspace tools vs general tools)

### 7. **Virtual File Systems (Not Applicable)**

**Lovable's Approach:**
- Documents temporary storage locations (`tmp://`, `user-uploads://`, etc.)
- Explains lifecycle and cleanup

**Our Current State:**
- We don't have virtual file systems (different architecture)
- Files are written directly to workspace

**What We Can Learn:**
- Nothing here (different architecture)
- But: Could document OUR file patterns (workspace structure, ownership)

## Key Differences: Lovable vs Our System

| Aspect | Lovable | Our System |
|--------|---------|------------|
| **Architecture** | Single-user web app | Multi-workspace platform |
| **File System** | Virtual FS (tmp://) | Direct workspace files |
| **Backend** | Supabase (disabled) | Bridge API + systemd |
| **Tools** | 31 built-in tools | MCP tools + SDK tools |
| **Knowledge** | Platform-specific | Workspace management focused |
| **Execution** | Single conversation | Multi-workspace, session resume |

## What We Should Implement

### Phase 1: Create Our Own Pattern Folder Structure

**Location**: `packages/tools/alive-patterns-folder-only-use-for-inspiration/` (following naming convention)

**Structure:**
```
alive-patterns-folder-only-use-for-inspiration/
├── README.md                    → Overview (like Lovable's main README)
├── execution-model/
│   └── README.md                → OUR request lifecycle (6 steps, not 11)
├── tool-api/
│   └── README.md                → OUR tool catalog (workspace, debug, guides, etc.)
├── knowledge-base/
│   └── README.md                → OUR knowledge categories
├── workspace-patterns/
│   ├── README.md                → Workspace management patterns
│   ├── systemd-management.md
│   ├── file-ownership.md
│   └── path-validation.md
└── security-patterns/
    ├── README.md
    ├── workspace-enforcement.md
    └── authentication.md
```

**Note**: Following the naming pattern of `lovable-folder-only-use-for-inspiration/`, we create our own parallel structure for OUR patterns.

### Phase 2: Document Execution Model

**Content Should Cover:**
1. **Request Ingestion**
   - Workspace authentication (`isWorkspaceAuthenticated`)
   - Session resume (`SessionStoreMemory.get`)
   - Conversation locking (prevents concurrent requests)

2. **Intent Analysis**
   - What does user want? (feature, bug fix, question)
   - Which workspace? (resolved from host or default)
   - What context exists? (current files, conversation history)

3. **Tool Selection**
   - Workspace tools vs general tools
   - Tool discovery via `search_tools`
   - Progressive disclosure (minimal → standard → full)

4. **Execution**
   - Parallel when possible (multiple file reads)
   - Sequential when dependencies exist
   - Workspace path validation (always!)

5. **Result Processing**
   - SSE streaming (`start` → `message` → `session` → `complete`)
   - Tool result tracking (`toolUseMap`)
   - Message grouping (text vs tool messages)

6. **Response Generation**
   - Message rendering (AssistantMessage, ToolResult, etc.)
   - Error handling (workspace errors, tool failures)
   - Session persistence (for resume)

### Phase 3: Document Tool API

**Content Should Cover:**
- **Workspace Tools** (`alive-workspace` MCP server):
  - `restart_dev_server` - Restart systemd service
  - `install_package` - Install via bun (workspace user)
  - `check_codebase` - TypeScript + ESLint checks

- **Debug Tools** (`alive-tools` MCP server):
  - `read_server_logs` - Systemd logs with filtering
  - `debug_workspace` - Composite debugging tool
  - `search_tools` - Tool discovery

- **Guide Tools** (`alive-tools` MCP server):
  - `list_guides` - Browse guide categories
  - `get_guide` - Retrieve specific guide
  - `find_guide` - Search guides by query

- **Template Tools** (`alive-tools` MCP server):
  - `get_alive_super_template` - Retrieve template content

- **SDK Tools** (always available):
  - `Read`, `Write`, `Edit`, `Glob`, `Grep`
  - Workspace-scoped (path validation enforced)

### Phase 4: Document Knowledge Base

**Categories:**
1. **Workspace Management**
   - Systemd service management
   - File ownership patterns (child process UID switching)
   - Workspace path structure (`/srv/webalive/sites/*`)

2. **Security**
   - Workspace enforcement (path validation)
   - Authentication (JWT, session cookies)
   - Tool permissions (whitelist, MCP prefix)

3. **Deployment**
   - Caddy configuration (subdomains, DNS)
   - PM2 process management
   - Environment variables

4. **Architecture**
   - Streaming (SSE events, cancellation)
   - Message handling (parsing, grouping)
   - Session management (resume, locking)

5. **Tools**
   - MCP server registration
   - Tool discovery patterns
   - Progressive disclosure best practices

### Phase 5: Make It Discoverable

**Update Tools:**
- `find_guide` should search `internals-folder/` too
- `list_guides` should include internals categories
- `search_tools` already works ✅

**Or Create New Tool:**
- `get_internal_doc(category, topic)` - Retrieve internals documentation
- Categories: `execution-model`, `tool-api`, `knowledge-base`, `workspace-patterns`, `security-patterns`

## Implementation Strategy

### Step 1: Create Structure (No Code Changes)
1. Create `packages/tools/alive-patterns-folder-only-use-for-inspiration/` directory
2. Create subdirectories: `execution-model/`, `tool-api/`, `knowledge-base/`, `workspace-patterns/`, `security-patterns/`
3. Create `README.md` files for each (start with placeholders)

### Step 2: Document Execution Model
1. Write `execution-model/README.md` covering OUR 6-step lifecycle
2. Include examples specific to our architecture (workspace auth, session resume, SSE streaming)
3. Reference our actual tools and patterns

### Step 3: Document Tool API
1. Write `tool-api/README.md` cataloging OUR tools
2. Organize by MCP server (`alive-tools`, `alive-workspace`)
3. Include usage patterns and priority guidelines

### Step 4: Document Knowledge Base
1. Write `knowledge-base/README.md` listing OUR categories
2. Create category-specific docs (workspace-patterns, security-patterns)
3. Link to existing `docs/` folders where appropriate

### Step 5: Make Discoverable
1. Update `find_guide` to search `alive-patterns-folder-only-use-for-inspiration/` (or create `get_internal_doc` tool)
2. Update `list_guides` to include pattern categories
3. Test discovery via tools

### Step 6: Update System Prompt (Minimal)
1. Add ONE line: "For detailed execution patterns, tool API, and knowledge base, use `find_guide` or `get_internal_doc` tools."
2. Keep system prompt focused on core identity and critical rules

## Benefits

1. **No Prompt Bloat**: Knowledge retrieved on-demand, not loaded upfront
2. **Discoverable**: AI can search and find relevant patterns
3. **Maintainable**: Documentation lives in files, not in code
4. **Context Efficient**: Progressive disclosure (minimal → full detail)
5. **Our Patterns**: Documents OUR architecture, not Lovable's

## Anti-Patterns to Avoid

1. ❌ **Don't copy Lovable's content** - Document OUR patterns
2. ❌ **Don't load everything into system prompt** - Use tools for discovery
3. ❌ **Don't create virtual FS docs** - We don't have that architecture
4. ❌ **Don't document Supabase** - We use Bridge API + systemd
5. ❌ **Don't make it too complex** - Start simple, iterate

## Next Steps

1. **Review this analysis** - Confirm approach aligns with goals
2. **Decide on folder name** - Confirm `alive-patterns-folder-only-use-for-inspiration/` or alternative
3. **Create pattern folder structure** - Set up directories
4. **Write execution-model docs** - Document OUR lifecycle
5. **Write tool-api docs** - Catalog OUR tools
6. **Write knowledge-base docs** - Organize OUR patterns
7. **Make discoverable** - Update tools or create new tool
8. **Test** - Verify AI can discover and use documentation

## Questions to Answer

1. **What should we name our pattern folder?**
   - Option A: `alive-patterns-folder-only-use-for-inspiration/` (matches naming convention)
   - Option B: `alive-internals-folder-only-use-for-inspiration/`
   - Option C: `alive-knowledge-folder-only-use-for-inspiration/`
   - **Recommendation**: Option A (clear, follows existing pattern)

2. **Should we reuse `find_guide` or create `get_internal_doc`?**
   - Option A: Extend `find_guide` to search `alive-patterns-folder-only-use-for-inspiration/`
   - Option B: Create new `get_internal_doc` tool
   - **Recommendation**: Option A (simpler, consistent interface)

3. **Should internals docs be markdown files or structured data?**
   - Option A: Markdown files (like guides)
   - Option B: Structured JSON/YAML
   - **Recommendation**: Option A (easier to write and maintain)

4. **How detailed should execution-model docs be?**
   - Option A: High-level overview (like Lovable's README)
   - Option B: Detailed step-by-step (like Lovable's full doc)
   - **Recommendation**: Option B (more useful for AI, but start with A and iterate)

