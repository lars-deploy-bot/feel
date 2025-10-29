# Phase 1 Implementation: Patrick's Workspace + Permissions Fix

This document summarizes the Phase 1 implementation of Patrick Collison's recommendations for fixing workspace resolution and file permissions in Claude Bridge.

## ✅ Implementation Status

### Core Implementation (Completed)

1. **Fixed Workspace Base Path**
   - Changed default from `/claude-bridge/sites` to `/srv/webalive/sites`
   - Added missing `/user` component to hostname workspace path
   - Path: `workspaceRetriever.ts:236-237`

2. **Canonical Tenant Resolution**
   - Implemented `hostToTenantId()` mapping for domain aliases
   - Added symlink resolution with containment checks using `fs.realpathSync()`
   - Path: `lib/workspace-secure.ts:16-36`

3. **Patrick's Atomic Write Helper**
   - Implemented exact specification with `O_EXCL`, proper fsyncs, and directory durability
   - Includes chown before rename for correct ownership
   - Path: `lib/workspace-secure.ts:67-94`

4. **getWorkspace() Function**
   - Single source of truth returning `{root, uid, gid, tenantId}`
   - Used once per request for consistency
   - Path: `lib/workspace-secure.ts:45-55`

5. **Enhanced Containment Guards**
   - Added `ensurePathWithinWorkspace()` with proper path normalization
   - Integrated into `canUseTool` callback in Claude stream route
   - Path: `lib/workspace-secure.ts:96-102`, `api/claude/stream/route.ts:195-202`

6. **Migration Script**
   - Automated script to fix existing root-owned files
   - Implements Patrick's recommended `find` command with safety checks
   - Path: `scripts/fix-file-ownership.sh`

7. **Test Infrastructure**
   - Test script for both invariants with performance benchmarks
   - Validates containment protection against evil inputs
   - Path: `scripts/test-workspace-invariants.js`

## 🎯 Patrick's Invariants Implemented

### Invariant A: Resolution
```
resolveWorkspace(host) → /srv/webalive/sites/<host>/user/src
```
- ✅ Domain aliases mapped to canonical tenant
- ✅ Path traversal impossible via containment checks
- ✅ Symlinks resolved and contained

### Invariant B: Authority
```
write(path, bytes) runs-as uid:gid of resolveWorkspace(host)
```
- ✅ Atomic write helper with correct ownership
- ✅ No best-effort chmod/chown after the fact
- ✅ Write itself has the right identity

## 🔧 Technical Implementation Details

### Workspace Resolution Flow
```typescript
// 1. Canonical tenant mapping
const tenant = hostToTenantId(host.toLowerCase())

// 2. Path composition
const intended = path.join(BASE, tenant, "user", "src")

// 3. Symlink resolution + containment
const real = fs.realpathSync(intended)
const baseReal = fs.realpathSync(BASE)
if (!real.startsWith(baseReal + path.sep)) {
  throw new Error("Workspace resolution escaped base")
}
```

### Atomic Write Implementation
```typescript
// 1. Create temp exclusively
const fd = fs.openSync(tmp, O_CREAT | O_EXCL | O_WRONLY, 0o644)

// 2. Write + fsync
fs.writeFileSync(fd, content)
fs.fsyncSync(fd)
fs.closeSync(fd)

// 3. Chown before rename
fs.chownSync(tmp, workspace.uid, workspace.gid)

// 4. Atomic replace + directory fsync
fs.renameSync(tmp, filePath)
const dfd = fs.openSync(dir, O_RDONLY)
fs.fsyncSync(dfd)
fs.closeSync(dfd)
```

### Route Integration
- Terminal mode: Uses existing resolver + adds uid/gid detection
- Hostname mode: Uses new `getWorkspace()` with canonical resolution
- Workspace context passed to all tools via `__workspace` property
- Containment checked before every file operation

## 📋 Deployment Sequence

Following Patrick's recommended migration order:

1. **Deploy Phase 1 code** (✅ Ready)
   - All new writes will have correct ownership
   - Feature flag ready if needed

2. **Run migration script** (✅ Ready)
   ```bash
   # Preview changes
   ./scripts/fix-file-ownership.sh --dry-run

   # Apply fixes
   ./scripts/fix-file-ownership.sh
   ```

3. **Verify with tests** (✅ Ready)
   ```bash
   # Test both invariants
   ./scripts/test-workspace-invariants.js
   ```

## 🧪 Testing Matrix

Tests validate Patrick's requirements:

- ✅ **Resolution**: `alias host → canonical tenant → realpath within base`
- ✅ **Ownership**: `create/read/delete in user/src/data/ succeeds, owned by site user`
- ✅ **Containment**: `evil path (.., symlink out) returns 422`
- ✅ **Performance**: `p95 small write < 25ms local`

## 🚀 Ready for Deployment

Phase 1 is complete and ready for deployment. All of Patrick's recommendations have been implemented:

- ✅ Path fix (workspace base + /user component)
- ✅ Option A (atomic write + chown helper)
- ✅ Containment guards on all file operations
- ✅ Canonical tenant resolution
- ✅ Migration script for existing files
- ✅ Test suite for validation

## 📈 Phase 2 Preview

Next week's improvements (Patrick's Option B):
- Replace chown-after-write with `systemd-run --uid=site-<tenant>`
- Drop Claude Bridge privileges
- Add per-tenant helper daemons for high-throughput scenarios

This Phase 1 implementation unblocks development immediately while providing a solid foundation for Phase 2 architectural improvements.