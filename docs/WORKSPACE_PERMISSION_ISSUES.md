# Workspace Resolution and Permission Issues in Secure Deployments

## Overview

This document explains critical issues discovered when using Claude Bridge with the secure systemd deployment architecture. **Four fundamental problems** prevent Claude Code from working correctly with securely deployed sites, ranging from workspace path mismatches to subtle permission mode issues that break builds.

## Table of Contents

1. [The Problems](#the-problems)
2. [Root Causes Analysis](#root-causes-analysis)
3. [Troubleshooting Guide](#troubleshooting-guide)
4. [Complete Fix Procedure](#complete-fix-procedure)
5. [Solutions](#solutions)
6. [Real-World Case Studies](#real-world-case-studies)
7. [Implementation Priority](#implementation-priority)
8. [Testing Verification](#testing-verification)

## The Problems

### 1. Workspace Resolution Mismatch (Primary Issue)

**Sites are deployed to one location, but Claude Bridge looks in a completely different location.**

#### Where Sites Actually Live (Secure Deployment)
```
/srv/webalive/sites/
├── larsvandeneeden.com/
│   └── user/                    ← Actual site files here
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
└── example.com/
    └── user/
        └── src/
```

#### Where Claude Bridge Looks (Incorrect)
```
/claude-bridge/sites/
├── larsvandeneeden.com/
│   └── src/                     ← Claude Bridge expects files here (WRONG!)
└── example.com/
    └── src/
```

#### Evidence in Code

**Deployment Script** (`deploy-site-systemd.sh:28`):
```bash
NEW_SITE_DIR="/srv/webalive/sites/$DOMAIN"
```

**Claude Bridge Workspace Resolver** (`workspaceRetriever.ts:119-120`):
```typescript
const base = process.env.WORKSPACE_BASE || "/claude-bridge/sites"  // ❌ Wrong!
const workspace = path.join(base, host, "src")
```

This mismatch means Claude Code **never sees the actual deployed site files** and operates in a completely empty/non-existent workspace.

---

### 2. File Ownership Issues (Secondary Issue)

Even if workspace resolution worked, there's a fundamental permission problem:

#### The Permission Problem
- **Claude Code runs as**: `root` (confirmed by `ps aux | grep claude`)
- **Site applications run as**: `site-larsvandeneeden-com` (secure isolation)
- **Files created by Claude Code**: owned by `root:root`
- **Site processes cannot access**: root-owned files → build failures

#### Evidence
```bash
# Files created by Claude Code tools (Write, Edit)
drwxr-xr-x 2 root root 4096 Oct 28 03:30 data
-rw-r--r-- 1 root root 452 Oct 28 03:30 posts.ts

# Site processes run as dedicated user
drwxr-xr-x 255 site-larsvandeneeden-com site-larsvandeneeden-com 12288 node_modules
```

When Vite (running as `site-larsvandeneeden-com`) tries to import the root-owned file:
```
Failed to resolve import "@/data/posts" from "src/pages/Post.tsx". Does the file exist?
```

The file exists, but is inaccessible due to ownership.

---

### 3. Permission Mode Issues (Critical but Subtle)

**NEW DISCOVERY**: Even with correct ownership, wrong permission modes cause complete build failures.

#### The Permission Mode Problem

Unix permissions have two dimensions:
- **Ownership**: WHO owns the file (`user:group`)
- **Permission Mode**: WHAT they can do (`rwxr-xr-x` / `755`)

Claude Code can create files with correct ownership but **wrong permission modes**:

```bash
# Directory created with 700 (only owner can access)
drwx------ 2 site-one-goalive-nl site-one-goalive-nl 4096 builder/

# Directory should be 755 (everyone can read/execute)
drwxr-xr-x 2 site-one-goalive-nl site-one-goalive-nl 4096 builder/
```

#### Why This Breaks Everything

Even though the site runs as `site-one-goalive-nl` (the owner), **other processes need read access**:

1. **Vite dev server** (running as site user) needs to:
   - Read source files
   - Traverse directories
   - Resolve module imports

2. **Permission mode 700** means:
   - Owner: read, write, execute ✅
   - Group: no access ❌
   - Others: no access ❌

3. **But systemd security hardening** uses groups for isolation:
   - Site runs in dedicated cgroup
   - Some operations need group/other read access
   - Mode 700 blocks these operations

#### Real-World Symptom
```
[vite] Failed to resolve import "@/components/builder/FeatureSidebar" from "src/pages/Builder.tsx"
Does the file exist?

# File EXISTS and has CORRECT OWNERSHIP, but wrong mode:
drwx------ 4 site-one-goalive-nl site-one-goalive-nl 4096 builder/
-rw-r--r-- 1 site-one-goalive-nl site-one-goalive-nl 2255 FeatureSidebar.tsx
```

Vite cannot traverse into the `builder/` directory because it has mode `700`.

---

### 4. Binary Executable Permission Issues (Build-Breaking)

**NEW DISCOVERY**: After fixing file permissions, binaries in `node_modules/.bin/` lose execute permissions.

#### The Binary Permission Problem

When applying blanket permission fixes:
```bash
# This breaks binaries!
find /srv/webalive/sites/domain/user -type f -exec chmod 644 {} \;
```

All files become `644` (readable, not executable), including:
- `/node_modules/.bin/vite`
- `/node_modules/.bin/tsc`
- `/node_modules/vite/bin/vite.js`
- `/node_modules/esbuild/bin/esbuild` (native binary)

#### Real-World Symptoms

**First symptom** (script wrapper fails):
```
/usr/bin/bash: line 1: /srv/webalive/sites/domain/user/node_modules/.bin/vite: Permission denied
error: script "dev" exited with code 126
```

**Second symptom** (native binary fails):
```
error when starting dev server:
Error: The service was stopped: spawn /srv/webalive/sites/domain/user/node_modules/vite/node_modules/esbuild/node_modules/@esbuild/linux-x64/bin/esbuild EACCES
```

#### Why This Happens

1. **Initial problem**: Claude creates files with wrong ownership
2. **First fix attempt**: `chown -R site-user:site-user ...`
3. **Second fix attempt**: `chmod -R 644 ...` (to make readable)
4. **Unintended consequence**: Binaries lose execute permission
5. **Build fails**: systemd cannot spawn non-executable binaries

---

## Problem Severity Matrix

| Problem | Severity | Symptom | Detection |
|---------|----------|---------|-----------|
| Workspace Mismatch | 🔴 Critical | Claude operates in wrong directory | Files created in `/claude-bridge/sites/` instead of `/srv/webalive/sites/` |
| File Ownership | 🔴 Critical | `Failed to resolve import` (file exists but inaccessible) | `ls -la` shows `root:root` ownership |
| Permission Modes | 🟠 High | `Failed to resolve import` (correct owner, wrong mode) | Directory shows `drwx------` (700) |
| Binary Executables | 🟠 High | `Permission denied` / `EACCES` / exit code 126 | Binary shows `-rw-r--r--` instead of `-rwxr-xr-x` |

**Key Insight**: Problems 2, 3, and 4 often produce **identical error messages** (`Failed to resolve import`) but have **different root causes**. You must check ownership AND modes AND executables.

---

## Root Causes Analysis

### Why These Issues Exist

#### Issue 1: Configuration Drift
The secure deployment system was implemented separately from Claude Bridge, creating a configuration mismatch:

1. **Original Claude Bridge design**: Expected sites in `/claude-bridge/sites/`
2. **Secure deployment design**: Places sites in `/srv/webalive/sites/` for systemd isolation
3. **No synchronization**: The two systems weren't updated together

#### Issue 2: Single-User Tool Design
Claude Code tools (Write, Edit, etc.) were designed for single-user environments:

1. **Assumption**: Developer runs Claude Code with same permissions as development server
2. **Reality**: Multi-tenant system with process isolation and dedicated users per site
3. **No user context awareness**: Tools don't know or respect workspace ownership

#### Issue 3: Umask and Default Permissions
Files created by root processes often have restrictive default permissions:

1. **Root's umask**: Often `0022` or `0077` (creates `700` directories)
2. **No permission inheritance**: New files don't inherit parent directory permissions
3. **Security by default**: Root-created files are intentionally restrictive

#### Issue 4: Overly Broad Permission Fixes
Attempting to fix ownership/modes can break binaries:

1. **Sledgehammer approach**: `chmod -R 644` affects ALL files
2. **No file type awareness**: Doesn't distinguish executables from data files
3. **Node.js ecosystem complexity**: Hundreds of binaries in `node_modules`

---

## Troubleshooting Guide

### Quick Diagnostic Commands

#### 1. Check Workspace Path (Problem 1)
```bash
# Where does Claude Bridge think the workspace is?
echo $WORKSPACE_BASE

# Where are sites actually deployed?
ls -la /srv/webalive/sites/

# Verify specific site exists
ls -la /srv/webalive/sites/one.goalive.nl/user/
```

#### 2. Check File Ownership (Problem 2)
```bash
# Find all root-owned files in site
find /srv/webalive/sites/domain.com/user -user root -ls | head -20

# Check specific problematic directory
ls -la /srv/webalive/sites/domain.com/user/src/components/builder/

# Expected output: site-domain-com:site-domain-com
# Actual (broken): root:root
```

#### 3. Check Permission Modes (Problem 3)
```bash
# Find directories not readable/executable by others
find /srv/webalive/sites/domain.com/user/src -type d ! -perm -005 -ls

# Check specific directory mode
stat -c '%a %n' /srv/webalive/sites/domain.com/user/src/components/builder/
# Expected: 755
# Broken: 700

# Verbose permission check
ls -la /srv/webalive/sites/domain.com/user/src/components/builder/
# Expected: drwxr-xr-x (755)
# Broken: drwx------ (700)
```

#### 4. Check Binary Executables (Problem 4)
```bash
# Check if main binaries are executable
ls -la /srv/webalive/sites/domain.com/user/node_modules/.bin/vite
ls -la /srv/webalive/sites/domain.com/user/node_modules/vite/bin/vite.js

# Expected: -rwxr-xr-x (755) or lrwxrwxrwx (symlink)
# Broken: -rw-r--r-- (644)

# Find all non-executable binaries
find /srv/webalive/sites/domain.com/user/node_modules -path "*/bin/*" -type f ! -perm -111 -ls | head -20
```

### Error Message → Problem Mapping

| Error Message | Likely Cause | Check |
|---------------|--------------|-------|
| `Failed to resolve import "@/components/..."` | Ownership, Mode, or Workspace | Check `ls -la` for ownership AND mode |
| `Permission denied` on `node_modules/.bin/vite` | Binary not executable | Check `ls -la vite` for `x` bits |
| `spawn ... EACCES` | Native binary not executable | Check esbuild binary permissions |
| `error: script "dev" exited with code 126` | Binary permission issue | Binary exists but lacks execute permission |
| `The file exists?` (when it actually does) | Ownership or mode preventing access | Check both ownership and mode |
| Empty workspace / no files found | Workspace path mismatch | Verify `WORKSPACE_BASE` environment variable |

---

## Complete Fix Procedure

### Step-by-Step Fix (All 4 Problems)

```bash
#!/bin/bash
# Complete permission fix for a site
DOMAIN="one.goalive.nl"
SITE_DIR="/srv/webalive/sites/$DOMAIN/user"

# Detect site user
SITE_USER=$(stat -c '%U' "$SITE_DIR" 2>/dev/null || echo "site-${DOMAIN//\./-}")

echo "Fixing permissions for $DOMAIN (user: $SITE_USER)"

# Step 1: Fix ownership (Problem 2)
echo "1. Fixing ownership..."
chown -R "$SITE_USER:$SITE_USER" "$SITE_DIR"

# Step 2: Fix directory permissions (Problem 3)
echo "2. Fixing directory permissions to 755..."
find "$SITE_DIR" -type d -exec chmod 755 {} \;

# Step 3: Fix file permissions
echo "3. Fixing file permissions to 644..."
find "$SITE_DIR" -type f -exec chmod 644 {} \;

# Step 4: Restore binary executables (Problem 4)
echo "4. Restoring binary execute permissions..."
find "$SITE_DIR/node_modules" -type f -path "*/bin/*" -exec chmod +x {} \; 2>/dev/null

# Step 5: Verify fix
echo "5. Verification..."
echo "   - Owner: $(stat -c '%U:%G' "$SITE_DIR")"
echo "   - Dir mode: $(stat -c '%a' "$SITE_DIR/src")"
echo "   - Vite executable: $(ls -l "$SITE_DIR/node_modules/.bin/vite" 2>/dev/null | awk '{print $1}')"

echo "✅ Permission fix complete!"
```

### Manual Fix (If Script Not Available)

```bash
# 1. Fix ownership
chown -R site-one-goalive-nl:site-one-goalive-nl /srv/webalive/sites/one.goalive.nl/user

# 2. Fix directory permissions
find /srv/webalive/sites/one.goalive.nl/user -type d -exec chmod 755 {} \;

# 3. Fix file permissions
find /srv/webalive/sites/one.goalive.nl/user -type f -exec chmod 644 {} \;

# 4. Restore binary executables (CRITICAL - don't skip!)
find /srv/webalive/sites/one.goalive.nl/user/node_modules -type f -path "*/bin/*" -exec chmod +x {} \;

# 5. Restart site
systemctl restart site@one-goalive-nl.service
```

### Post-Fix Verification

```bash
# Check service is running
systemctl status site@one-goalive-nl.service

# Check for errors in logs
journalctl -u site@one-goalive-nl.service -n 50 --no-pager | grep -i error

# Test HTTP response
curl -s -o /dev/null -w "%{http_code}" http://localhost:3346/
# Should return: 200

# Verify site loads in browser
# Navigate to: https://one.goalive.nl
```

---

## Architectural Context

### Secure Deployment Architecture (Correct)
```
/srv/webalive/sites/domain.com/     ← systemd user home directory
├── user/                          ← Application files (site-domain-com:site-domain-com)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── .bun/                          ← User's Bun cache
└── scripts/                       ← Deployment utilities
```

- ✅ **Security**: Each site runs as dedicated user (`site-domain-com`)
- ✅ **Isolation**: Sites cannot access each other's files
- ✅ **Resource limits**: systemd enforces memory/CPU quotas
- ✅ **Hardening**: ProtectSystem=strict and other systemd security features

### Claude Bridge Architecture (Needs Fixing)
```
Claude Bridge (Next.js app) → runs as root
├── /api/claude/stream → workspace resolution → file operations
├── WORKSPACE_BASE="/claude-bridge/sites" ← Wrong base path!
└── Tools (Write, Edit, Read) → create files as root ← Wrong ownership!
    └── Default umask → creates 700 directories ← Wrong modes!
```

---

## Solutions

### Solution 1: Fix Workspace Base Path

Update Claude Bridge to use the correct workspace base:

```bash
# Environment variable for Claude Bridge
export WORKSPACE_BASE="/srv/webalive/sites"
```

Or update the default in `workspaceRetriever.ts:119`:
```typescript
const base = process.env.WORKSPACE_BASE || "/srv/webalive/sites"  // ✅ Correct path
```

### Solution 2A: Post-Process File Ownership (Quick Fix)

After Claude Code creates files, fix ownership:

```bash
# Fix ownership for specific site
chown -R site-larsvandeneeden-com:site-larsvandeneeden-com /srv/webalive/sites/larsvandeneeden.com/user/

# Or automatically detect and fix
function fix_claude_permissions() {
    local site_dir="$1"
    local site_user=$(stat -c '%U' "$site_dir")
    find "$site_dir" -user root -exec chown "$site_user:$site_user" {} \;
}
```

### Solution 2B: User-Aware File Operations (Proper Fix)

Modify Claude Code tools to respect workspace ownership:

1. **Detect workspace user**: `stat -c '%U' workspace_directory`
2. **Create files with correct ownership**: Use `sudo -u site-user` for file operations
3. **Update tool implementations**: Modify Write/Edit tools to accept user context

### Solution 2C: Claude Bridge User Context (Best Fix ⭐)

Run Claude Bridge file operations in the context of the workspace user:

```typescript
// Detect workspace owner
const workspaceStats = fs.statSync(workspace)
const workspaceUid = workspaceStats.uid
const workspaceGid = workspaceStats.gid

// Set process credentials for file operations
process.setegid(workspaceGid)
process.seteuid(workspaceUid)

// Now file operations create files with correct ownership
```

### Solution 3: Set Correct Permission Modes

Ensure files are created with proper modes:

```typescript
// In Claude Bridge Write/Edit tools
import { mkdir, writeFile } from 'fs/promises';

// Create directory with mode 755
await mkdir(dirPath, {
  recursive: true,
  mode: 0o755  // ✅ Readable/executable by everyone
});

// Create file with mode 644
await writeFile(filePath, content, {
  mode: 0o644  // ✅ Readable by everyone
});
```

### Solution 4: Preserve Binary Executables

When fixing permissions, detect and preserve binaries:

```typescript
// Permission fix that preserves executables
import { stat, chmod } from 'fs/promises';
import { join } from 'path';

async function fixPermissionsSmart(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await chmod(fullPath, 0o755);  // Directories: 755
      await fixPermissionsSmart(fullPath);  // Recurse
    } else if (entry.isFile()) {
      // Check if it's in a bin directory or has shebang
      const isBinary = fullPath.includes('/bin/') ||
                       await hasShebang(fullPath);

      if (isBinary) {
        await chmod(fullPath, 0o755);  // Binaries: 755
      } else {
        await chmod(fullPath, 0o644);  // Regular files: 644
      }
    }
  }
}
```

---

## Real-World Case Studies

### Case Study 1: one.goalive.nl Permission Issues

**Symptoms:**
```
[vite] Failed to resolve import "@/components/builder/FeatureSidebar" from "src/pages/Builder.tsx"
Does the file exist?
```

**Investigation:**
```bash
# File clearly existed
ls -la /srv/webalive/sites/one.goalive.nl/user/src/components/builder/
total 32
drwx------ 4 root root 4096 Nov  2 12:07 .  # ← Problem: 700 mode + root owner
-rw-r--r-- 1 root root 2255 Nov  2 11:59 FeatureSidebar.tsx
```

**Root Cause:** Directory had TWO problems:
1. Owned by `root:root` instead of `site-one-goalive-nl:site-one-goalive-nl`
2. Mode `700` instead of `755`

**Fix Applied:**
```bash
# Fixed ownership
chown -R site-one-goalive-nl:site-one-goalive-nl /srv/webalive/sites/one.goalive.nl/user

# Fixed directory permissions
find /srv/webalive/sites/one.goalive.nl/user -type d -exec chmod 755 {} \;

# Fixed file permissions
find /srv/webalive/sites/one.goalive.nl/user -type f -exec chmod 644 {} \;

# This broke binaries! Had to restore:
find /srv/webalive/sites/one.goalive.nl/user/node_modules -path "*/bin/*" -exec chmod +x {} \;
```

**Lesson Learned:** Must fix ownership, modes, AND preserve binary executables.

---

### Case Study 2: esbuild Binary Permission Denied

**Symptoms:**
```
error when starting dev server:
Error: The service was stopped: spawn /srv/webalive/sites/one.goalive.nl/user/node_modules/vite/node_modules/esbuild/node_modules/@esbuild/linux-x64/bin/esbuild EACCES
```

**Investigation:**
```bash
ls -la /srv/webalive/sites/one.goalive.nl/user/node_modules/vite/node_modules/esbuild/node_modules/@esbuild/linux-x64/bin/esbuild
-rw-r--r-- 1 site-one-goalive-nl site-one-goalive-nl 9707520 Oct 28 16:54 esbuild
# ← Problem: No execute permission (should be -rwxr-xr-x)
```

**Root Cause:** Previous `chmod 644` on all files removed execute permission from native binary.

**Fix Applied:**
```bash
# Restore execute permission on all binaries
find /srv/webalive/sites/one.goalive.nl/user/node_modules -type f -path "*/bin/*" -exec chmod +x {} \;

# Verify
ls -la .../esbuild
-rwxr-xr-x 1 site-one-goalive-nl site-one-goalive-nl 9707520 Oct 28 16:54 esbuild
# ✅ Now has execute permission
```

**Lesson Learned:** Never use blanket `chmod 644` without restoring binary executables afterward.

---

## Implementation Priority

### Phase 1: Immediate Fix (Required for Basic Functionality)
1. ✅ **Fix workspace base path** → Claude Code can find actual site files
2. ⚡ **Post-process file ownership** → Manual ownership fixing after Claude operations
3. ⚡ **Post-process permission modes** → Manual mode fixing after Claude operations
4. ⚡ **Restore binary executables** → Manual binary restoration after mode fixes

### Phase 2: Proper Architecture (Required for Production)
1. 🔧 **Implement user-aware file operations** → Files created with correct ownership from start
2. 🔧 **Add workspace user detection** → Automatic detection of site ownership
3. 🔧 **Set correct permission modes** → Files created with 644/755 from start
4. 🔧 **Smart permission handling** → Detect and preserve binary executables
5. 🔧 **Update tool implementations** → Respect multi-tenant architecture

### Phase 3: Automation (Required for Scale)
1. 🚀 **Automatic permission monitoring** → Detect permission issues in real-time
2. 🚀 **Auto-fix on file creation** → Fix ownership/modes immediately after creation
3. 🚀 **Health check endpoint** → API to verify workspace permissions
4. 🚀 **Permission audit logging** → Track when/why permission fixes are needed

---

## Testing Verification

### Verify Workspace Resolution Fix
```bash
# Check Claude Bridge can find site files
curl -X POST https://larsvandeneeden.com/api/verify \
  -H "Content-Type: application/json" \
  -d '{"workspace": "webalive/sites/larsvandeneeden.com"}'

# Should return success, not "workspace not found"
```

### Verify File Ownership Fix
```bash
# Before: files owned by root
ls -la /srv/webalive/sites/larsvandeneeden.com/user/src/data/
# drwxr-xr-x 2 root root

# After Claude Code creates files and ownership is fixed
ls -la /srv/webalive/sites/larsvandeneeden.com/user/src/data/
# drwxr-xr-x 2 site-larsvandeneeden-com site-larsvandeneeden-com

# Test site can access files
sudo -u site-larsvandeneeden-com cat /srv/webalive/sites/larsvandeneeden.com/user/src/data/posts.ts
# Should succeed without permission errors
```

### Verify Permission Mode Fix
```bash
# Check directory is readable
stat -c '%a' /srv/webalive/sites/domain.com/user/src/components/builder/
# Should return: 755

# Test Vite can traverse directory
sudo -u site-domain-com ls /srv/webalive/sites/domain.com/user/src/components/builder/
# Should list files without permission errors
```

### Verify Binary Executables
```bash
# Check vite is executable
test -x /srv/webalive/sites/domain.com/user/node_modules/.bin/vite && echo "✅ Executable" || echo "❌ Not executable"

# Test site can start
systemctl restart site@domain-com.service
systemctl status site@domain-com.service
# Should show: Active: active (running)
```

---

## Security Implications

### Current State (Broken)
- ❌ **Data isolation**: Claude Code can't see site files (workspace mismatch)
- ❌ **Operation failure**: Sites can't access Claude-created files (ownership issues)
- ⚠️ **Security theater**: Secure deployment negated by root file creation
- ⚠️ **Permission confusion**: Multiple overlapping permission problems

### After Fixes
- ✅ **Proper isolation**: Claude Code limited to correct workspace boundaries
- ✅ **Secure operation**: Files created with appropriate ownership for site processes
- ✅ **Defense in depth**: systemd isolation + proper file permissions + workspace boundaries
- ✅ **Correct permission model**: Ownership, modes, and executables all handled correctly

---

## Related Files

### Deployment
- `/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh` - Site deployment (sets `/srv` path)
- `/etc/sites/{site}.env` - Site environment (could include user info)

### Claude Bridge
- `/root/webalive/claude-bridge/apps/web/app/features/claude/workspaceRetriever.ts` - Workspace resolution
- `/root/webalive/claude-bridge/apps/web/app/api/claude/stream/route.ts` - Main Claude API
- `/root/webalive/claude-bridge/apps/web/lib/workspace-utils.ts` - Workspace utilities

### systemd Services
- `/etc/systemd/system/site@.service` - Site service template
- `/etc/sites/` - Site-specific environment files

---

## Conclusion

These issues represent a fundamental architectural mismatch between the secure deployment system and Claude Bridge workspace resolution, **compounded by multiple layers of permission problems** in multi-tenant environments.

**Critical insight discovered**: Permission problems have **four distinct causes** (workspace, ownership, modes, executables) that often produce **identical symptoms** (`Failed to resolve import`). You must check ALL four to properly diagnose issues.

**The workspace resolution issue must be fixed first** - without it, Claude Code operates in the wrong directory entirely.

**The permission issues must be addressed comprehensively** - fixing only ownership without modes or executables will still result in build failures. All four aspects (ownership, modes, directories, executables) must be handled correctly.

Both issues stem from the evolution of two separate systems (secure deployment and Claude Bridge) without proper integration. The fixes require updating Claude Bridge to be aware of and respect the secure deployment architecture, **plus implementing smart permission handling that preserves the integrity of the node_modules ecosystem**.

---

## Quick Reference

### Permission Cheat Sheet

```bash
# Correct permissions for site files:
Directories:       755 (drwxr-xr-x)  - readable/executable by everyone
Regular files:     644 (-rw-r--r--)  - readable by everyone
Binaries/scripts:  755 (-rwxr-xr-x)  - executable by everyone
Ownership:         site-domain-com:site-domain-com

# Incorrect (breaks builds):
Directories:       700 (drwx------)  - only owner can access
Files (binaries):  644 (-rw-r--r--)  - binary not executable
Ownership:         root:root         - site user cannot access
```

### Emergency Fix One-Liner

```bash
DOMAIN="one.goalive.nl" && SITE_DIR="/srv/webalive/sites/$DOMAIN/user" && SITE_USER="site-${DOMAIN//\./-}" && chown -R "$SITE_USER:$SITE_USER" "$SITE_DIR" && find "$SITE_DIR" -type d -exec chmod 755 {} \; && find "$SITE_DIR" -type f -exec chmod 644 {} \; && find "$SITE_DIR/node_modules" -path "*/bin/*" -exec chmod +x {} \; 2>/dev/null && systemctl restart site@${DOMAIN//\./-}.service && echo "✅ Fixed!"
```
