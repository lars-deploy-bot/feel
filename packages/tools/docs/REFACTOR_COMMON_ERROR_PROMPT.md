# Refactoring commonErrorPrompt: Move to Workflows

## The Problem

**Current State:**
- `commonErrorPrompt` is ~185 lines (~2000+ tokens)
- Added to **EVERY** request via `systemPrompt.ts`
- Contains decision trees, rules, examples, checklists
- **Bloats context on every turn**

**Lovable's Approach:**
- System prompt: **Minimal** (~500 tokens) - Core identity + critical rules only
- `<instructions-reminder>`: **Lightweight** core rules refreshed each turn
- Workflows: **Retrieved on-demand** via `get_workflow` tool
- Knowledge: **Retrieved on-demand** via tools

## Analysis: What Should Stay vs Move

### Keep in System Prompt (Critical, Always Needed)
- Core identity (design consultant + software engineer)
- Critical rules (no emojis, read CLAUDE.md, proactive investigation)
- Stripe integration rules
- **~50-100 tokens**

### Move to Workflows (Task-Specific)
- Decision trees → Already in workflows ✅
- Tool usage patterns → Should be in workflows
- Common mistakes → Should be in workflows
- Error recovery → Should be in workflows
- Testing checklists → Should be in workflows

### Move to Lightweight Reminder (Core Rules Only)
- Minimal changes philosophy
- Context awareness basics
- Design system basics
- **~100-200 tokens**

## Lovable's Pattern

**System Prompt (Minimal):**
```
You are Alive, an AI editor...
- Core identity
- Critical rules (no emojis, etc.)
- Reference workflows: "Use get_workflow tool for decision trees"
```

**Instructions Reminder (Lightweight, Each Turn):**
```
<instructions-reminder>
- Check context before reading files
- Parallel tool execution when possible
- Minimal changes only
- Use design system tokens
</instructions-reminder>
```

**Workflows (On-Demand):**
```
get_workflow({ workflow_type: "bug-debugging" })
→ Returns: Complete decision tree, tool sequences, rules, mistakes
```

## Refactoring Plan

### Step 1: Create Minimal System Prompt

**File**: `apps/web/features/chat/lib/systemPrompt.ts`

**Keep Only:**
- Core identity
- Critical rules (no emojis, read CLAUDE.md)
- Stripe integration
- Reference to workflows: "For decision trees and detailed patterns, use `get_workflow` tool"

**Remove:**
- All decision trees
- All examples
- All checklists
- All common mistakes
- All emergency protocols

**Result**: ~100 tokens instead of ~2000 tokens

### Step 2: Create Lightweight Instructions Reminder

**File**: `apps/web/features/chat/lib/work.ts`

**Create**: `coreInstructionsReminder` (~100-200 tokens)

**Include Only:**
- Minimal changes philosophy (1-2 sentences)
- Context awareness basics (check before reading)
- Design system basics (use semantic tokens)
- Parallel execution reminder

**Use**: Add to system prompt as optional reminder, or pass as separate context

### Step 3: Move Content to Workflows

**Files**: `packages/tools/workflows/*.md`

**Move From commonErrorPrompt:**
- Decision trees → Already in workflows ✅
- Tool usage patterns → Add to workflows
- Common mistakes → Add to workflows
- Error recovery → Add to workflows
- Testing checklists → Add to workflows

**Update Workflows:**
- `01-bug-debugging-request.md` → Add error recovery patterns
- `02-new-feature-request.md` → Add common mistakes, tool patterns
- `03-package-installation.md` → Add verification patterns

### Step 4: Update System Prompt Reference

**File**: `apps/web/features/chat/lib/systemPrompt.ts`

**Add:**
```
KNOWLEDGE DISCOVERY: For decision trees, tool patterns, common mistakes, and detailed workflows:
- Use \`get_workflow\` tool to retrieve workflow decision trees
- Workflows include: tool sequences, critical rules, common mistakes, error recovery patterns
- Available workflows: bug-debugging, new-feature, package-installation
```

## File Changes Summary

### Files to Modify:

1. **`apps/web/features/chat/lib/systemPrompt.ts`**
   - Remove: `commonErrorPrompt` import and usage
   - Add: Workflow reference
   - Keep: Core identity + critical rules only
   - **Result**: ~100 tokens instead of ~2000 tokens

2. **`apps/web/features/chat/lib/work.ts`**
   - Keep: `commonErrorPrompt` for now (backward compatibility)
   - Create: `coreInstructionsReminder` (lightweight version)
   - **Or**: Delete `commonErrorPrompt` entirely if workflows cover everything

3. **`packages/tools/workflows/01-bug-debugging-request.md`**
   - Add: Error recovery patterns from commonErrorPrompt
   - Add: Common mistakes section
   - Add: Testing checklist

4. **`packages/tools/workflows/02-new-feature-request.md`**
   - Add: Common mistakes section
   - Add: Tool usage patterns
   - Add: Testing checklist

5. **`packages/tools/workflows/03-package-installation.md`**
   - Add: Verification patterns
   - Add: Common mistakes

## Token Savings

**Before:**
- System prompt: ~200 tokens
- commonErrorPrompt: ~2000 tokens
- **Total per request: ~2200 tokens**

**After:**
- System prompt: ~100 tokens
- Instructions reminder: ~150 tokens (optional)
- Workflow (on-demand): ~500 tokens (only when retrieved)
- **Total per request: ~250 tokens (88% reduction!)**
- **When workflow needed: ~750 tokens (66% reduction)**

## Implementation Steps

1. **Create minimal system prompt** (remove commonErrorPrompt)
2. **Add workflow reference** to system prompt
3. **Update workflows** with content from commonErrorPrompt
4. **Test**: Verify workflows are retrieved when needed
5. **Remove commonErrorPrompt** (or keep as fallback)

## Benefits

1. **Massive token savings**: 88% reduction in system prompt size
2. **On-demand loading**: Workflows only loaded when needed
3. **Better organization**: Rules live with relevant workflows
4. **Easier maintenance**: Update workflows, not system prompt
5. **Progressive disclosure**: AI gets details only when needed

## Risk Mitigation

**Risk**: AI might not use workflows if not explicitly told

**Mitigation**:
1. Add clear instruction: "For decision trees, use `get_workflow` tool"
2. Make workflows discoverable via `search_tools`
3. Test that AI retrieves workflows appropriately
4. Keep `commonErrorPrompt` as fallback initially

## Next Steps

1. ✅ Create this analysis document
2. ⏭️ Refactor system prompt (remove commonErrorPrompt)
3. ⏭️ Update workflows with commonErrorPrompt content
4. ⏭️ Test workflow retrieval
5. ⏭️ Remove commonErrorPrompt entirely

