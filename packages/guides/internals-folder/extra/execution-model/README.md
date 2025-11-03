# Execution Model

## How Lovable AI Processes Requests

### Complete Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. REQUEST INGESTION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Message → Lovable Platform → AI Agent Runtime             │
│                                                                  │
│  Context Injection:                                              │
│  • <current-code>        → Project files (summary or full)      │
│  • <useful-context>      → Knowledge base (20+ patterns)        │
│  • <current-view>        → UI state (open files, search)        │
│  • <dependencies>        → npm packages with versions           │
│  • <read-only-files>     → List of protected files              │
│  • <instructions-reminder> → Behavioral rules                   │
│  • <role>                → Identity and capabilities            │
│                                                                  │
│  Conversation History:                                           │
│  • Previous user messages                                        │
│  • Previous AI responses                                         │
│  • Previous tool calls and results                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. INTENT ANALYSIS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Question 1: What does the user want?                           │
│  ├─→ Implement feature (new-feature-request)                    │
│  ├─→ Debug issue (bug-debugging-request)                        │
│  ├─→ Add authentication (authentication-request)                │
│  ├─→ Style changes (styling-design-request)                     │
│  ├─→ Security audit (security-audit-request)                    │
│  ├─→ Performance fix (performance-optimization-request)         │
│  ├─→ API integration (external-api-integration)                 │
│  ├─→ Database work (database-table-creation)                    │
│  ├─→ File upload (file-upload-storage)                          │
│  └─→ Just discussion (no code changes)                          │
│                                                                  │
│  Question 2: Is this a code request or discussion?              │
│  ├─→ Discussion: Provide explanation, no tools                  │
│  └─→ Code request: Proceed to workflow matching                 │
│                                                                  │
│  Question 3: Does feature already exist?                        │
│  ├─→ YES: Inform user, no implementation                        │
│  └─→ NO: Proceed to implementation planning                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. WORKFLOW SELECTION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Match request to workflow document:                             │
│  • /workflows/01-authentication-request.md                       │
│  • /workflows/02-bug-debugging-request.md                        │
│  • /workflows/03-new-feature-request.md                          │
│  • /workflows/04-external-api-integration.md                     │
│  • /workflows/05-styling-design-request.md                       │
│  • /workflows/06-database-table-creation.md                      │
│  • /workflows/07-file-upload-storage.md                          │
│  • /workflows/08-security-audit-request.md                       │
│  • /workflows/09-performance-optimization-request.md             │
│                                                                  │
│  Load workflow decision tree                                     │
│  Load critical rules                                             │
│  Load common mistakes to avoid                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. PREREQUISITE CHECK                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Check: Backend enabled?                                         │
<!-- SUPABASE DISABLED: │  ├─→ NO + needed: Call supabase--enable() → WAIT for user       │ -->
│  └─→ YES: Continue                                               │
│                                                                  │
│  Check: Secrets exist?                                           │
│  ├─→ NO + needed: Call secrets--add_secret() → WAIT for user    │
│  └─→ YES: Continue                                               │
│                                                                  │
│  Check: Dependencies installed?                                  │
│  ├─→ NO + needed: Call lov-add-dependency() in parallel          │
│  └─→ YES: Continue                                               │
│                                                                  │
│  Check: Files in context?                                        │
│  ├─→ NO: Plan lov-view() calls                                  │
│  └─→ YES: Skip reading                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    5. CONTEXT GATHERING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Parallel file reading (when possible):                          │
│  lov-view(src/App.tsx) ||                                        │
│  lov-view(src/components/Header.tsx) ||                          │
│  lov-view(src/hooks/useAuth.ts)                                  │
│                                                                  │
│  Code search (if needed):                                        │
│  lov-search-files(query="useState", include_pattern="src/**")    │
│                                                                  │
│  Debugging data (if bug):                                        │
│  lov-read-console-logs() ||                                      │
│  lov-read-network-requests() ||                                  │
│  project_debug--sandbox-screenshot("/page")                      │
│                                                                  │
│  Web search (if needed):                                         │
│  websearch--web_code_search("React 18 new features")             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    6. PLANNING PHASE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Analyze gathered context                                        │
│  Determine required changes                                      │
│  Identify files to modify                                        │
│  Check if refactoring needed                                     │
│                                                                  │
│  Planning Questions:                                             │
│  ├─→ Can changes be parallel? (prefer YES)                      │
│  ├─→ Are there dependencies between changes?                    │
│  ├─→ Should I create new files or modify existing?              │
│  ├─→ Do I need to break down large files?                       │
│  └─→ What's the minimal change to achieve goal?                 │
│                                                                  │
│  Tool Selection:                                                 │
│  ├─→ Small changes: lov-line-replace (preferred)                │
│  ├─→ New files: lov-write                                        │
│  ├─→ Complete rewrites: lov-write (rare)                        │
│  └─→ Refactoring: Create new files + update imports             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    7. EXECUTION PHASE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Parallel Tool Execution (when independent):                     │
│  lov-write(src/components/NewComponent.tsx, content) ||          │
│  lov-line-replace(src/App.tsx, add_import) ||                    │
│  lov-line-replace(src/routes.tsx, add_route)                     │
│                                                                  │
│  Sequential Tool Execution (when dependent):                     │
│  1. lov-write(src/hooks/useAPI.ts, hook_code)                   │
│  2. WAIT for result                                              │
│  3. lov-line-replace(src/components/Dashboard.tsx, use_hook)     │
│                                                                  │
│  Tool Execution Rules:                                           │
│  • Always check useful-context before lov-view                  │
│  • Never read files already in context                          │
│  • Prefer lov-line-replace over lov-write                       │
│  • Create focused files (components, hooks, utils)              │
│  • Never modify read-only files directly                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    8. RESULT PROCESSING                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Receive tool results:                                           │
│  • Success messages                                              │
│  • File contents (from lov-view)                                │
│  • Search results (from lov-search-files)                       │
│  • Error messages (if any)                                       │
│  • Large outputs → tool-results:// files                         │
│                                                                  │
│  Update internal state:                                          │
│  • Add file contents to context                                  │
│  • Store tool outputs                                            │
│  • Mark files as modified                                        │
│  • Track token usage                                             │
│                                                                  │
│  Error Handling:                                                 │
│  ├─→ Tool failed: Analyze error, retry or alternative approach  │
│  ├─→ File not found: Create it or ask user for clarification    │
│  ├─→ Syntax error: Fix and retry                                │
│  └─→ Permission denied: Check read-only list                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    9. ITERATION DECISION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Question: Is task complete?                                     │
│  ├─→ YES: Go to VERIFICATION                                    │
│  └─→ NO: Return to EXECUTION PHASE                              │
│                                                                  │
│  Reasons to iterate:                                             │
│  • Need to read newly created files                             │
│  • Need to make dependent changes                               │
│  • Need to fix errors from previous execution                   │
│  • Need to create additional files                              │
│  • Need to update related code                                  │
│                                                                  │
│  Anti-patterns to avoid:                                         │
│  ❌ Infinite loops (track iteration count)                      │
│  ❌ Redundant file reads                                        │
│  ❌ Unnecessary refactoring                                     │
│  ❌ Scope creep (adding unasked features)                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    10. VERIFICATION                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  For Backend Changes:                                            │
│  • Provide SQL for user to execute                              │
│  • Explain what SQL does                                         │
<!-- SUPABASE DISABLED: │  • Provide lov-link to Supabase dashboard                       │ -->
│                                                                  │
│  For Bug Fixes:                                                  │
│  • Re-run debugging tools                                        │
│  • Verify errors are gone                                        │
│  • Take screenshot to confirm UI fix                             │
│                                                                  │
│  For Security:                                                   │
│  • Mark findings as resolved                                     │
│  • Explain what was fixed                                        │
│  • List remaining vulnerabilities                                │
│                                                                  │
│  For Performance:                                                │
│  • Check console logs for warnings                               │
│  • Check network requests for improvements                       │
│  • Provide before/after metrics                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    11. RESPONSE GENERATION                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Response Structure:                                             │
│  1. Brief intro (1-2 lines max)                                 │
│  2. Changes made (bulleted list)                                │
│  3. SQL to execute (if applicable, in code block)               │
│  4. lov-actions (links to docs, dashboard, etc.)                │
│  5. Concise conclusion (1 line)                                 │
│                                                                  │
│  Response Rules:                                                 │
│  • NO EMOJIS                                                     │
│  • Super concise (unless user asks for detail)                  │
│  • Focus on what changed, not how                               │
│  • Provide actionable next steps if needed                      │
│  • Use lov-actions for external links                           │
│                                                                  │
│  Example Response:                                               │
│  "I'll add authentication with email/password.                   │
│                                                                  │
│  Created:                                                        │
│  - Auth context (src/contexts/AuthContext.tsx)                  │
│  - Login page (src/pages/Login.tsx)                             │
│  - Protected route wrapper (src/components/ProtectedRoute.tsx)  │
│                                                                  │
<!-- SUPABASE DISABLED: │  Run this SQL in Supabase:                                       │ -->
│  ```sql                                                          │
│  CREATE TABLE profiles...                                        │
│  ```                                                             │
│                                                                  │
│  <lov-actions>                                                   │
<!-- SUPABASE DISABLED: │    <lov-link url='...'>Supabase Dashboard</lov-link>            │ -->
│  </lov-actions>                                                  │
│                                                                  │
│  Authentication is now set up."                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Execution Strategies

### Parallel-First Approach

**Rule:** Always prefer parallel tool execution when operations are independent.

```typescript
// ✅ CORRECT: Parallel execution
lov-write(src/components/A.tsx, contentA) ||
lov-write(src/components/B.tsx, contentB) ||
lov-write(src/components/C.tsx, contentC)

// ❌ WRONG: Sequential when parallel is possible
lov-write(src/components/A.tsx, contentA)
// wait
lov-write(src/components/B.tsx, contentB)
// wait
lov-write(src/components/C.tsx, contentC)
```

**Benefits:**
- 5x faster for complex changes
- Better token efficiency
- Reduced latency
- Improved user experience

### Dependency Management

**When to use sequential:**

```typescript
// File B depends on File A existing
1. lov-write(src/hooks/useAPI.ts, hook_code)
2. WAIT for success
3. lov-line-replace(src/components/Dashboard.tsx, import_and_use_hook)

// Need to read before modifying
1. lov-view(src/App.tsx)
2. WAIT for content
3. lov-line-replace(src/App.tsx, add_route)
```

### Context-First Optimization

**Critical Rule:** Never read files already in `<useful-context>` or `<current-code>`.

```typescript
// ❌ WRONG: Reading file that's in context
<current-code>
  <file path="src/App.tsx">
    // ... full content here
  </file>
</current-code>

// User asks: "Update App.tsx"
lov-view(src/App.tsx) // WASTEFUL! Already in context

// ✅ CORRECT: Use context directly
lov-line-replace(src/App.tsx, make_change)
```

## State Management

### Conversation State

```typescript
interface ConversationState {
  messages: Message[];              // All user + AI turns
  toolCalls: ToolCall[];           // All executed tools
  toolResults: ToolResult[];       // All tool outputs
  loadedFiles: Map<string, string>; // File path → content
  tokenUsage: {
    total: number;                 // Total tokens used
    limit: number;                 // 200,000 token limit
    remaining: number;             // Tokens left
  };
  modifiedFiles: Set<string>;      // Files changed this session
  createdFiles: Set<string>;       // Files created this session
}
```

### Context Window Management

**Token Budget:** 200,000 tokens per conversation

**Token Allocation:**
- System prompt + role: ~5,000 tokens
- Useful-context: ~20,000 tokens
- Current-code (summary): ~10,000 tokens
- Conversation history: Variable
- Tool results: Variable
- Response generation: ~2,000 tokens

**When approaching limit:**
- Summarize earlier conversation
- Remove old tool results
- Load only necessary files
- Use file summaries instead of full content

## Error Recovery Patterns

### Tool Failure Recovery

```
Tool fails → Analyze error → Determine cause → Choose strategy:

1. Retry with fix:
   - Syntax error → Fix and retry
   - File not found → Create it first
   - Invalid parameter → Correct and retry

2. Alternative approach:
   - lov-write failed → Try lov-line-replace
   - Search failed → Try different pattern
   - Tool not available → Use different tool

3. Ask user:
   - Ambiguous requirement → Clarify
   - Missing information → Request
   - Destructive operation → Confirm
```

### Build Failure Recovery

```
Build fails → Read console logs → Identify error → Fix:

1. Import errors:
   - Add missing import
   - Fix import path
   - Install missing package

2. Type errors:
   - Add missing types
   - Fix type mismatches
   - Add type assertions

3. Syntax errors:
   - Fix typos
   - Add missing brackets
   - Fix JSX structure
```

## Critical Execution Rules

### 1. Never Read Files in Context
If file is in `<current-code>` or previously loaded, use it directly.

### 2. Always Check Prerequisites
Backend, secrets, dependencies must exist before using them.

### 3. Parallel When Possible
Independent operations always execute in parallel.

### 4. Minimal Changes Only
Change exactly what user asked for, nothing more.

### 5. Never Execute SQL
Always provide SQL to user. Cannot execute directly.

### 6. Verify Before Completing
Use debugging tools to confirm fixes work.

### 7. Focused File Creation
Create small components, hooks, utils - not monolithic files.

### 8. Use Design System
Never direct colors (text-white, bg-black). Always semantic tokens.

### 9. Security First
Input validation, RLS policies, secrets management.

### 10. Educate About Features
Tell users about Visual Edits for simple changes.

## Performance Optimizations

### Tool Call Batching
```typescript
// Instead of 5 sequential calls:
lov-view(file1) → lov-view(file2) → lov-view(file3)...

// Batch in parallel:
lov-view(file1) || lov-view(file2) || lov-view(file3) || lov-view(file4) || lov-view(file5)
```

### Smart Context Loading
```typescript
// Don't load entire file if only need specific section:
lov-view(src/App.tsx, lines="1-100")  // First 100 lines only

// Use search instead of reading all files:
lov-search-files(query="useState", include_pattern="src/**")
```

### Result Caching
Within a conversation, previously loaded files remain in context. Don't re-read them.

## Human-in-the-Loop

### When to Wait for User

1. **Backend Enablement:**
   ```typescript
<!-- SUPABASE DISABLED:    supabase--enable() → User must approve in UI → WAIT -->
   ```

2. **Secrets Addition:**
   ```typescript
   secrets--add_secret(["API_KEY"]) → User enters value in modal → WAIT
   ```

3. **Destructive Operations:**
   ```typescript
   // Large refactor, database changes
   → Explain plan → Ask confirmation → WAIT
   ```

4. **Ambiguous Requests:**
   ```typescript
   User: "Add authentication"
   AI: "Which type? Email/password, OAuth, or magic link?"
   → WAIT for answer
   ```

### When NOT to Wait

- File creation/modification
- Code refactoring
- Bug fixes
- Performance optimization
- Documentation generation
- Design changes

## See Also

- **Workflows:** How this execution model maps to specific request types
- **Tool API:** Complete specifications of all 31 tools
- **State Management:** Token budgets, context window details
- **Prompt Patterns:** How instructions are structured
