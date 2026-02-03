# Postmortem: Child Process Permission Fix (Nov 2, 2025)

**Date:** Nov 2, 2025
**Status:** ✅ Deployed & Verified
**Impact:** Critical — Fixed file ownership issues affecting all workspace builds

## Executive Summary

Files created by Claude SDK were owned by `root:root`, preventing site processes from reading them and causing build failures. Solved via **child process isolation**: spawn SDK in a child process running as the workspace user. The OS kernel enforces correct ownership for all file operations.

## Problem

### Incident
Files created by agent within site workspaces were owned by `root:root` → site processes (unprivileged) could not read them → builds failed (e.g., Vite "failed to resolve import").

### Evidence
```bash
$ ls -la /srv/webalive/sites/two.goalive.nl/user/test-ownership-v2.txt
-rw-r--r-- 1 root root 15 Nov 2 17:13 test-ownership-v2.txt
# Expected: site-two-goalive-nl site-two-goalive-nl
```

### Root Cause
The agent (and some of its dependencies) performed writes while the **Bridge process ran as `root`**, and not all writes passed through our tool callbacks. So created files inherited `root:root`.

**Constraints:**
- Minimal, targeted fix
- No feature flags, no long migrations
- Ship immediately, no fragile hacks

## What We Tried (and Why It Failed)

### Attempt 1: Global `fs` Monkey-Patching ❌

**Approach:** Override `fs.writeFileSync`/`mkdirSync` globally via `require('node:fs')` patches loaded "first."

**Why it failed:** ES modules bind named imports immutably at module evaluation time:
```ts
import { writeFileSync } from 'node:fs'  // ESM binding - immutable
```

ESM **binds** the symbol at module load, so mutating the **CommonJS** export **after** that has no effect.

**Proof:** ESM named imports completely bypass any CommonJS patches.

### Attempt 2: Tool-Level Interception ❌

**Approach:** Wrap our own tool callbacks (`Write`, `Edit`) with credential switching (`seteuid/egid`), path guards, and umask normalization.

**Why insufficient:** The SDK (or dependencies) still writes outside our tool callbacks:
- Temporary files
- Helper scripts
- Debug logs
- Cache directories

**Proof:** Disabling tool callbacks still resulted in new root-owned files.

**Conclusion:** Intercepting at tool level does **not** guarantee coverage. We must go lower.

### Attempt 3: FS Monkey-Patching with Object.defineProperty ⚠️

**Approach:** Use `require()` instead of `import`, patch via `Object.defineProperty` with `configurable: true`.

**Why partially worked but abandoned:**
- Only works if code uses `require()` (breaks with ESM)
- Only intercepts specific methods (`writeFileSync`, `mkdirSync`)
- Fragile if SDK changes import patterns
- Global per-request state (needs careful cleanup)

## The Working Solution: Child Process Isolation ✅

### Core Design

**Run each agent invocation inside a short-lived child process** that executes as the **workspace Unix user**. The OS enforces correct ownership for **all** filesystem activity, regardless of which library does it.

**Why this works:**
1. **Kernel enforcement**: After `setuid(uid)`, the ENTIRE process is that UID — every syscall, every file write, regardless of code path
2. **Catches everything**: SDK built-in tools, debug logs, cache writes, temp files — ALL inherit process UID/GID
3. **No patching needed**: ES module imports, CommonJS requires, internal SDK code — doesn't matter
4. **Zero fragility**: No import order dependencies, no monkey patching, no AST manipulation

### Architecture

```
Parent (Bridge route, runs as root):
├─ Derive {uid,gid} from workspace root
├─ Spawn child with uid/gid set
├─ Send request JSON to child stdin
└─ Stream NDJSON responses to client

Child (runner, runs as workspace user):
├─ Drop privileges via setuid/setgid
├─ Set umask(022) for predictable modes
├─ Run Claude Agent SDK
└─ Emit NDJSON for tool events + final result
```

### Implementation Files

| File | Lines | Purpose |
|------|-------|---------|
| `apps/web/lib/workspace-execution/agent-child-runner.ts` | ~130 | Parent: Spawns child, detects when to use |
| `apps/web/scripts/run-agent.mjs` | ~200 | Child: Runs SDK as workspace user |
| `apps/web/app/api/claude/stream/route.ts` | ~263-397 | Route: Conditional logic for child vs in-process |

### Detection Logic

```typescript
export function shouldUseChildProcess(workspaceRoot: string): boolean {
  try {
    const st = statSync(workspaceRoot)
    return st.uid !== 0 && st.gid !== 0  // Non-root = systemd site
  } catch {
    return false  // Fallback to in-process
  }
}
```

**Automatic switching:**
- Systemd workspaces (e.g., `/srv/webalive/sites/two.goalive.nl/` owned by `site-two-goalive-nl`) → Child process
- Root-owned workspaces → In-process (backward compatible)

## Production Results

### Deployment Timeline
- **2025-11-02 23:30 UTC**: Production deployment
- **2025-11-02 23:45 UTC**: Verification complete
- **2025-11-03 00:00 UTC**: Migration of existing root-owned files complete

### Verification
```bash
$ stat -c '%U %G %a %n' /srv/webalive/sites/two.goalive.nl/user/test-integrated.txt
site-two-goalive-nl site-two-goalive-nl 644 test-integrated.txt
```

✅ **SUCCESS** — File owned by workspace user, not root!

### Migration Results
- **Total workspaces:** 28 (14 unique sites with aliases)
- **Systemd workspaces:** 27 (non-root owned)
- **Root workspaces:** 1 (staging.goalive.nl - legacy)
- **Migration required:** 6 workspaces (60 root-owned files)
- **Migration result:** ✅ 100% clean (zero root-owned files)

### Logs Confirm Working
```
[Claude Stream a7pw2h] Use child process: true
[Claude Stream a7pw2h] Using child process runner
[agent-child] Spawned as root (will drop to 984:977)
[runner] Running as UID:984 GID:977
[runner] Success: 8 messages
```

## Why Child Process Beats Alternatives

| Approach | Coverage | Brittleness | Result |
|----------|----------|-------------|--------|
| v3.0: Credential switching | Tool callbacks only | Medium | ❌ SDK writes bypass |
| v4.0: FS monkey patching | CommonJS writes only | High | ❌ ES imports bypass |
| **v5.0: Child process** | **100% of writes** | **None** | **✅ WORKS** |

## Critical Implementation Details

### Privilege Dropping

Use **`setuid/setgid`** (permanent), NOT `seteuid/setegid` (effective):

```javascript
// ❌ WRONG - Effective UID - SDK child process inherits root
process.seteuid(uid);
process.setegid(gid);

// ✅ CORRECT - Permanent UID - All processes inherit workspace user
process.setuid(uid);
process.setgid(gid);
```

**Why?** The SDK spawns its own child processes (Claude Code binary). Effective UID only affects the immediate process; spawned children inherit the real UID (root). Permanent setuid ensures all descendants run as the workspace user.

### Working Directory

Initialize **after** importing modules:

```javascript
// ✅ CORRECT
import { query } from "@anthropic-ai/claude-agent-sdk"
// ... drop privileges ...
process.chdir(workspaceRoot)  // After imports

// ❌ WRONG - Module resolution fails if cwd set first
process.chdir(workspaceRoot)
import { query } from "@anthropic-ai/claude-agent-sdk"  // Module resolution breaks
```

### NDJSON Protocol

Child → Parent communication:

```json
{"type":"message","messageCount":1,"messageType":"assistant","content":{...}}
{"type":"message","messageCount":2,"messageType":"user","content":{...}}
{"type":"session","sessionId":"abc123"}
{"type":"complete","totalMessages":6,"result":{...}}
```

Parent converts to SSE format for frontend.

## Fallback Behavior

### Root-Owned Workspaces (Legacy)

If workspace is `root:root`, automatically falls back to **in-process execution**:
- Not deprecated
- Backward compatible
- Files still created as `root:root` (expected for legacy workspaces)

### Migration Path

**One-time fix for existing root-owned files:**

```bash
#!/bin/bash
for site_dir in /srv/webalive/sites/*/user; do
  site_user=$(stat -c '%U' $(dirname $site_dir))
  if [ "$site_user" = "root" ]; then
    echo "Skipping root-owned workspace: $site_dir"
    continue
  fi
  echo "Fixing: $site_dir → $site_user"
  chown -R "$site_user:$site_user" "$site_dir"
done
```

## Rollback Plan

If issues arise:

1. **Immediate:** Child process automatically falls back to in-process for root-owned workspaces
2. **Override:** Change workspace ownership to root temporarily:
   ```bash
   chown -R root:root /srv/webalive/sites/problematic-site.com/
   ```
3. **Full revert:** Git revert + redeploy (child process code is isolated, no side effects)

## Monitoring & Troubleshooting

### Success Indicators
```
[Claude Stream {id}] Use child process: true
[agent-child] Spawned as root (will drop to {uid}:{gid})
[runner] Running as UID:{uid} GID:{gid}
[runner] Success: {n} messages
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `EACCES` (permission denied) | Check workspace ownership: `stat /srv/webalive/sites/example.com/` |
| Child exits immediately | Check `scripts/run-agent.mjs` exists and is executable |
| Missing frontend messages | Verify NDJSON protocol working: check stdout/stderr |
| Files still root-owned | Workspace created before Nov 2 — run migration script |

## Key Learnings

1. **Process-level isolation is the only reliable way** to guarantee correct ownership regardless of SDK internals
2. **Effective UID (seteuid) is insufficient** for forking processes — use permanent setuid/setgid
3. **Module loading must happen before chdir()** — ES module resolution happens at import time
4. **No amount of patching can catch everything** — some SDK writes occur outside instrumented code paths

## Files Modified

**Core implementation:**
- `apps/web/lib/workspace-execution/agent-child-runner.ts` (NEW)
- `apps/web/scripts/run-agent.mjs` (NEW)
- `apps/web/app/api/claude/stream/route.ts` (modified ~263-397)
- `apps/web/lib/env.ts` (NEW - T3-style validation)

**Migration tooling:**
- `scripts/migrate-workspace-ownership.sh` (one-time, removed after completion)

**Documentation:**
- `docs/guides/workspace-permission-setup.md` (refactored)
- This document

## Deployment Checklist

- [x] Test on staging with systemd workspace
- [x] Verify file ownership (not root)
- [x] Verify frontend displays messages
- [x] Confirm child process detection logs
- [x] Clean up test files and failed approaches
- [x] Deploy to production: `pm2 restart claude-bridge`
- [x] Fix existing root-owned files (one-time migration - completed)
- [x] Verify child process completes successfully
- [x] Monitor logs for "Use child process: true" ✓ Working
- [x] Migration audit: All systemd workspaces verified ✓ Clean

## Next Steps

**None required** — Implementation is complete and production-ready.

**Optional future enhancements:**
- Metrics tracking (child process vs in-process usage)
- Performance monitoring (spawn overhead)
- Connection pooling for high-traffic sites

---

**End of Postmortem — Implementation Complete (Nov 2, 2025)**
