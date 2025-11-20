# Privilege Separation Audit

**Date:** 2025-11-11
**Purpose:** Identify all commands that touch workspace files and verify they run as workspace user

## Audit Results

### ✅ Correct (Uses Workspace User)

| File | Operation | Status |
|------|-----------|--------|
| `app/api/install-package/route.ts` | `bun add` | ✅ Uses `runAsWorkspaceUser()` |
| `app/api/claude/stream/route.ts` | SDK file operations | ✅ Uses `runAgentChild()` |
| `packages/tools/src/tools/debug/read-server-logs.ts` | Read logs via `journalctl` | ✅ Read-only, no workspace modification |
| `lib/workspace-service-manager.ts` | `systemctl` commands | ✅ System operations, needs root |

### ❌ Issues Found

| File | Line | Issue | Risk | Status |
|------|------|-------|------|--------|
| `app/api/restart-workspace/route.ts` | 48 | `rm -rf "${viteCachePath}"` runs as root | **MEDIUM** - Wrong ownership if cache recreated | ✅ **FIXED** (2025-11-11) |

## Detailed Issue

### `/api/restart-workspace` - Cache Clearing ✅ FIXED

**Old code (line 48):**
```typescript
execSync(`rm -rf "${viteCachePath}"`, {
  encoding: "utf-8",
  timeout: 5000,
})
```

**Problem:**
- Ran as **root**, deleted workspace files
- When Vite recreated cache (running as workspace user), could hit permission errors
- Violated privilege separation principle

**Impact:**
- MEDIUM risk: Could cause permission issues on next build
- Cache may not be writable by workspace user after deletion
- Not immediately breaking, but wrong pattern

**Fix Applied (2025-11-11):**
```typescript
import { runAsWorkspaceUser } from "@/lib/workspace-execution/command-runner"

// Run as workspace user - ensures correct ownership
const result = await runAsWorkspaceUser({
  command: "rm",
  args: ["-rf", "node_modules/.vite"],
  workspaceRoot,
  timeout: 5000,
})

if (!result.success) {
  console.warn(`Failed to clear Vite cache:`, result.stderr)
  // Continue with restart anyway - cache clear is optional
}

// systemctl restart still runs as root (correct - it's a system operation)
execSync(`systemctl restart ${serviceName}`)
```

**Result:**
- ✅ Cache deletion runs as workspace user
- ✅ Correct file ownership maintained
- ✅ No permission conflicts
- ✅ Pattern consistent with install-package fix

## When Commands Need Workspace User

**MUST use workspace execution:**
- ✅ `bun add` / `npm install` / package managers
- ✅ `rm -rf` workspace files
- ✅ `bun run build` / builds
- ✅ `git` commands (if we add them)
- ✅ Any file creation/modification in workspace

**Can run as root:**
- ✅ `systemctl` (system operations)
- ✅ `journalctl` (read-only logs)
- ✅ Validation/checks that don't modify files

## Recommended Actions

1. **Fix immediately:** Update `/api/restart-workspace` to use workspace execution
2. **Review:** Any future endpoints that touch workspace files
3. **Enforce:** Add lint rule or type system to catch `spawnSync`/`exec` in API routes

## How to Verify

**Check if running as correct user:**
```bash
# Watch file creation during operation
watch -n 0.5 'ls -la /srv/webalive/sites/example.com/node_modules/.vite 2>/dev/null'

# Should show: site-example-com site-example-com (not root root)
```

**Test case:**
1. Install package via MCP tool
2. Check ownership: `ls -la /srv/webalive/sites/example.com/node_modules/`
3. Restart workspace via MCP tool
4. Check cache ownership: `ls -la /srv/webalive/sites/example.com/node_modules/.vite/`
5. Build the site
6. Verify no permission errors

## See Also

- `docs/architecture/workspace-privilege-separation.md` - Complete pattern documentation
- `docs/fixes/install-package-privilege-fix.md` - Original bug that led to this pattern
- `CLAUDE.md` Section 1 - Quick reference
