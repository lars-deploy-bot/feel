# Install Package Privilege Fix

**Date**: 2025-11-11
**Issue**: roefapp.nl 502 error - service crash loop due to missing `bindings` package
**Root Cause**: `install_package` tool running as root with incomplete dependency resolution

## Problem

When Claude used the `install_package` MCP tool to install `better-sqlite3`:

1. ✅ Package added to `package.json`
2. ✅ `better-sqlite3` downloaded to `node_modules/`
3. ❌ **Transitive dependency `bindings` not installed**
4. ❌ **Files owned by root instead of workspace user**
5. ❌ Service crashed on startup: `Error: Cannot find module 'bindings'`

### Why It Failed

The old `/api/install-package/route.ts` implementation:

```typescript
// OLD: Ran as root (Next.js process user)
const result = spawnSync("bun", ["add", "better-sqlite3@9.2.2"], {
  cwd: workspaceRoot,  // Changed directory but NOT user
  encoding: "utf-8",
  shell: false,
})
```

**Problems:**
- Ran as **root**, not workspace user (`site-roefapp-nl`)
- `bun add` with permission mismatches caused **incomplete installs**
- Files created with **wrong ownership** (root:root instead of site-roefapp-nl:site-roefapp-nl)
- No error reported - silently failed to install transitive deps

## Solution

Created **workspace-command-runner pattern** (inspired by existing `agent-child-runner.ts`):

### 1. New Script: `run-workspace-command.mjs`

Standalone script that:
- Accepts command via stdin
- Drops privileges using `setuid()`/`setgid()`
- Runs command as workspace user
- Returns stdout/stderr/exitCode

### 2. New Library: `workspace-command-runner.ts`

TypeScript wrapper that:
- Gets workspace credentials from **filesystem ownership** (not string parsing)
- Spawns `run-workspace-command.mjs` as child process
- Passes command via stdin
- Collects results asynchronously

### 3. Updated: `install-package/route.ts`

Now uses the pattern:

```typescript
// NEW: Runs as workspace user with proper privilege dropping
const result = await runAsWorkspaceUser({
  command: "bun",
  args: ["add", "better-sqlite3@9.2.2"],
  workspaceRoot,
  timeout: 60000,
})
```

## Files Created

```
apps/web/
├── scripts/
│   └── run-workspace-command.mjs   # Child process runner (drops to workspace user)
├── lib/
│   └── workspace-command-runner.ts # Spawner library (called by API routes)
└── docs/fixes/
    └── install-package-privilege-fix.md  # This document
```

## Files Modified

```
apps/web/app/api/install-package/route.ts
```

**Changes:**
- Import `runAsWorkspaceUser` instead of `spawnSync`
- Replace synchronous spawn with async workspace runner
- All commands now run as correct user

## Why This Pattern

**Patrick Collison would ask: "Why not just run as the right user from the start?"**

This is the same pattern used by `agent-child-runner.ts` for SDK execution:

1. **Separate process required** - `setuid()` is irreversible
2. **Next.js stays as root** - serves multiple workspaces
3. **Each operation drops privileges** - spawns child per workspace
4. **Filesystem is source of truth** - credentials from `stat()`, not string parsing

## Testing

```bash
# Before fix
journalctl -u site@roefapp-nl.service
# Error: Cannot find module 'bindings'
# Status: crash loop (1296+ restarts)

# After fix (manual)
cd /srv/webalive/sites/roefapp.nl
sudo -u site-roefapp-nl bun install
systemctl restart site@roefapp-nl.service
# Status: active (running) ✓

# After fix (automatic via tool)
# MCP tool: mcp__workspace-management__install_package
# Now runs as workspace user automatically
# Files owned correctly, all dependencies installed
```

## Future Work

**Other tools that should use this pattern:**

- `bun run build` - Build commands
- `git` operations - If we add git MCP tools
- `npm`/`yarn`/`pnpm` - Alternative package managers
- Any workspace file operation requiring correct ownership

## Template Fix Needed

The Vite API Plugin template (`packages/tools/supertemplate/templates/backend/vite-api-plugin-v1.0.0.md`) should be updated:

**Current (problematic):**
```markdown
**For Claude (AI Assistant):** Use the `install_package` tool:
install_package({ packageName: "better-sqlite3", version: "9.2.2" })
```

**Should add note:**
```markdown
Note: The tool automatically:
- Runs as workspace user (correct file ownership)
- Installs all transitive dependencies
- Restarts dev server after installation

If installation completes but service doesn't start, check logs:
`journalctl -u site@domain.service -n 50`
```

## Key Learnings

1. **Permission mismatches cause silent failures** - `bun add` didn't error, just skipped deps
2. **Always run as workspace user** - File ownership matters for systemd services
3. **Reuse existing patterns** - `agent-child-runner.ts` already solved this
4. **Filesystem is source of truth** - `stat()` tells us who owns the workspace
5. **Patrick would ask: "Why are we doing this at all?"** - Running package managers through API routes is inherently risky

## Security Notes

- Commands run in **isolated child process** with dropped privileges
- **No shell execution** - direct spawn, no injection risk
- **Timeout enforcement** - 60s default, force kill after 65s
- **User determined by filesystem** - can't be faked via API params
- **Single purpose scripts** - `run-agent.mjs` ≠ `run-workspace-command.mjs`
