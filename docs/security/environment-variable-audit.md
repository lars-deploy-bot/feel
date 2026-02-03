# Environment Variable Audit: Privilege Drop Issues

**Date**: 2025-11-12
**Context**: After fixing `BUN_INSTALL_CACHE_DIR` issue in install_package tool

## Summary

When parent process runs as **root** and spawns child that drops to **workspace user**, inherited environment variables can point to root-owned paths that become inaccessible, causing failures.

---

## ✅ FIXED

### 1. `install_package` tool - BUN_INSTALL_CACHE_DIR
**File**: `packages/tools/src/tools/workspace/install-package.ts`

**Issue**: Inherited `BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache` (not accessible after setuid)

**Fix**:
```typescript
env: {
  ...process.env,
  TMPDIR: "/tmp",
  BUN_INSTALL_CACHE_DIR: undefined, // Clear root cache path
}
```

**Status**: ✅ Fixed and deployed to staging

---

### 2. `check_codebase` tool - BUN_INSTALL_CACHE_DIR
**File**: `packages/tools/src/tools/workspace/check-codebase.ts`

**Issue**: Ran `bun run tsc` and `bun run lint` with inherited environment including `BUN_INSTALL_CACHE_DIR`

**Fix**:
```typescript
// TypeScript check
const tscResult = spawnSync("bun", ["run", "tsc", "--noEmit"], {
  cwd: workspaceRoot,
  encoding: "utf-8",
  timeout: 120000,
  shell: false,
  env: {
    ...process.env,
    TMPDIR: "/tmp",
    BUN_INSTALL_CACHE_DIR: undefined,
  },
})

// ESLint check
const lintResult = spawnSync("bun", ["run", "lint"], {
  cwd: workspaceRoot,
  encoding: "utf-8",
  timeout: 120000,
  shell: false,
  env: {
    ...process.env,
    TMPDIR: "/tmp",
    BUN_INSTALL_CACHE_DIR: undefined,
  },
})
```

**Status**: ✅ Fixed (not yet deployed)

---

### 3. Created `sanitizeSubprocessEnv()` helper
**File**: `packages/tools/src/lib/env-sanitizer.ts`

**Purpose**: Centralized environment sanitization for all subprocess execution after privilege drop

**Implementation**:
```typescript
/**
 * Sanitize environment variables for subprocess execution after privilege drop.
 * Clears cache/config directories that point to root-owned paths.
 */
export function sanitizeSubprocessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TMPDIR: "/tmp",
    BUN_INSTALL_CACHE_DIR: undefined,
    NPM_CONFIG_CACHE: undefined,
    NPM_CONFIG_PREFIX: undefined,
    PNPM_HOME: undefined,
    YARN_CACHE_FOLDER: undefined,
  }
}
```

**Integrated into**:
- `install-package.ts` (replaced manual env object)
- `check-codebase.ts` (replaced manual env object)

**Status**: ✅ Implemented (not yet deployed)

---

## ⚠️ POTENTIAL ISSUES

### 4. `run-workspace-command.mjs` - Generic command runner
**File**: `apps/web/scripts/run-workspace-command.mjs:77-83`

**Issue**: Runs arbitrary commands with inherited environment
```typescript
const result = spawnSync(command, args, {
  cwd: targetCwd,
  encoding: "utf-8",
  timeout,
  shell: false,
  // ❌ No env specified - inherits everything
})
```

**Current Usage**:
- Called by `restart-workspace` route to run `rm -rf node_modules/.vite`
- Could be extended to run other commands

**Impact**:
- `rm` command doesn't care about BUN_INSTALL_CACHE_DIR
- **Future risk**: If we add commands that use package managers (npm, pnpm, yarn, cargo, pip, etc.)

**Recommendation**: Sanitize environment variables in this generic runner

---

## 🔍 OTHER PACKAGE MANAGERS TO CONSIDER

If we add support for other package ecosystems, these env vars might cause similar issues:

### NPM
```bash
NPM_CONFIG_CACHE=/root/.npm/_cacache
NPM_CONFIG_PREFIX=/root/.npm-global
```

### PNPM
```bash
PNPM_HOME=/root/.local/share/pnpm
```

### Yarn
```bash
YARN_CACHE_FOLDER=/root/.yarn/cache
```

### Cargo (Rust)
```bash
CARGO_HOME=/root/.cargo
CARGO_TARGET_DIR=/root/target
```

### Python (pip, poetry)
```bash
PIP_CACHE_DIR=/root/.cache/pip
POETRY_HOME=/root/.local/share/pypoetry
POETRY_CACHE_DIR=/root/.cache/pypoetry
```

### Go
```bash
GOPATH=/root/go
GOCACHE=/root/.cache/go-build
```

---

## RECOMMENDED FIXES

### Fix #1: Sanitize `check_codebase` tool

```typescript
// packages/tools/src/tools/workspace/check-codebase.ts

const tscResult = spawnSync("bun", ["run", "tsc", "--noEmit"], {
  cwd: workspaceRoot,
  encoding: "utf-8",
  timeout: 120000,
  shell: false,
  env: {
    ...process.env,
    TMPDIR: "/tmp",
    BUN_INSTALL_CACHE_DIR: undefined,
  },
})

const lintResult = spawnSync("bun", ["run", "lint"], {
  cwd: workspaceRoot,
  encoding: "utf-8",
  timeout: 120000,
  shell: false,
  env: {
    ...process.env,
    TMPDIR: "/tmp",
    BUN_INSTALL_CACHE_DIR: undefined,
  },
})
```

### Fix #2: Create environment sanitization helper ✅ IMPLEMENTED

**File**: `packages/tools/src/lib/env-sanitizer.ts`

The `sanitizeSubprocessEnv()` helper has been created and is now available for all workspace tools.

**Usage**:
```typescript
import { sanitizeSubprocessEnv } from "../../lib/env-sanitizer.js"

spawnSync("bun", args, {
  cwd: workspaceRoot,
  env: sanitizeSubprocessEnv(),
  shell: false,
})
```

**Already integrated into**:
- `install-package.ts`
- `check-codebase.ts`

**Future tools should use this helper for consistency.**

### Fix #3: Update `run-workspace-command.mjs` (LOW PRIORITY)

**Note**: This file is in `apps/web/scripts/` (JavaScript) and cannot import the TypeScript helper from `packages/tools/`. Inline sanitization is recommended.

```javascript
// apps/web/scripts/run-workspace-command.mjs

const result = spawnSync(command, args, {
  cwd: targetCwd,
  encoding: "utf-8",
  timeout,
  shell: false,
  env: {
    ...process.env,
    TMPDIR: "/tmp",
    // Clear cache paths that might point to root-owned directories
    BUN_INSTALL_CACHE_DIR: undefined,
    NPM_CONFIG_CACHE: undefined,
    NPM_CONFIG_PREFIX: undefined,
    PNPM_HOME: undefined,
    YARN_CACHE_FOLDER: undefined,
  },
})
```

**Status**: Not yet implemented (low priority - only used for `rm -rf` which doesn't need package manager caches)

---

## TESTING CHECKLIST

For each subprocess execution after privilege drop:

- [ ] Test with workspace user that has no home directory
- [ ] Test with inherited root environment variables
- [ ] Verify files created are owned by workspace user
- [ ] Check if command accesses cache directories
- [ ] Verify command succeeds after setuid

---

## PRIORITY

1. ~~**High**: Fix `check_codebase` tool (used regularly, might fail intermittently)~~ ✅ COMPLETED
2. ~~**Medium**: Create `sanitizeSubprocessEnv()` helper (DRY, future-proof)~~ ✅ COMPLETED
3. **Low**: Update `run-workspace-command.mjs` (only used for `rm -rf` currently)

---

## LESSONS LEARNED

1. **Always sanitize environment when crossing privilege boundaries**
2. **Package managers love cache directories** - assume they'll fail after setuid
3. **Manual testing works but subprocess fails** → Check environment variables
4. **Test the diff**: Compare `env` output from manual vs subprocess execution

---

## MONITORING

Add logging to detect similar issues:

```typescript
// Before subprocess
console.error(`[tool] Subprocess env vars: BUN_*, NPM_*, TMPDIR, HOME`)
console.error(`[tool] BUN_INSTALL_CACHE_DIR=${process.env.BUN_INSTALL_CACHE_DIR}`)

// After subprocess failure
if (result.status !== 0 && result.stderr.includes("AccessDenied")) {
  console.error(`[tool] Possible env var issue - check cache directories`)
}
```

---

**Last Updated**: 2025-11-12
**Next Review**: When adding support for new package managers or build tools
