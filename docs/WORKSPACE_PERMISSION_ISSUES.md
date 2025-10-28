# Workspace Resolution and Permission Issues in Secure Deployments

## Overview

This document explains critical issues discovered when using Claude Bridge with the secure systemd deployment architecture. Two fundamental problems prevent Claude Code from working correctly with securely deployed sites.

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
```

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

### Solution 2C: Claude Bridge User Context (Best Fix)

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

## Implementation Priority

### Phase 1: Immediate Fix (Required for Basic Functionality)
1. ✅ **Fix workspace base path** → Claude Code can find actual site files
2. ⚡ **Post-process file ownership** → Manual ownership fixing after Claude operations

### Phase 2: Proper Architecture (Required for Production)
1. 🔧 **Implement user-aware file operations** → Files created with correct ownership from start
2. 🔧 **Add workspace user detection** → Automatic detection of site ownership
3. 🔧 **Update tool implementations** → Respect multi-tenant architecture

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

## Security Implications

### Current State (Broken)
- ❌ **Data isolation**: Claude Code can't see site files (workspace mismatch)
- ❌ **Operation failure**: Sites can't access Claude-created files (ownership issues)
- ⚠️ **Security theater**: Secure deployment negated by root file creation

### After Fixes
- ✅ **Proper isolation**: Claude Code limited to correct workspace boundaries
- ✅ **Secure operation**: Files created with appropriate ownership for site processes
- ✅ **Defense in depth**: systemd isolation + proper file permissions + workspace boundaries

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

## Conclusion

These issues represent a fundamental architectural mismatch between the secure deployment system and Claude Bridge workspace resolution, compounded by file ownership problems in multi-tenant environments.

**The workspace resolution issue must be fixed first** - without it, Claude Code operates in the wrong directory entirely. **The permission issue must be addressed second** - without it, site processes cannot access Claude-created files.

Both issues stem from the evolution of two separate systems (secure deployment and Claude Bridge) without proper integration. The fixes require updating Claude Bridge to be aware of and respect the secure deployment architecture.