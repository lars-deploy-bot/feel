# Execution Model - Quick Reference

## One-Page Overview

This is your cheat sheet for understanding how Lovable AI processes requests and executes code changes.

---

## The 30-Second Explanation

```
User types message → Platform reads .lovable-internals/ → AI receives context → 
AI decides tools to call → Platform executes tools → Results shown to user
```

**Key Concept**: `.lovable-internals/` is documentation that gets injected into the AI's prompt, NOT code that runs.

---

## Request Lifecycle (Visual)

```
┌──────────────┐
│ User Message │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Context Assembly                        │
│ • Read .lovable-internals/              │
│ • Select relevant knowledge patterns    │
│ • Load project files                    │
│ • Build XML tags                        │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ AI Decision Making                      │
│ • Parse context                         │
│ • Match to workflow                     │
│ • Select tools to call                  │
│ • Generate response                     │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Tool Execution                          │
│ • File operations (read, write, search) │
│ • Backend operations (Cloud, secrets)   │
│ • Debug operations (logs, network)      │
│ • External operations (web search, AI)  │
└──────┬──────────────────────────────────┘
       │
       ▼
┌──────────────┐
│ User Sees    │
│ • Changes    │
│ • Messages   │
│ • Updates    │
└──────────────┘
```

---

## The 7 Stages (Detailed)

| Stage | What Happens | Where | Time |
|-------|-------------|-------|------|
| **1. Ingestion** | Scan `.lovable-internals/`, index knowledge patterns | Platform Backend | ~100ms (cached) |
| **2. Selection** | Match user message to relevant patterns via keywords | Platform Backend | ~10ms |
| **3. Assembly** | Build XML context with code, knowledge, UI state | Platform Backend | ~50ms |
| **4. Inference** | AI decides what to do and which tools to call | AI Model API | ~2-5s |
| **5. Execution** | Run tools against project (files, DB, APIs) | Platform Backend | ~100-500ms |
| **6. Iteration** | If AI needs more info, repeat steps 4-5 | Both | Variable |
| **7. Delivery** | Show results to user, trigger hot-reload | Platform + Browser | ~50ms |

**Total**: ~3-6 seconds for typical request

---

## Context Tags (What AI Sees)

```xml
<role>
  You are Lovable, an AI editor for web apps...
</role>

<current-code>
  <file path="src/App.tsx">[content]</file>
  <file path="src/main.tsx">[content]</file>
  ...
</current-code>

<useful-context>
  <pattern source=".lovable-internals/knowledge-base/03-auth.md">
    [Authentication patterns]
  </pattern>
  <workflow source="workflows/01-authentication-request.md">
    [Decision tree for auth requests]
  </workflow>
</useful-context>

<current-view>
  User viewing: codeEditor
  Selected file: src/App.tsx
  Open files: [src/App.tsx, src/main.tsx]
</current-view>

<dependencies>
  - react version ^18.3.1
  - @tanstack/react-query version ^5.83.0
  ...
</dependencies>

<instructions-reminder>
  [Core behavioral rules]
</instructions-reminder>
```

---

## 31 Tools (By Category)

### File Operations (7)
```
lov-view          - Read file contents
lov-write         - Create/overwrite file
lov-line-replace  - Modify specific lines (PREFERRED)
lov-search-files  - Regex search
lov-delete        - Remove file
lov-rename        - Rename file
lov-copy          - Copy file
```

### Backend (6)
```
supabase--enable           - Enable Lovable Cloud
secrets--add_secret        - Add environment variables
secrets--update_secret     - Update secrets
secrets--delete_secret     - Delete secrets
stripe--enable_stripe      - Stripe integration
shopify--enable_shopify    - Shopify integration
```

### Debugging (4)
```
lov-read-console-logs         - Browser console output
lov-read-network-requests     - Network activity
project_debug--sandbox-screenshot - UI capture
project_debug--sleep             - Wait for async ops
```

### Security (4)
```
security--run_security_scan        - Full security audit
security--get_security_scan_results - Get findings
security--get_table_schema         - Database schema
security--manage_security_finding  - Update/delete findings
```

### External (4)
```
websearch--web_search       - General web search
websearch--web_code_search  - Technical docs search
lov-fetch-website          - Download webpage
lov-download-to-repo       - Download file to project
```

### Dependencies (2)
```
lov-add-dependency     - npm install package
lov-remove-dependency  - npm uninstall package
```

### Images (2)
```
imagegen--generate_image  - Generate images from text
imagegen--edit_image      - Edit/merge images
```

### Documents (1)
```
document--parse_document  - Extract content from PDFs, Office docs
```

### Analytics (1)
```
analytics--read_project_analytics  - Usage data
```

---

## Workflow Decision Trees

The AI matches user requests to one of 9 core workflows:

| User Says | Workflow Used | Key Tools |
|-----------|--------------|-----------|
| "Add login" | `01-authentication-request` | `supabase--enable`, `lov-write` |
| "It's broken" | `02-bug-debugging-request` | `lov-read-console-logs`, `lov-read-network-requests` |
| "Add feature X" | `03-new-feature-request` | `lov-search-files`, `lov-write` |
| "Connect to Stripe" | `04-external-api-integration` | `secrets--add_secret`, `lov-write` |
| "Change colors" | `05-styling-design-request` | `lov-line-replace` |
| "Create users table" | `06-database-table-creation` | `supabase--enable`, SQL generation |
| "Upload files" | `07-file-upload-storage` | Storage bucket creation |
| "Security audit" | `08-security-audit-request` | `security--run_security_scan` |
| "It's slow" | `09-performance-optimization` | Console/network analysis |

---

## Knowledge Base Categories

When AI selects patterns from `.lovable-internals/`, it uses these categories:

```
knowledge-base/
├── 01-lovable-cloud.md           → Backend features
├── 02-supabase-integration.md    → Supabase snippets
├── 03-authentication-patterns.md → Auth implementation
├── 04-edge-function-patterns.md  → Serverless functions
├── 05-ai-integration-complete.md → AI model integration
├── 06-security-critical-rules.md → Security warnings
├── 07-rls-patterns.md            → Row Level Security
├── 08-storage-patterns.md        → File uploads
├── 09-realtime-patterns.md       → Real-time subscriptions
└── 10-email-patterns.md          → Email sending
```

**Selection Logic**: Keyword matching on user message
- "login" → includes `03-authentication-patterns.md`
- "database" → includes `02-supabase-integration.md`
- "security" → includes `06-security-critical-rules.md`, `07-rls-patterns.md`

---

## Caching Strategy

| Data | Cached? | Refresh |
|------|---------|---------|
| `.lovable-internals/` index | ✅ Yes | Project load |
| Knowledge base content | ✅ Yes | Static (versioned) |
| Workflow decision trees | ✅ Yes | Static (versioned) |
| Project files | ❌ No | Fresh each request |
| Console logs | ❌ No | Real-time |
| Supabase schema | ⚠️ Partial | 5-min TTL |

---

## Performance Benchmarks

```
Context assembly:     < 150ms
Tool execution:       100-500ms per tool
AI inference:         2-5 seconds
Total request time:   3-6 seconds average
```

**Optimization opportunities:**
- Parallel tool execution (already implemented)
- Selective file loading (already implemented)
- Vector embeddings for semantic matching (future)

---

## Common Request Patterns

### Read → Write Pattern
```
User: "Update the button component"
  1. lov-search-files("button")      → Find button files
  2. lov-view("src/components/Button.tsx")  → Read current code
  3. lov-line-replace(...)           → Modify specific lines
```

### Enable Backend Pattern
```
User: "Add authentication"
  1. supabase--enable()              → Provision backend
  2. lov-write("src/hooks/useAuth.tsx")    → Create auth hook
  3. lov-write("src/pages/Login.tsx")      → Create login page
```

### Debug → Fix Pattern
```
User: "Fix the error"
  1. lov-read-console-logs()         → Check errors
  2. lov-read-network-requests()     → Check API calls
  3. lov-view("problematic-file")    → Read code
  4. lov-line-replace(...)           → Fix issue
```

---

## Security Rules

**Path Validation**
```typescript
// ✅ Safe: Within project root
lov-view("src/App.tsx")

// ❌ Blocked: Path traversal
lov-view("../../etc/passwd")
```

**Read-Only Files**
```
package.json     → Use lov-add-dependency instead
tsconfig.json    → Cannot modify
.gitignore       → Cannot modify
```

**Secret Handling**
```
secrets--add_secret(["API_KEY"])
  → Prompts user for value
  → Stores encrypted
  → Never exposed in logs
```

---

## Error Handling

### Tool Execution Errors
```typescript
{
  success: false,
  error: "File not found: src/missing.tsx"
}
```

### AI Iteration
If tool fails, AI sees error and can:
- Retry with different parameters
- Use different tool
- Ask user for clarification

### Rate Limits
```
429 Too Many Requests   → Back off, retry
402 Payment Required    → Out of credits
500 Internal Error      → Log and report
```

---

## Testing Tools

### Unit Test
```typescript
const result = await executeLovView(
  { file_path: "src/test.tsx" },
  mockContext
);
expect(result.content).toBeDefined();
```

### Integration Test
```typescript
const response = await simulateUserMessage(
  "Add a button component"
);
expect(response.toolCalls).toContainEqual({
  name: "lov-write",
  parameters: { file_path: expect.stringContaining("Button") }
});
```

---

## Debugging Checklist

When things don't work:

- [ ] Check console logs: `lov-read-console-logs()`
- [ ] Check network requests: `lov-read-network-requests()`
- [ ] Verify file exists: `lov-view(file_path)`
- [ ] Check Supabase connection: Dashboard link
- [ ] Review conversation history: Look for error patterns
- [ ] Take screenshot: `project_debug--sandbox-screenshot("/")`

---

## Key Metrics

**Context Size**: ~50-100K tokens per request
**Tools per Request**: 1-5 average, 10-15 for complex features
**Success Rate**: ~95% for well-defined requests
**Iteration Count**: 1-3 rounds average

---

## Further Reading

| Topic | Document |
|-------|----------|
| Full lifecycle | `execution-model/README.md` |
| Context ingestion | `execution-model/02-context-ingestion-pipeline.md` |
| Tool implementation | `execution-model/03-tool-implementation-guide.md` |
| Advanced patterns | `execution-model/04-advanced-patterns.md` |
| Performance tuning | `execution-model/05-performance-optimization.md` |
| Workflows | `workflows/README.md` |
| Knowledge base | `knowledge-base/README.md` |
| Design system | `design-system/01-color-system.md` |

---

## TL;DR

1. **`.lovable-internals/` = AI's instruction manual** (not executable code)
2. **Platform reads these docs → Injects into AI prompt** (keyword-based selection)
3. **AI sees context → Decides tools to call** (31 tools available)
4. **Platform executes tools → Changes project** (files, backend, debug)
5. **User sees results in <6 seconds** (cached where possible)

The magic: Versioned documentation in the project enables AI to follow best practices without retraining the model.
