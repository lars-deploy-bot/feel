# Critical Comparison: Claudable vs claude-bridge

**Date:** 2025-11-17
**Purpose:** Brutally honest assessment of which patterns are better
**Methodology:** Feature-by-feature comparison with decision matrix

---

## 1. HMR-Safe Singleton Pattern

### Claudable's Implementation
```typescript
const globalPreviewManager = globalThis as unknown as {
  __claudable_preview_manager__?: PreviewManager;
};

export const previewManager: PreviewManager =
  globalPreviewManager.__claudable_preview_manager__ ??
  (globalPreviewManager.__claudable_preview_manager__ = new PreviewManager());
```

**Used for:** PreviewManager, WebSocketManager, StreamManager

### claude-bridge's Implementation
**Current state:** No HMR-safe singletons

**Files that would benefit:**
- `features/auth/lib/sessionStore.ts` (SessionStoreMemory)
- Stream management (if it exists as a class)
- Conversation locking state

### Which Is More Rock Solid?

**Winner:** Claudable ✅

**Rationale:**
- claude-bridge likely doesn't have this problem YET because most state is functional (Map/Set in module scope)
- But if you have class-based services, they WILL re-instantiate on HMR
- Claudable's pattern is battle-tested and prevents a real problem

### Pros/Cons

| Aspect | Claudable | claude-bridge |
|--------|-----------|---------------|
| **Pros** | ✅ Survives HMR<br>✅ No duplicate connections<br>✅ Clean pattern | ✅ Simpler (no pattern needed if using functional style)<br>✅ No global state pollution |
| **Cons** | ❌ Global state (testability concerns)<br>❌ Requires casting | ❌ Will break if refactored to classes<br>❌ No protection against issue |

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Do you have class-based services?** | If YES → Implement |
| **Do you use SessionStore/StreamManager as classes?** | Currently NO (functional) → Skip |
| **Planning to refactor to classes?** | Unknown → Skip for now |
| **Dev server has HMR issues?** | NO (not reported) → Skip |
| **Cost/benefit ratio** | Low benefit (no classes yet) → **❌ SKIP** |

**Recommendation:** ❌ **DO NOT IMPLEMENT YET**
- claude-bridge uses functional patterns (Maps/Sets in module scope) which survive HMR naturally
- Only implement IF you refactor to class-based services
- Revisit when adding WebSocket support (if using class-based manager)

---

## 2. Dual Transport Layer (WebSocket + SSE)

### Claudable's Implementation
```typescript
export class StreamManager {
  public publish(projectId: string, event: RealtimeEvent): void {
    websocketManager.broadcast(projectId, event);  // WebSocket
    const projectStreams = this.streams.get(projectId);  // SSE fallback
    // ...
  }
}
```

**Single `publish()` API broadcasts to BOTH transports**

### claude-bridge's Implementation

**Current state:** SSE only (`/api/claude/stream`)

**Files:**
- `app/api/claude/stream/route.ts` - SSE streaming
- No WebSocket implementation

**SSE Events:**
- `start`, `message`, `session`, `complete`, `error`
- Works perfectly, no reported issues

### Which Is More Rock Solid?

**Winner:** TIE (different trade-offs)

**Rationale:**
- **SSE is more reliable:** Works through proxies, CDNs, survives page refresh
- **WebSocket is faster:** Lower latency, bidirectional
- **Dual transport is complex:** More code, more failure modes
- **SSE-only is simpler:** One path, easier to debug

### Pros/Cons

| Aspect | Dual Transport (Claudable) | SSE Only (claude-bridge) |
|--------|----------------------------|--------------------------|
| **Pros** | ✅ Best-of-both-worlds<br>✅ Lower latency (WS)<br>✅ Universal fallback (SSE)<br>✅ Abstracts transport | ✅ Simpler codebase<br>✅ Works everywhere<br>✅ No WS connection management<br>✅ Fewer failure modes |
| **Cons** | ❌ More complex<br>❌ Duplicate messages possible<br>❌ WS connection lifecycle<br>❌ Requires testing both paths | ❌ Higher latency<br>❌ HTTP overhead<br>❌ No bidirectional communication |

### Real-World Considerations

**For claude-bridge:**
- Your messages are TOOL EXECUTION streams, not chat (latency less critical)
- Users refresh frequently (SSE survives, WebSocket dies)
- Behind Caddy reverse proxy (SSE works, WS needs config)
- Multi-tenant (WebSocket state per user = complexity)

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Users complaining about latency?** | NO → Skip |
| **Need bidirectional communication?** | NO (only server→client) → Skip |
| **Messages are real-time chat?** | NO (tool execution logs) → Skip |
| **Worth doubling complexity?** | NO → **❌ SKIP** |

**Recommendation:** ❌ **DO NOT IMPLEMENT**
- SSE is perfect for your use case (tool execution streams)
- WebSocket adds complexity without meaningful benefit
- Your latency bottleneck is Claude SDK, not transport
- SSE survives page refreshes (common in dev workflows)

**IF you add real-time features (live coding, multiplayer):** Revisit

---

## 3. Project Structure Auto-Healing

### Claudable's Implementation
```typescript
async function ensureProjectRootStructure(projectPath: string) {
  // Detects Next.js in subdirectory
  // Moves contents to root
  // Handles file conflicts intelligently
}
```

**Detects:** `project/new-app/package.json` → Moves to `project/package.json`

### claude-bridge's Implementation

**Current state:** System prompt only

**From CLAUDE.md:**
```
- Keep all project files directly in the project root. Never scaffold frameworks
  into subdirectories (avoid commands like "mkdir new-app").
```

**Reality:**
- Users work in existing codebases (not scaffolding new projects)
- Workspace is pre-determined (`/srv/webalive/sites/example.com/user/`)
- Claude can't choose workspace location

### Which Is More Rock Solid?

**Winner:** claude-bridge ✅ (architectural prevention)

**Rationale:**
- **Claudable needs healing** because Claude CAN create arbitrary directories
- **claude-bridge doesn't need healing** because workspace is fixed per domain
- Architectural constraint > runtime fix

### Pros/Cons

| Aspect | Auto-Healing (Claudable) | System Prompt (claude-bridge) |
|--------|--------------------------|-------------------------------|
| **Pros** | ✅ Fixes AI mistakes<br>✅ User doesn't notice<br>✅ Automated recovery | ✅ Simpler (no code)<br>✅ Problem prevented architecturally<br>✅ Workspace pre-determined |
| **Cons** | ❌ Reactive (fixes after mistake)<br>❌ File move risks<br>❌ Complexity | ❌ Relies on prompt (can be ignored)<br>❌ No automation |

### Real-World Considerations

**For claude-bridge:**
- Workspace is `process.cwd()` set by Bridge (Claude can't change it)
- Users are editing EXISTING sites, not creating new projects
- If Claude tries `mkdir new-app`, it creates subdirectory within workspace (annoying but not breaking)

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Users scaffold new projects often?** | NO (edit existing sites) → Skip |
| **Claude can choose workspace location?** | NO (fixed per domain) → Skip |
| **Seen nested directory problems?** | NO (not reported) → Skip |
| **Architectural prevention better?** | YES → **❌ SKIP** |

**Recommendation:** ❌ **DO NOT IMPLEMENT**
- Your architecture prevents the problem (workspace is predetermined)
- Auto-healing adds complexity without addressing real issue
- IF users scaffold new frameworks within workspace: Revisit

**Alternative:** Add MCP tool `normalize-project-structure` (manual trigger)

---

## 4. Tool Message Deduplication with Content Signatures

### Claudable's Implementation
```typescript
const computeToolMessageSignature = (metadata, content, messageType) => {
  return [
    messageType,
    toolName,
    filePath,
    summary,
    command,
    action,
    content
  ].join('|').toLowerCase();
};

const persistedToolMessageSignatures = new Set<string>();
if (persistedToolMessageSignatures.has(signature)) {
  return; // Skip duplicate
}
```

### claude-bridge's Implementation

**Current state:** `toolUseMap` for tracking tool names

**File:** `features/chat/lib/message-parser.ts`

```typescript
const toolUseMap = new Map<string, string>()

// Assistant message with tool_use
if (content.type === 'tool_use') {
  toolUseMap.set(content.id, content.name)  // "tool_1" → "Read"
}

// User message with tool_result
if (content.type === 'tool_result') {
  const toolName = toolUseMap.get(content.tool_use_id)
  item.tool_name = toolName
}
```

**Purpose:** Map tool_use_id → tool_name for rendering
**NOT used for:** Deduplication

**Session persistence:** `SessionStoreMemory` (in-memory Map)
- Stores conversation messages (source of truth)
- No deduplication logic

### Which Is More Rock Solid?

**Winner:** Claudable ✅ (IF you persist to database)

**Rationale:**
- **IF you persist messages to DB:** Content-based deduplication prevents pollution
- **IF you keep messages in-memory only:** Deduplication unnecessary (session dies with server restart)
- claude-bridge uses in-memory SessionStore → no persistence → no pollution risk YET

### Pros/Cons

| Aspect | Content Signatures (Claudable) | toolUseMap (claude-bridge) |
|--------|--------------------------------|----------------------------|
| **Pros** | ✅ Prevents duplicate saves<br>✅ Works across SDK versions<br>✅ Content-aware | ✅ Simple<br>✅ Purpose-built (tool name lookup)<br>✅ No overhead |
| **Cons** | ❌ Overhead (signature computation)<br>❌ False positives possible<br>❌ Complexity | ❌ No deduplication<br>❌ If DB added later, duplicates will appear |

### Real-World Considerations

**For claude-bridge:**
- **Current:** SessionStoreMemory (in-memory, lost on restart)
- **Future (per docs):** Redis or database (persistent)
- **When you add Redis:** Deduplication becomes critical

**Risk without deduplication:**
- SDK sends streaming + final events
- Both saved to Redis
- UI renders duplicate tool messages
- Database bloat

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Persisting messages to DB/Redis?** | **NOT YET** (in-memory) → Skip for now |
| **Planning Redis SessionStore?** | YES (per README checklist) → **⚠️ PREPARE** |
| **Seeing duplicate messages in UI?** | NO (not reported) → Skip |
| **When adding Redis?** | **✅ IMPLEMENT THEN** |

**Recommendation:** ⚠️ **IMPLEMENT WHEN ADDING REDIS**
- Current in-memory store doesn't need it (duplicates die with server restart)
- **CRITICAL when switching to Redis/DB** (prevents message bloat)
- Add as part of Redis migration, not before

**Implementation note:** Use Claudable's pattern exactly (signature-based Set)

---

## 5. stderr Error Diagnostics from Buffer

### Claudable's Implementation
```typescript
const stderrBuffer: string[] = [];

options: {
  stderr: (data: string) => {
    if (stderrBuffer.length > 200) stderrBuffer.shift();
    stderrBuffer.push(line);
  }
}

// On error
if (/auth\s+login|not\s+logged\s+in/i.test(tail)) {
  errorMessage = `Claude Code CLI authentication required.\n\nRun: claude auth login`;
} else if (/network|ENOTFOUND|ECONN/i.test(tail)) {
  errorMessage = `Network error detected`;
}
```

### claude-bridge's Implementation

**Current state:** Comprehensive error system ✅

**Files:**
- `docs/error-management/README.md` - Error system overview
- `lib/error-codes.ts` - ErrorCodes constants
- `lib/error-messages.ts` - User-friendly messages

**Error handling:**
```typescript
catch (error) {
  return NextResponse.json({
    ok: false,
    error: ErrorCodes.QUERY_FAILED,
    message: getErrorMessage(ErrorCodes.QUERY_FAILED),
    details: { error: error.message },
    requestId
  }, { status: 500 })
}
```

**Current error granularity:**
- ✅ Structured ErrorCodes (NO_SESSION, WORKSPACE_NOT_AUTHORIZED, QUERY_FAILED, etc.)
- ✅ User-friendly messages via `getErrorMessage()`
- ✅ Recovery guidance via `getErrorHelp()`
- ✅ 95% consistency (per docs/error-management/COMPLETION-SUMMARY.md)

**stderr capture:** ❓ Unknown (need to check Claude SDK wrapper)

### Which Is More Rock Solid?

**Winner:** claude-bridge ✅ (more comprehensive)

**Rationale:**
- claude-bridge has **structured error system** (ErrorCodes, messages, help text)
- Claudable has **stderr parsing** (useful but narrow)
- **Best approach:** claude-bridge's structured system + Claudable's stderr parsing

### Pros/Cons

| Aspect | stderr Parsing (Claudable) | Structured Errors (claude-bridge) |
|--------|----------------------------|-----------------------------------|
| **Pros** | ✅ Captures SDK internal errors<br>✅ Heuristic classification<br>✅ Rich diagnostics | ✅ Consistent error codes<br>✅ User-friendly messages<br>✅ Recovery guidance<br>✅ Documented system |
| **Cons** | ❌ Regex fragile<br>❌ Only helps with SDK errors<br>❌ No structure for API errors | ❌ Missing stderr context<br>❌ Generic SDK errors |

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Have structured error system?** | YES (95% consistent) → Already better |
| **Seeing generic SDK errors?** | Unknown (need user reports) |
| **Worth adding stderr capture?** | **Maybe** (complementary) → **⚠️ ENHANCE** |

**Recommendation:** ⚠️ **ENHANCE EXISTING SYSTEM**
- Keep your structured ErrorCodes system (it's better)
- **ADD stderr capture to Claude SDK wrapper**
- Parse stderr for auth/network errors, map to ErrorCodes
- Example: Detect "not logged in" → return `ErrorCodes.SDK_AUTH_REQUIRED`

**Implementation:**
1. Add stderr buffer to `/api/claude/stream`
2. Capture stderr from SDK query
3. On error, parse stderr for patterns
4. Map patterns to existing ErrorCodes
5. Include stderr snippet in `details` field

**Priority:** Low (only if users report confusing SDK errors)

---

## 6. Service Connection Pattern (Generic + JSON)

### Claudable's Implementation
```prisma
model ProjectServiceConnection {
  id          String
  projectId   String
  provider    String  // 'github', 'vercel', 'supabase'
  status      String
  serviceData String  // JSON blob
}
```

### claude-bridge's Implementation

**Current state:** No deployment integrations

**Database:** Supabase (PostgreSQL)
- Users table (authentication)
- Organizations table (multi-tenancy)
- Domain passwords (domain-passwords.json file)

**Future integrations:** Not planned (per README/docs)

### Which Is More Rock Solid?

**Winner:** Claudable ✅ (IF you add integrations)

**Rationale:**
- claude-bridge doesn't need this YET (no deployment features)
- When you add them, Claudable's pattern is solid

### Pros/Cons

| Aspect | Generic Connection Pattern | No Pattern (claude-bridge) |
|--------|----------------------------|----------------------------|
| **Pros** | ✅ Single table for all services<br>✅ Easy to add new integrations<br>✅ Metadata caching | ✅ Simpler (no unnecessary abstraction)<br>✅ YAGNI principle |
| **Cons** | ❌ JSON blob (weak typing at DB level)<br>❌ Premature if no integrations | ❌ Will need pattern when adding integrations |

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Adding Vercel integration?** | NO → Skip |
| **Adding GitHub integration?** | NO → Skip |
| **Adding ANY deployment integration?** | NO → **❌ SKIP** |
| **When adding integrations?** | **✅ USE THIS PATTERN** |

**Recommendation:** ❌ **DO NOT IMPLEMENT NOW**
- You don't have deployment integrations
- No need to build abstraction without use case
- **When adding:** Use Claudable's exact pattern

---

## 7. Request Lifecycle Tracking (Separate from Messages)

### Claudable's Implementation
```prisma
model UserRequest {
  id           String
  projectId    String
  instruction  String
  status       String  // pending, processing, completed, failed
  errorMessage String?
  createdAt    DateTime
  completedAt  DateTime?
}
```

**Frontend hook:**
```typescript
const { hasActiveRequests } = useUserRequests();
// Drives UI loading states
```

### claude-bridge's Implementation

**Current state:** Conversation locking for concurrency

**File:** `features/auth/types/session.ts`

```typescript
const activeConversations = new Set<string>()
const conversationLockTimestamps = new Map<string, number>()

// Lock conversation during request
tryLockConversation(key)
// ... process request
unlockConversation(key)
```

**Purpose:**
- Prevent concurrent requests to same conversation
- Returns 409 if conversation already in progress
- 5-minute timeout for stale locks

**Frontend state:**
- `lib/stores/sessionStore.ts` - Tracks conversationId per workspace
- No request lifecycle tracking

### Which Is More Rock Solid?

**Winner:** TIE (different purposes)

**Rationale:**
- **Claudable's UserRequest:** Tracks high-level action lifecycle (for analytics/UI)
- **claude-bridge's conversation locking:** Prevents concurrency bugs
- **Different goals:** Request tracking vs race condition prevention

### Pros/Cons

| Aspect | Request Lifecycle (Claudable) | Conversation Locking (claude-bridge) |
|--------|-------------------------------|--------------------------------------|
| **Pros** | ✅ Analytics (success rate, duration)<br>✅ Clean UI state (`hasActiveRequests`)<br>✅ Error tracking | ✅ Prevents race conditions<br>✅ Simple (Set + Map)<br>✅ Automatic timeout |
| **Cons** | ❌ Database overhead<br>❌ Requires DB writes per request<br>❌ Doesn't prevent concurrency | ❌ No analytics<br>❌ No lifecycle history<br>❌ In-memory (lost on restart) |

### Real-World Considerations

**For claude-bridge:**
- You HAVE concurrency protection (conversation locking) ✅
- You DON'T HAVE analytics (request success/failure rates)
- You DON'T HAVE "hasActiveRequests" (frontend checks last message instead)

**Current UI pattern:**
```typescript
// Frontend checks message stream state
const isStreaming = messages[messages.length - 1]?.type !== 'complete'
```

**Works but:** Not as clean as `hasActiveRequests`

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Need analytics?** | Maybe (depends on monitoring goals) |
| **Need cleaner UI state?** | Maybe (current pattern works) |
| **Worth DB overhead?** | **Probably not** → **❌ SKIP** |
| **Current locking sufficient?** | YES → **❌ SKIP** |

**Recommendation:** ❌ **DO NOT IMPLEMENT**
- Your conversation locking is solid (prevents concurrency)
- Frontend state works (checks message stream)
- DB overhead not worth marginal UI improvement
- **IF you add monitoring dashboard:** Implement for analytics

**Alternative:** Track requests in memory (not DB) for `hasActiveRequests` only

---

## 8. Package Manager Detection with Fallback

### Claudable's Implementation
```typescript
async function detectPackageManager(): Promise<'npm' | 'pnpm' | 'yarn' | 'bun'> {
  // 1. Check package.json packageManager field
  const fromField = parsePackageManagerField(packageJson?.packageManager);
  if (fromField) return fromField;

  // 2. Check lockfiles
  if (await fileExists('pnpm-lock.yaml')) return 'pnpm';
  if (await fileExists('yarn.lock')) return 'yarn';
  if (await fileExists('bun.lockb')) return 'bun';

  // 3. Default to npm
  return 'npm';
}
```

### claude-bridge's Implementation

**Current state:** Hardcoded `bun`

**MCP Tool:** `install-package-with-restart`

**File:** `packages/tools/src/tools/workspace/install-package.ts`

```typescript
const result = spawnSync("bun", ["add", packageName], {
  cwd: workspaceRoot,
  shell: false,
})
```

**Rationale:** All claude-bridge sites use Bun (standardized runtime)

### Which Is More Rock Solid?

**Winner:** claude-bridge ✅ (for your use case)

**Rationale:**
- **Standardization > Flexibility** when you control the environment
- All claude-bridge sites use Bun (per ecosystem.config.js)
- Detection adds complexity without benefit

### Pros/Cons

| Aspect | Detection (Claudable) | Hardcoded Bun (claude-bridge) |
|--------|-----------------------|-------------------------------|
| **Pros** | ✅ Respects user preference<br>✅ Works with any package manager<br>✅ Graceful fallback | ✅ Simple (no detection logic)<br>✅ Consistent (all sites same)<br>✅ Fast (no file checks) |
| **Cons** | ❌ Complexity<br>❌ File I/O overhead<br>❌ Assumes lockfiles exist | ❌ Inflexible<br>❌ Breaks if user doesn't use Bun<br>❌ Ignores package.json preference |

### Real-World Considerations

**For claude-bridge:**
- You DEPLOY sites (users don't bring their own)
- All sites use Bun (standardized in ecosystem.config.js)
- Users work on YOUR infrastructure (not arbitrary projects)

**Claudable's context:**
- Users scaffold NEW projects (unknown package manager)
- Desktop app (local machine, any setup)
- No control over environment

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Do sites use different package managers?** | NO (all Bun) → Skip |
| **Users bring their own projects?** | NO (you deploy sites) → Skip |
| **Standardization important?** | YES → **❌ SKIP** |

**Recommendation:** ❌ **DO NOT IMPLEMENT**
- Your architecture is standardized (all sites use Bun)
- Detection adds complexity without benefit
- **IF you support bring-your-own-codebase:** Implement

---

## 9. Model ID Normalization (Aliases)

### Claudable's Implementation
```typescript
const MODEL_ALIASES: Record<string, string> = {
  'opus': 'claude-opus-4-1-20250805',
  'sonnet': 'claude-sonnet-4-5-20250929',
  'haiku': 'claude-haiku-4-5-20251001',
};

export function normalizeClaudeModelId(model?: string): string {
  const normalized = model.trim().toLowerCase();
  return MODEL_ALIASES[normalized] ?? model;
}
```

### claude-bridge's Implementation

**Current state:** Model selection per user type

**From docs/architecture/CREDITS_AND_TOKENS.md:**
- Credit users → Haiku 4.5 only (enforced)
- API key users → Choose model (dropdown)

**Model IDs:** Probably raw strings (e.g., "claude-haiku-4-5")

**Usage:**
- Passed to Claude SDK in `/api/claude/stream`
- Likely no normalization

### Which Is More Rock Solid?

**Winner:** Claudable ✅ (marginal improvement)

**Rationale:**
- Prevents typos/variants in database
- User-friendly aliases ("haiku" vs "claude-haiku-4-5-20251001")
- Forward compatibility (update alias, not every record)

### Pros/Cons

| Aspect | Model Aliases (Claudable) | Raw IDs (claude-bridge) |
|--------|---------------------------|-------------------------|
| **Pros** | ✅ User-friendly<br>✅ Consistent DB values<br>✅ Easy model updates | ✅ Explicit (no magic)<br>✅ Simple (no normalization) |
| **Cons** | ❌ Indirection<br>❌ Requires maintenance | ❌ Typos possible<br>❌ Variant spellings |

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Users enter model IDs manually?** | NO (dropdown selection) → Less important |
| **Need aliases for UX?** | Maybe (shorter names nice) |
| **Database consistency issue?** | Unknown (need to check data) |
| **Cost/benefit ratio** | **Low** → **⚠️ NICE-TO-HAVE** |

**Recommendation:** ⚠️ **NICE-TO-HAVE (Low Priority)**
- Implement if you see variant model spellings in database
- Add as part of model selection refactor
- Use exact pattern from Claudable

**Priority:** P3 (cosmetic improvement, not critical)

---

## 10. Preview Health Checking with Graceful Timeout

### Claudable's Implementation
```typescript
async function waitForPreviewReady(url, timeoutMs = 30_000) {
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) return true;

      // Fallback to GET if HEAD not supported
      if (response.status === 405 || response.status === 501) {
        const getResponse = await fetch(url);
        if (getResponse.ok) return true;
      }
    } catch {
      // Server not ready, keep polling
    }
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  return false; // Timeout - continue anyway
}
```

### claude-bridge's Implementation

**Current state:** N/A (no preview management)

**Architecture:**
- Multi-tenant (each domain = separate site)
- Sites run as systemd services (always running)
- No dev server lifecycle management
- Claude works on LIVE sites

**Comparison:**
- Claudable: Spawns `npm run dev` per project, needs health check
- claude-bridge: Sites already running (systemd), no spawning needed

### Which Is More Rock Solid?

**Winner:** claude-bridge ✅ (architecturally superior)

**Rationale:**
- **No health check needed** if sites are always running (systemd)
- **Health check needed** if you spawn dev servers on-demand (Claudable)
- Prevention > Detection

### Decision Matrix

| Criteria | Implement? |
|----------|------------|
| **Do you spawn dev servers?** | NO (systemd services) → N/A |
| **Manage preview lifecycle?** | NO → **❌ N/A** |

**Recommendation:** ❌ **NOT APPLICABLE**
- Your sites are always running (systemd services)
- No preview server lifecycle to manage
- Health checks unnecessary

---

## Summary: Implementation Priority

### ✅ IMPLEMENT (High Value)

**None.** claude-bridge's architecture is fundamentally different from Claudable's.

### ⚠️ IMPLEMENT LATER (Conditional)

1. **Tool Message Deduplication** ⚠️
   - **When:** Migrating SessionStore to Redis/DB (per checklist)
   - **Why:** Prevents message bloat in persistent storage
   - **Effort:** Low (2-4 hours)
   - **Files:** `/api/claude/stream/route.ts`

2. **stderr Error Diagnostics** ⚠️
   - **When:** Users report confusing SDK errors
   - **Why:** Better error messages (complements existing ErrorCodes system)
   - **Effort:** Low (2-3 hours)
   - **Files:** Claude SDK wrapper

### ❌ DO NOT IMPLEMENT (Wrong Architecture / No Value)

1. **HMR-Safe Singleton Pattern** ❌
   - **Why:** You use functional patterns (Maps/Sets), not classes
   - **When to revisit:** If refactoring to class-based services

2. **Dual Transport (WebSocket + SSE)** ❌
   - **Why:** SSE is perfect for tool execution streams
   - **When to revisit:** If adding real-time features (live coding, multiplayer)

3. **Project Structure Auto-Healing** ❌
   - **Why:** Workspace is predetermined per domain
   - **When to revisit:** Never (architectural prevention better)

4. **Service Connection Pattern** ❌
   - **Why:** No deployment integrations planned
   - **When to revisit:** When adding Vercel/GitHub/Netlify integrations

5. **Request Lifecycle Tracking** ❌
   - **Why:** Conversation locking sufficient, DB overhead not worth it
   - **When to revisit:** If building analytics dashboard

6. **Package Manager Detection** ❌
   - **Why:** All sites use Bun (standardized)
   - **When to revisit:** If supporting bring-your-own-codebase

7. **Model ID Normalization** ❌
   - **Why:** Low value (dropdown selection prevents typos)
   - **Priority:** P3 (nice-to-have)

8. **Preview Health Checking** ❌
   - **Why:** Not applicable (systemd services, not on-demand dev servers)

---

## Critical Insights

### Where Claudable Excels
- **Developer experience automation** (fixes AI mistakes, graceful fallbacks)
- **Desktop app patterns** (local environment, no infrastructure control)
- **Scaffolding workflows** (new projects, unknown environments)

### Where claude-bridge Excels
- **Security and multi-tenancy** (systemd isolation, workspace sandboxing)
- **Production architecture** (always-running services, standardized runtime)
- **Structured error system** (ErrorCodes, user-friendly messages, 95% consistency)
- **Architectural prevention** (problems prevented by design, not fixed by code)

### Key Takeaway

**Claudable patterns are optimized for:**
- Single-user desktop app
- Scaffolding new projects
- Unknown/varied environments
- Reactive fixes (heal after AI mistakes)

**claude-bridge patterns are optimized for:**
- Multi-tenant SaaS
- Editing existing sites
- Controlled environment (all Bun, all systemd)
- Proactive prevention (architecture prevents problems)

**The winner:** claude-bridge's architecture is MORE ROCK SOLID because it **prevents problems** that Claudable must **fix reactively**.

---

## Final Recommendation

**Total features to implement:** 0 immediately, 2 conditionally

**Implement now:** Nothing
**Implement when migrating to Redis:** Tool Message Deduplication
**Implement if users complain:** stderr Error Diagnostics

**Key lesson:** Good architecture > clever patterns. claude-bridge's multi-tenant, systemd-based architecture inherently avoids most problems that Claudable must solve with code.
