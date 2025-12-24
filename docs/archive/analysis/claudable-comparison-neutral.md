# Claudable vs claude-bridge: Neutral Technical Comparison

**Date:** 2025-11-17
**Purpose:** Objective analysis of architectural differences
**Approach:** Present trade-offs, not recommendations

---

## Methodology

This document compares 10 patterns from Claudable against claude-bridge's current implementation. For each:

1. **What it is:** Technical description of both approaches
2. **Key differences:** Architectural divergence points
3. **Trade-offs:** Advantages and disadvantages of each
4. **Context matters:** Where each approach makes sense
5. **Decision factors:** Questions to determine fit

**No winners declared.** Both approaches are valid in their respective contexts.

---

## 1. HMR-Safe Singleton Pattern

### Claudable's Approach
```typescript
const globalPreviewManager = globalThis as unknown as {
  __claudable_preview_manager__?: PreviewManager;
};

export const previewManager: PreviewManager =
  globalPreviewManager.__claudable_preview_manager__ ??
  (globalPreviewManager.__claudable_preview_manager__ = new PreviewManager());
```

**Applied to:** PreviewManager, WebSocketManager, StreamManager (class-based services)

### claude-bridge's Approach

**Current pattern:** Module-scoped Maps/Sets (functional style)

```typescript
// features/auth/types/session.ts
const activeConversations = new Set<string>()
const conversationLockTimestamps = new Map<string, number>()

export function tryLockConversation(key: string): boolean { /* ... */ }
```

**No class-based singletons** identified in current codebase.

### Key Differences

| Aspect | Claudable | claude-bridge |
|--------|-----------|---------------|
| **Pattern** | Class instances on globalThis | Module-scoped functions + Maps/Sets |
| **Persistence** | Instance survives HMR | State survives HMR (module scope) |
| **Testability** | Requires cleanup between tests | Requires cleanup between tests |
| **Type safety** | Requires casting | Native TypeScript |

### Trade-offs

**Class-based singletons (Claudable):**
- ✅ Object-oriented design (encapsulation, methods)
- ✅ Clear lifecycle management (constructor, destroy)
- ❌ Global state (testing complexity)
- ❌ Casting required (TypeScript limitations)

**Module-scoped functional (claude-bridge):**
- ✅ Simpler (no classes)
- ✅ Native TypeScript (no casting)
- ❌ No encapsulation (exported functions)
- ❌ No lifecycle hooks (manual cleanup)

### Context Matters

**Claudable's pattern makes sense when:**
- Heavy use of class-based architecture
- Need lifecycle methods (init, destroy)
- Managing complex stateful services (WebSocket managers, preview servers)

**claude-bridge's pattern makes sense when:**
- Functional programming preference
- Simpler state (Maps, Sets, primitives)
- Fewer stateful services

### Decision Factors

- [ ] Do you use class-based services extensively?
- [ ] Do you need lifecycle methods (constructor, dispose)?
- [ ] Is HMR causing duplicate instances? (observable problem)
- [ ] Is global state acceptable in your testing approach?

---

## 2. Dual Transport Layer (WebSocket + SSE)

### Claudable's Approach

```typescript
export class StreamManager {
  public publish(projectId: string, event: RealtimeEvent): void {
    websocketManager.broadcast(projectId, event);  // WebSocket
    const projectStreams = this.streams.get(projectId);  // SSE
    // ... encode and send via both
  }
}
```

**Single API broadcasts to both transports simultaneously.**

### claude-bridge's Approach

**SSE only** via `/api/claude/stream`

```typescript
// app/api/claude/stream/route.ts
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  }
})
```

**No WebSocket implementation.**

### Key Differences

| Aspect | Dual Transport | SSE Only |
|--------|----------------|----------|
| **Transport** | WebSocket + SSE fallback | SSE exclusively |
| **Latency** | Lower (WebSocket) | Higher (HTTP overhead) |
| **Reliability** | SSE more universal (proxies, CDN) | Universal |
| **Complexity** | Higher (two paths) | Lower (one path) |
| **Bidirectional** | Yes (WebSocket) | No (server→client only) |

### Trade-offs

**Dual transport:**
- ✅ Lower latency (WebSocket)
- ✅ Bidirectional capability
- ✅ Best-of-both-worlds (fallback to SSE)
- ❌ Complexity (two code paths)
- ❌ Testing burden (both transports)
- ❌ Duplicate message risk
- ❌ WebSocket connection management (lifecycle, reconnection)

**SSE only:**
- ✅ Simpler codebase
- ✅ Works everywhere (proxies, CDN, corporate firewalls)
- ✅ Survives page refresh better
- ✅ Single code path (easier debugging)
- ❌ Higher latency
- ❌ No bidirectional communication
- ❌ HTTP overhead per event

### Context Matters

**Dual transport makes sense when:**
- Real-time chat (low latency critical)
- Bidirectional communication needed
- Controlled network environment (enterprise, local)
- Performance is primary concern

**SSE makes sense when:**
- Server→client only (logs, tool output)
- Universal compatibility critical
- Simplicity valued over latency
- Users behind proxies/firewalls

### Decision Factors

- [ ] Is latency a user complaint? (measured, not assumed)
- [ ] Do you need bidirectional communication?
- [ ] What's the latency bottleneck? (transport vs SDK/compute)
- [ ] Are users behind restrictive proxies?
- [ ] Is the added complexity justified by metrics?

---

## 3. Project Structure Auto-Healing

### Claudable's Approach

```typescript
async function ensureProjectRootStructure(projectPath: string) {
  // 1. Scan for Next.js markers in subdirectories
  const subdirs = await fs.readdir(projectPath)

  for (const subdir of subdirs) {
    const hasPackageJson = await exists(path.join(projectPath, subdir, 'package.json'))
    const hasNextConfig = await exists(path.join(projectPath, subdir, 'next.config.*'))

    if (hasPackageJson && hasNextConfig) {
      // 2. Move contents from subdirectory to root
      await moveContentsToRoot(path.join(projectPath, subdir), projectPath)
    }
  }
}
```

**Runs before starting preview server.**

### claude-bridge's Approach

**System prompt constraints:**

```markdown
- Keep all project files directly in the project root. Never scaffold frameworks
  into subdirectories (avoid commands like "mkdir new-app").
```

**No runtime auto-healing code.**

**Architectural constraint:** Workspace path is predetermined per domain (`/srv/webalive/sites/example.com/user/`)

### Key Differences

| Aspect | Auto-Healing | System Prompt |
|--------|--------------|---------------|
| **Approach** | Reactive (fix after mistake) | Proactive (prevent mistake) |
| **Implementation** | Runtime code | LLM instruction |
| **Reliability** | Always runs | Depends on LLM compliance |
| **Complexity** | File operations, conflict handling | None (just text) |
| **User visibility** | Silent (automatic) | May still see nested dirs |

### Trade-offs

**Auto-healing:**
- ✅ Handles non-compliance automatically
- ✅ User doesn't see the mistake
- ✅ Works regardless of LLM behavior
- ❌ Reactive (runs after mistake)
- ❌ File move operations (risk of data loss/conflicts)
- ❌ Code complexity
- ❌ May hide underlying problem (LLM not following instructions)

**System prompt:**
- ✅ Proactive (prevents mistake)
- ✅ No code complexity
- ✅ No file operation risks
- ❌ Relies on LLM compliance
- ❌ No guarantee (LLM may ignore)
- ❌ User may see nested directories if LLM doesn't comply

### Context Matters

**Auto-healing makes sense when:**
- Users frequently scaffold new projects
- Workspace location is flexible (user-chosen)
- LLM non-compliance is common (observed in logs)
- UX smoothness is critical

**System prompt makes sense when:**
- Workspace is predetermined (architectural constraint)
- Users edit existing codebases (not scaffolding)
- LLM compliance is high
- Simplicity preferred over automation

### Decision Factors

- [ ] How often do users scaffold new projects? (metrics)
- [ ] Does Claude ignore the system prompt? (observable in logs)
- [ ] Is workspace location flexible or fixed?
- [ ] Is nested directory creation a reported problem?
- [ ] Would auto-healing solve a real user pain point?

---

## 4. Tool Message Deduplication with Content Signatures

### Claudable's Approach

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

// Before saving message
const signature = computeToolMessageSignature(msg);
if (persistedToolMessageSignatures.has(signature)) {
  return; // Skip duplicate
}
persistedToolMessageSignatures.add(signature);
saveMessage(msg);
```

### claude-bridge's Approach

**Tool tracking (rendering only):**

```typescript
// features/chat/lib/message-parser.ts
const toolUseMap = new Map<string, string>()

// Map tool_use_id → tool_name for UI rendering
if (content.type === 'tool_use') {
  toolUseMap.set(content.id, content.name)
}
```

**No deduplication when persisting messages.**

**Storage:** `SessionStoreMemory` (in-memory Map, not persisted)

### Key Differences

| Aspect | Content Signatures | No Deduplication |
|--------|-------------------|------------------|
| **Purpose** | Prevent duplicate saves | Map tool IDs for rendering |
| **When** | Before persistence | During rendering |
| **Scope** | Session lifetime | Request lifetime |
| **Overhead** | Signature computation per message | Minimal (ID lookup) |

### Trade-offs

**Content-based deduplication:**
- ✅ Prevents database/storage bloat
- ✅ Idempotent (same message = same signature)
- ✅ Works across SDK version changes
- ❌ Computation overhead (signature creation)
- ❌ Memory overhead (Set of signatures)
- ❌ False positives possible (different messages, same signature)

**No deduplication:**
- ✅ Simple (no overhead)
- ✅ Fast (no signature computation)
- ❌ Duplicate messages saved (if SDK sends duplicates)
- ❌ Storage bloat (if persistent storage used)
- ❌ UI may show duplicates

### Context Matters

**Deduplication makes sense when:**
- Messages persisted to database/Redis (long-term storage)
- SDK sends duplicates (streaming + final events)
- Storage cost is concern
- Long conversation histories

**No deduplication makes sense when:**
- Messages in-memory only (ephemeral)
- SDK doesn't send duplicates (verified)
- Simplicity preferred
- Storage resets frequently (server restarts)

### Decision Factors

- [ ] Are messages persisted beyond server lifetime? (DB/Redis)
- [ ] Does SDK send duplicate messages? (observable in logs)
- [ ] Is storage bloat a concern? (measured)
- [ ] Planning to migrate SessionStore to Redis? (future roadmap)

**Note:** claude-bridge docs mention "Replace in-memory SessionStore with Redis/database" in production checklist. This decision becomes critical if/when that migration happens.

---

## 5. stderr Error Diagnostics from Buffer

### Claudable's Approach

```typescript
const stderrBuffer: string[] = [];

const response = query({
  // ...
  options: {
    stderr: (data: string) => {
      const line = String(data).trimEnd();
      if (stderrBuffer.length > 200) stderrBuffer.shift(); // Circular buffer
      stderrBuffer.push(line);
    }
  }
});

// On error
catch (error) {
  const tail = stderrBuffer.slice(-15).join('\n');

  // Pattern matching
  if (/auth\s+login|not\s+logged\s+in/i.test(tail)) {
    errorMessage = `Claude Code CLI authentication required.\n\nRun: claude auth login\n\n${tail}`;
  } else if (/network|ENOTFOUND|ECONN/i.test(tail)) {
    errorMessage = `Network error detected.\n\n${tail}`;
  }
  // ... more patterns
}
```

### claude-bridge's Approach

**Structured error system:**

```typescript
// From docs/error-management/
import { ErrorCodes, getErrorMessage, getErrorHelp } from "@/lib/error-codes"

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

**Error system features:**
- Structured ErrorCodes (constants)
- User-friendly messages via `getErrorMessage()`
- Recovery guidance via `getErrorHelp()`
- 95% consistency across routes (per COMPLETION-SUMMARY.md)

**stderr capture:** Not observed in current implementation.

### Key Differences

| Aspect | stderr Parsing | Structured Errors |
|--------|----------------|-------------------|
| **Scope** | SDK errors only | All API/SDK errors |
| **Method** | Regex pattern matching | Error code constants |
| **Source** | Runtime stderr | Predefined messages |
| **Specificity** | Very specific (auth, network) | Categorical (QUERY_FAILED) |
| **Coverage** | SDK issues | Application-wide |

### Trade-offs

**stderr parsing:**
- ✅ Captures SDK internal errors
- ✅ Detailed diagnostics (actual stderr)
- ✅ Detects specific issues (auth, network, permissions)
- ❌ Regex fragile (breaks if stderr format changes)
- ❌ Only helps with SDK errors (not API errors)
- ❌ Pattern maintenance (new errors = new regex)
- ❌ Circular buffer memory overhead

**Structured error system:**
- ✅ Consistent across entire application
- ✅ Centralized error messages
- ✅ Type-safe (ErrorCodes enum)
- ✅ User-friendly messages (curated)
- ❌ Generic SDK errors ("Query failed")
- ❌ Missing stderr context (less diagnostic info)
- ❌ May not surface root cause

### Context Matters

**stderr parsing makes sense when:**
- SDK errors are opaque (generic messages)
- Need detailed diagnostics
- Users familiar with technical details
- SDK errors common (auth, network issues)

**Structured errors make sense when:**
- Consistent UX across all errors
- User-friendly messages prioritized
- Error categorization sufficient
- Centralized error management

### Decision Factors

- [ ] Are SDK errors generic/unhelpful? (user reports)
- [ ] Do users need technical diagnostics vs friendly messages?
- [ ] Is stderr parsing worth maintenance burden?
- [ ] Could you combine both approaches? (structured codes + stderr details)

**Neutral observation:** These aren't mutually exclusive. You could enhance structured errors with stderr context in `details` field.

---

## 6. Service Connection Pattern (Generic + JSON)

### Claudable's Approach

```prisma
model ProjectServiceConnection {
  id          String
  projectId   String
  provider    String  // 'github', 'vercel', 'supabase'
  status      String  // 'connected', 'disconnected', 'error'
  serviceData String  // JSON blob (provider-specific metadata)
}
```

**TypeScript interfaces for type safety:**

```typescript
interface VercelProjectServiceData {
  project_id: string;
  project_url: string;
  last_deployment_id: string;
  last_deployment_status: string;
  last_deployment_url: string;
  last_deployment_at: string | null;
}
```

### claude-bridge's Approach

**No deployment integrations currently.**

**Database:** Supabase (PostgreSQL)
- `iam.users` - User authentication
- `iam.organizations` - Multi-tenancy
- `domain-passwords.json` - Domain access control (file-based)

### Key Differences

| Aspect | Generic Connection Model | No Pattern (YAGNI) |
|--------|--------------------------|---------------------|
| **Abstraction** | Single table for all integrations | No abstraction yet |
| **Type safety** | TypeScript interfaces + JSON blob | N/A |
| **Extensibility** | Add provider without schema changes | Would need new table per integration |
| **Complexity** | Upfront (before integrations exist) | Minimal (no unused code) |

### Trade-offs

**Generic connection pattern:**
- ✅ Single table for unlimited integrations
- ✅ No schema changes when adding providers
- ✅ Metadata caching (avoid repeated API calls)
- ✅ Status tracking (connection health)
- ❌ Premature abstraction (if no integrations)
- ❌ JSON blob (weak typing at DB level)
- ❌ Requires JSON parsing/validation

**No pattern (YAGNI):**
- ✅ Simpler (no unnecessary code)
- ✅ YAGNI principle (don't build what you don't need)
- ✅ Can design pattern when actually needed
- ❌ Will need refactoring when adding integrations
- ❌ May create per-provider tables (less flexible)

### Context Matters

**Generic pattern makes sense when:**
- Building deployment integrations (Vercel, GitHub, Netlify)
- Multiple integrations planned
- Integration metadata needs caching
- Extensibility is design goal

**YAGNI makes sense when:**
- No deployment integrations planned
- Focus on core features
- Avoiding premature abstraction
- Can refactor when needed

### Decision Factors

- [ ] Are deployment integrations on roadmap?
- [ ] How many integrations planned? (1, 3, 10+)
- [ ] Is this a priority feature?
- [ ] Would users pay for this?

---

## 7. Request Lifecycle Tracking (Separate from Messages)

### Claudable's Approach

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

**Frontend integration:**

```typescript
const { hasActiveRequests, createRequest, completeRequest } = useUserRequests();

// Create request
const requestId = await createRequest(instruction);

// Update status
await markUserRequestAsRunning(requestId);
await markUserRequestAsCompleted(requestId);

// UI state
{hasActiveRequests && <Spinner />}
```

### claude-bridge's Approach

**Conversation locking (concurrency control):**

```typescript
// features/auth/types/session.ts
const activeConversations = new Set<string>()
const conversationLockTimestamps = new Map<string, number>()

// Prevent concurrent requests
if (!tryLockConversation(conversationKey)) {
  return 409 // Conversation already in progress
}

try {
  // Process request
} finally {
  unlockConversation(conversationKey)
}
```

**Frontend state (message-based):**

```typescript
// UI checks last message
const isStreaming = messages[messages.length - 1]?.type !== 'complete'
```

### Key Differences

| Aspect | Request Lifecycle | Conversation Locking |
|--------|-------------------|---------------------|
| **Purpose** | Track action lifecycle + analytics | Prevent race conditions |
| **Storage** | Database (persistent) | In-memory (ephemeral) |
| **Granularity** | Per user action | Per conversation |
| **UI state** | `hasActiveRequests` | Check last message type |
| **Analytics** | Duration, success rate | None |

### Trade-offs

**Request lifecycle tracking:**
- ✅ Clean UI state abstraction (`hasActiveRequests`)
- ✅ Analytics (success rate, average duration)
- ✅ Error tracking (per request)
- ✅ Persistent (survives restarts)
- ❌ Database write per request (overhead)
- ❌ Additional table (schema complexity)
- ❌ Doesn't prevent concurrency (separate concern)

**Conversation locking:**
- ✅ Prevents race conditions (core purpose)
- ✅ Minimal overhead (in-memory Set/Map)
- ✅ Automatic timeout (5 minutes)
- ✅ Simple implementation
- ❌ No analytics
- ❌ UI state less clean (check messages)
- ❌ Ephemeral (lost on restart)

### Context Matters

**Request lifecycle makes sense when:**
- Need analytics dashboard (success rates, timing)
- Clean UI state abstraction valued
- Persistent request history needed
- Database writes acceptable overhead

**Conversation locking makes sense when:**
- Primary goal is preventing concurrent requests
- Minimal overhead preferred
- Analytics not required
- In-memory state acceptable

### Decision Factors

- [ ] Do you need request analytics? (monitoring dashboard planned?)
- [ ] Is current UI state (`check last message`) problematic?
- [ ] Is database write per request acceptable?
- [ ] Are these complementary? (could have both)

**Neutral observation:** These serve different purposes. Request tracking is for analytics/UX, locking is for concurrency control. Not mutually exclusive.

---

## 8. Package Manager Detection with Fallback

### Claudable's Approach

```typescript
async function detectPackageManager(): Promise<'npm' | 'pnpm' | 'yarn' | 'bun'> {
  // 1. Check package.json packageManager field (explicit)
  const packageJson = await readPackageJson(projectPath);
  const fromField = parsePackageManagerField(packageJson?.packageManager);
  if (fromField) return fromField;

  // 2. Check lockfiles (implicit)
  if (await fileExists('pnpm-lock.yaml')) return 'pnpm';
  if (await fileExists('yarn.lock')) return 'yarn';
  if (await fileExists('bun.lockb')) return 'bun';
  if (await fileExists('package-lock.json')) return 'npm';

  // 3. Default
  return 'npm';
}

// Fallback if command not found
try {
  await runInstall(detectedManager, args);
} catch (error) {
  if (isCommandNotFound(error) && detectedManager !== 'npm') {
    logger('Command unavailable. Falling back to npm.');
    await runInstall('npm', ['install']);
  }
}
```

### claude-bridge's Approach

**Standardized on Bun:**

```typescript
// packages/tools/src/tools/workspace/install-package.ts
const result = spawnSync("bun", ["add", packageName], {
  cwd: workspaceRoot,
  shell: false,
})
```

**Context:**
- All sites deployed with Bun runtime
- Standardized in `ecosystem.config.js`
- Controlled infrastructure (not user machines)

### Key Differences

| Aspect | Package Manager Detection | Hardcoded Bun |
|--------|---------------------------|---------------|
| **Approach** | Auto-detect from project | Standardized choice |
| **Flexibility** | Respects user preference | Enforces consistency |
| **Complexity** | File checks + fallback logic | None |
| **Compatibility** | Works with any package manager | Requires Bun installed |

### Trade-offs

**Package manager detection:**
- ✅ Respects project conventions (packageManager field)
- ✅ Works with any package manager
- ✅ Detects from lockfiles
- ✅ Graceful fallback
- ❌ File I/O overhead (check multiple files)
- ❌ Assumes lockfiles exist
- ❌ Complexity (detection + fallback logic)

**Hardcoded Bun:**
- ✅ Simple (no detection logic)
- ✅ Consistent (all sites same)
- ✅ Fast (no file checks)
- ✅ Predictable behavior
- ❌ Inflexible (can't use other package managers)
- ❌ Breaks if user doesn't have Bun
- ❌ Ignores project preferences

### Context Matters

**Detection makes sense when:**
- Supporting diverse projects (different package managers)
- Desktop app (user's local machine, unknown setup)
- Users bring their own codebases
- Flexibility is goal

**Hardcoded makes sense when:**
- Controlled infrastructure (you deploy sites)
- Standardization valued
- All sites use same runtime
- Consistency over flexibility

### Decision Factors

- [ ] Do sites use different package managers? (survey existing sites)
- [ ] Do users bring their own projects? (vs you deploy)
- [ ] Is standardization important? (ops, debugging)
- [ ] Would flexibility add value? (user requests)

---

## 9. Model ID Normalization (Aliases)

### Claudable's Approach

```typescript
const MODEL_ALIASES: Record<string, string> = {
  'opus': 'claude-opus-4-1-20250805',
  'sonnet': 'claude-sonnet-4-5-20250929',
  'haiku': 'claude-haiku-4-5-20251001',
  // ... more aliases
};

export function normalizeClaudeModelId(model?: string): string {
  if (!model) return CLAUDE_DEFAULT_MODEL;
  const normalized = model.trim().toLowerCase();
  return MODEL_ALIASES[normalized] ?? model;
}
```

**Used before:** Saving to database, passing to SDK

### claude-bridge's Approach

**Model selection:**
- Credit users → Haiku 4.5 only (enforced)
- API key users → Choose model (dropdown UI)

**Model IDs:** Likely raw strings passed directly to SDK

### Key Differences

| Aspect | Model Aliases | Raw IDs |
|--------|---------------|---------|
| **Entry** | Text input (user types "opus") | Dropdown (user selects) |
| **Storage** | Normalized full ID | Raw selection |
| **Updates** | Change alias mapping (centralized) | Update dropdown options |
| **User-facing** | Friendly names | Full IDs or labels |

### Trade-offs

**Model aliases:**
- ✅ User-friendly ("opus" vs "claude-opus-4-1-20250805")
- ✅ Centralized model IDs (update in one place)
- ✅ Consistent DB values (prevents variants)
- ✅ Forward compatibility (map old aliases to new IDs)
- ❌ Indirection (alias → ID mapping)
- ❌ Maintenance (keep aliases current)
- ❌ Assumes text input (not dropdown)

**Raw IDs:**
- ✅ Explicit (what you select is what you get)
- ✅ No indirection
- ✅ Simple (no normalization)
- ❌ Typos possible (if text input)
- ❌ Variant spellings (if manual entry)
- ❌ Verbose user-facing IDs

### Context Matters

**Aliases make sense when:**
- Text input (users type model name)
- User-friendly names preferred
- Multiple spellings/variants possible
- Frequent model updates

**Raw IDs make sense when:**
- Dropdown selection (no typos)
- Explicitness valued
- Model list is curated
- Simplicity preferred

### Decision Factors

- [ ] How do users select models? (text input vs dropdown)
- [ ] Are there variant spellings in database? (data audit)
- [ ] How often do model IDs change? (Anthropic release cadence)
- [ ] Is user-friendliness worth indirection?

---

## 10. Preview Health Checking with Graceful Timeout

### Claudable's Approach

```typescript
async function waitForPreviewReady(url: string, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();

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

  // Timeout reached, but continue anyway (graceful degradation)
  return false;
}
```

**Context:** Spawns `npm run dev` per project, polls until ready

### claude-bridge's Approach

**Architecture:** Sites run as systemd services (always-on)

**No preview lifecycle management:**
- Sites start at boot (systemd)
- Sites restart on crash (systemd)
- No on-demand spawning

**Users work on live sites** (no ephemeral preview)

### Key Differences

| Aspect | Preview Health Check | Always-Running Services |
|--------|----------------------|-------------------------|
| **Lifecycle** | On-demand (spawn, check, destroy) | Always-on (systemd) |
| **Health check** | Poll until ready | Assumed healthy (systemd) |
| **Startup** | User action triggers spawn | Boot time |
| **Shutdown** | Destroy when done | Never (until server shutdown) |

### Trade-offs

**Health check pattern:**
- ✅ Confirms server actually ready
- ✅ Prevents "server starting" race
- ✅ Graceful timeout (continues anyway)
- ✅ HEAD → GET fallback (compatibility)
- ❌ Polling overhead
- ❌ Complexity (retry logic, timeouts)
- ❌ Assumes on-demand spawning

**Always-running services:**
- ✅ Instant availability (no spawn delay)
- ✅ Simple (no lifecycle management)
- ✅ systemd handles health/restart
- ✅ No polling needed
- ❌ Resource usage (sites always running)
- ❌ No health confirmation
- ❌ Assumes sites are healthy

### Context Matters

**Health check makes sense when:**
- Spawning dev servers on-demand
- User action triggers lifecycle
- Need confirmation before showing preview
- Desktop app (ephemeral servers)

**Always-running makes sense when:**
- Multi-tenant SaaS (persistent sites)
- systemd/infrastructure manages lifecycle
- Instant availability required
- Resource usage acceptable

### Decision Factors

- [ ] Do you spawn servers on-demand?
- [ ] Is site availability instant or delayed?
- [ ] Does systemd provide health checks? (service status)
- [ ] Are resources constrained? (always-on vs on-demand)

**Neutral observation:** This is an architectural difference, not a pattern choice. Claudable spawns ephemeral previews, claude-bridge runs persistent services.

---

## Summary: Architectural Divergence

### Fundamental Differences

**Claudable:**
- Desktop application (local environment)
- Single-user (no multi-tenancy)
- Ephemeral previews (spawn on-demand)
- Flexible environment (unknown package managers, Node versions)
- Scaffolding workflows (new projects)

**claude-bridge:**
- SaaS platform (server infrastructure)
- Multi-tenant (workspace isolation)
- Persistent services (systemd, always-running)
- Controlled environment (standardized on Bun, systemd)
- Editing workflows (existing sites)

### Where Patterns Diverge

| Pattern | Claudable Context | claude-bridge Context |
|---------|-------------------|----------------------|
| **HMR Singletons** | Class-based services | Functional/module scope |
| **Dual Transport** | Low latency priority | Universality priority |
| **Auto-Healing** | Flexible workspace | Fixed workspace per domain |
| **Deduplication** | Persistent DB | Ephemeral memory (for now) |
| **stderr Parsing** | Detailed diagnostics | Structured error system |
| **Service Connections** | Deployment features | Not applicable |
| **Request Tracking** | Analytics focus | Concurrency control focus |
| **Package Detection** | Unknown environment | Standardized environment |
| **Model Aliases** | Text input | Dropdown selection |
| **Health Checks** | On-demand spawning | Always-running services |

### No Universal "Better"

Each pattern is optimized for its architectural context. Claudable patterns solve problems inherent to desktop apps with flexible environments. claude-bridge patterns solve problems inherent to multi-tenant SaaS with controlled infrastructure.

**Neither is objectively better.** Both are appropriate for their respective use cases.

### Decision Framework

For each pattern, ask:

1. **Do we have this problem?** (observable, not theoretical)
2. **Does our architecture create this problem?** (context mismatch)
3. **What's the trade-off?** (complexity vs benefit)
4. **What do users need?** (features vs elegance)
5. **Is this the right time?** (now vs later)

---

## Appendix: When to Revisit

### Implement if architecture changes:

- **HMR Singletons** → If refactoring to class-based services
- **Dual Transport** → If adding real-time collaborative features
- **Auto-Healing** → If supporting bring-your-own-codebase
- **Deduplication** → **When migrating to Redis/DB SessionStore** (critical)
- **stderr Parsing** → If SDK errors are unhelpful (user complaints)
- **Service Connections** → When adding deployment integrations
- **Request Tracking** → If building analytics dashboard
- **Package Detection** → If supporting diverse package managers
- **Model Aliases** → If switching to text input for model selection
- **Health Checks** → If spawning dev servers on-demand

### Don't implement if architecture prevents need:

- **Auto-Healing** (workspace predetermined)
- **Health Checks** (always-running services)
- **Package Detection** (standardized on Bun)

**Context is everything.** Evaluate based on your architecture, not Claudable's.
