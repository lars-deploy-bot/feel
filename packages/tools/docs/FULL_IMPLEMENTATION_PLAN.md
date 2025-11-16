# Full Implementation Plan: Lovable Patterns

## What We've Done (10%)

✅ Created analysis docs:
- `LOVABLE_PATTERN_ANALYSIS.md`
- `IMPLEMENTATION_SYSTEM_PROMPT_AND_WORKFLOWS.md`
- `REDUCING_USER_PROMPTING.md`
- `REFACTOR_COMMON_ERROR_PROMPT.md`

✅ Created workflow markdown files:
- `01-bug-debugging-request.md`
- `02-new-feature-request.md`
- `03-package-installation.md`

✅ Updated system prompt:
- Replaced `commonErrorPrompt` with `coreInstructionsReminder`
- Added "HOW IT WORKS" blurb
- Added minimal `currentView` context

## What We Haven't Done (90%)

### 1. ❌ `get_workflow` Tool (CRITICAL)
**Status**: Documented but NOT implemented

**What's needed**:
- [ ] Create `packages/tools/src/tools/meta/get-workflow.ts`
- [ ] Implement tool that reads workflow markdown files
- [ ] Support detail levels (minimal, standard, full)
- [ ] Register in MCP server (`mcp-server.ts`)
- [ ] Add to tool registry (`tool-registry.ts`)
- [ ] Add to allowed tools in stream route
- [ ] Test tool retrieval

**Files to create/modify**:
```
packages/tools/src/tools/meta/get-workflow.ts (NEW)
packages/tools/src/mcp-server.ts (MODIFY - add tool)
packages/tools/src/tools/meta/tool-registry.ts (MODIFY - add metadata)
apps/web/app/api/claude/stream/route.ts (MODIFY - add to allowedTools)
```

### 2. ❌ Internal Documentation Structure (CRITICAL)
**Status**: Planned but NOT created

**What's needed**:
- [ ] Create `packages/tools/alive-patterns-folder-only-use-for-inspiration/` directory
- [ ] Create subdirectories:
  - `execution-model/`
  - `tool-api/`
  - `knowledge-base/`
  - `workspace-patterns/`
- [ ] Write `execution-model/README.md` (our request lifecycle)
- [ ] Write `tool-api/README.md` (our tool catalog)
- [ ] Write `knowledge-base/README.md` (our patterns)
- [ ] Write `workspace-patterns/README.md` (systemd, file ownership, paths)

**Files to create**:
```
packages/tools/alive-patterns-folder-only-use-for-inspiration/
├── README.md (overview)
├── execution-model/
│   └── README.md (request lifecycle: auth → intent → tools → execution → streaming → response)
├── tool-api/
│   └── README.md (workspace tools, debug tools, guide tools, SDK tools)
├── knowledge-base/
│   └── README.md (workspace management, security, deployment, architecture)
└── workspace-patterns/
    ├── README.md
    ├── systemd-management.md
    ├── file-ownership.md
    └── path-validation.md
```

### 3. ❌ Auto-Prerequisite Checking (HIGH IMPACT)
**Status**: Documented but NOT implemented in workflows

**What's needed**:
- [ ] Update `02-new-feature-request.md` with auto-check logic
- [ ] Add package detection patterns
- [ ] Add auto-install before implementation
- [ ] Test with real feature requests

**Example workflow update**:
```markdown
├─→ AUTO-CHECK PREREQUISITES (NEW):
│   ├─→ Analyze feature description for needed packages
│   │   ├─→ Date/time operations → date-fns, dayjs
│   │   ├─→ Forms → react-hook-form, zod
│   │   ├─→ HTTP requests → axios, ky
│   │   ├─→ State management → zustand (already installed)
│   │   └─→ UI components → Check existing design system first
│   │
│   ├─→ For each needed package:
│   │   ├─→ Grep("package-name", "package.json")
│   │   ├─→ IF NOT FOUND:
│   │   │   └─→ install_package({ package: "package-name" }) AUTOMATICALLY
│   │   └─→ Wait for installation to complete
│   │
│   └─→ THEN proceed with implementation
```

### 4. ❌ Auto-Error Recovery (HIGH IMPACT)
**Status**: Documented but NOT implemented in workflows

**What's needed**:
- [ ] Update `01-bug-debugging-request.md` with auto-fix logic
- [ ] Add error pattern detection
- [ ] Add auto-fix for common errors
- [ ] Test with real errors

**Example workflow update**:
```markdown
├─→ AUTO-FIX COMMON ERRORS (NEW):
│   ├─→ After check_codebase({}), analyze errors:
│   │
│   ├─→ IF "Cannot find module 'package-name'":
│   │   ├─→ Extract package name from error message
│   │   ├─→ install_package({ package: "package-name" }) AUTOMATICALLY
│   │   ├─→ check_codebase({}) again
│   │   └─→ Report: "Fixed import error, installed package-name"
│   │
│   ├─→ IF "Property 'x' does not exist on type 'y'":
│   │   ├─→ Common type errors:
│   │   │   ├─→ Missing optional chaining → Add ?. operator
│   │   │   ├─→ Missing null check → Add if (x) guard
│   │   │   └─→ Wrong type assertion → Fix type
│   │   └─→ Fix automatically if pattern matches
│   │
│   ├─→ IF syntax error (missing semicolon, bracket, etc.):
│   │   └─→ Fix automatically
│   │
│   └─→ IF still errors after auto-fix:
│       └─→ Report to user with context
```

### 5. ❌ Enhanced Context Awareness (HIGH IMPACT)
**Status**: Only minimal page URL tracking implemented

**What's needed**:
- [ ] Track selected file (from chat input or file browser)
- [ ] Track recently modified files (last 10 changes)
- [ ] Track open files (if we have a file browser)
- [ ] Add structured context to system prompt
- [ ] Test context usage in responses

**Files to modify**:
```
apps/web/app/chat/page.tsx (track more context)
apps/web/features/chat/lib/systemPrompt.ts (use structured context)
apps/web/app/api/claude/stream/route.ts (forward context)
```

**Example context structure**:
```typescript
interface CurrentView {
  page: string                    // URL path: "/chat"
  selectedFile?: string           // "src/components/Header.tsx"
  recentChanges: Array<{          // Last 10 file changes
    file: string
    timestamp: Date
    action: "created" | "modified" | "deleted"
  }>
  openFiles?: string[]            // If we have file browser
}
```

### 6. ❌ Tool Discovery & Search (VERIFY/ENHANCE)
**Status**: `search_tools` mentioned but need to verify

**What's needed**:
- [ ] Verify `search_tools` tool exists and works
- [ ] Enhance to search internal docs if needed
- [ ] Test discovery flow

### 7. ❌ Testing & Validation
**Status**: None

**What's needed**:
- [ ] Test `get_workflow` tool retrieval
- [ ] Test auto-prerequisite checking
- [ ] Test auto-error recovery
- [ ] Test context awareness
- [ ] Measure prompt reduction (before/after)

## Implementation Order (By Impact)

### Phase 1: Core Tools (Week 1)
**Highest Impact**: Enables on-demand workflows

1. Create `get_workflow` tool implementation
2. Register tool in MCP server
3. Add to allowed tools
4. Test workflow retrieval
5. Verify AI uses workflows when appropriate

**Files**:
- `packages/tools/src/tools/meta/get-workflow.ts` (NEW)
- `packages/tools/src/mcp-server.ts` (ADD tool)
- `packages/tools/src/tools/meta/tool-registry.ts` (ADD metadata)
- `apps/web/app/api/claude/stream/route.ts` (ADD to allowedTools)

**Estimated**: 2-3 hours

### Phase 2: Internal Docs Structure (Week 1)
**High Impact**: Provides discoverable knowledge

1. Create directory structure
2. Write execution-model docs (request lifecycle)
3. Write tool-api docs (tool catalog)
4. Write knowledge-base docs (patterns)
5. Test discoverability

**Files**:
- `packages/tools/alive-patterns-folder-only-use-for-inspiration/` (NEW directory)
- Multiple README.md files for each category

**Estimated**: 3-4 hours

### Phase 3: Auto-Checking (Week 2)
**Highest Impact**: Reduces user prompting by 60%

1. Update `02-new-feature-request.md` with auto-check logic
2. Add package detection patterns
3. Test with real feature requests
4. Measure prompt reduction

**Files**:
- `packages/tools/workflows/02-new-feature-request.md` (ENHANCE)

**Estimated**: 1-2 hours

### Phase 4: Auto-Error Recovery (Week 2)
**High Impact**: Reduces error-related prompting by 50%

1. Update `01-bug-debugging-request.md` with auto-fix logic
2. Add error pattern detection
3. Test with real errors
4. Measure recovery success rate

**Files**:
- `packages/tools/workflows/01-bug-debugging-request.md` (ENHANCE)

**Estimated**: 1-2 hours

### Phase 5: Enhanced Context (Week 2)
**High Impact**: Reduces "which file?" questions by 70%

1. Track selected file in chat page
2. Track recent file changes
3. Add structured context to system prompt
4. Test context usage

**Files**:
- `apps/web/app/chat/page.tsx` (ENHANCE tracking)
- `apps/web/features/chat/lib/systemPrompt.ts` (USE context)
- `apps/web/app/api/claude/stream/route.ts` (FORWARD context)

**Estimated**: 2-3 hours

### Phase 6: Testing & Validation (Week 3)
**Critical**: Ensure everything works

1. Test all new tools
2. Test workflows end-to-end
3. Test auto-checking/recovery
4. Measure impact (prompt reduction, error recovery)
5. Iterate based on results

**Estimated**: 4-6 hours

## Total Estimated Time

- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 1-2 hours
- Phase 4: 1-2 hours
- Phase 5: 2-3 hours
- Phase 6: 4-6 hours

**Total**: 13-20 hours (about 2-3 weeks at moderate pace)

## Success Metrics

### Before (Current State)
- System prompt: ~250 tokens
- User prompts per task: 3-5
- Error resolution: Manual (user must ask)
- Context questions: Frequent ("which file?", "which page?")

### After (Target State)
- System prompt: ~300 tokens (minimal increase)
- User prompts per task: 1-2 (60% reduction)
- Error resolution: Automatic (50%+ auto-fixed)
- Context questions: Rare (70% reduction)

## Next Action

**Start with Phase 1**: Create `get_workflow` tool (highest leverage, enables everything else)

Do you want me to:
1. Start implementing Phase 1 now (`get_workflow` tool)?
2. Create Phase 2 (internal docs structure)?
3. Both in parallel?

