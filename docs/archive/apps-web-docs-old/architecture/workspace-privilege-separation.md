# Workspace Privilege Separation

**Status**: Required pattern for ALL workspace operations
**Applies to**: Package installs, file operations, builds, git commands, ANY command that touches workspace files
**Last Updated**: 2025-11-11
**Related**: `/docs/fixes/install-package-privilege-fix.md`, `CLAUDE.md` Section 1

## The Problem We're Solving

Claude Bridge is a **multi-tenant platform** where users create and manage websites through AI conversations. This creates a fundamental security and operational challenge:

### Security Requirements
1. **Isolation**: User A's website files must be completely inaccessible to User B
2. **Privilege Separation**: The platform can't run everything as root (security risk)
3. **No Cross-Contamination**: Installing a package for website A shouldn't affect website B

### Operational Requirements
1. **Correct File Ownership**: When a package is installed for `example.com`, the files must be owned by the user running `site@example-com.service`, NOT root
2. **Working Package Managers**: `bun add`, `npm install` must work correctly without permission errors
3. **Complete Installs**: All transitive dependencies must install (not just the top-level package)

### What Happens Without This Pattern

**Real bug example (roefapp.nl 502 error):**
```bash
# User asks Claude: "Install better-sqlite3 for my database"
# Old code ran as root:
spawnSync("bun", ["add", "better-sqlite3@9.2.2"], { cwd: "/srv/webalive/sites/roefapp.nl/user" })

# Result:
# ✅ Package added to package.json
# ✅ better-sqlite3 downloaded
# ❌ Missing dependency 'bindings' (incomplete install)
# ❌ Files owned by root:root instead of site-roefapp-nl:site-roefapp-nl
# ❌ Service crashed with "Cannot find module 'bindings'"
# ❌ User saw 502 error
# ❌ Site was down for hours until manual fix
```

## The Solution: Per-Workspace System Users

**Architecture Overview:**

Every website gets its own Linux system user with complete filesystem isolation.

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Bridge (Next.js)                                      │
│ Process: root (UID 0)                                        │
│ Purpose: Serve multiple workspaces, handle HTTP requests    │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ API Route: /api/install-package                        │ │
│  │ User: root                                              │ │
│  │                                                          │ │
│  │  1. Validate request                                    │ │
│  │  2. Get workspace path: /srv/webalive/sites/example.com│ │
│  │  3. stat() workspace → {uid: 1001, gid: 1001}          │ │
│  │  4. Spawn child process ──────────┐                    │ │
│  └───────────────────────────────────┼────────────────────┘ │
│                                       │                      │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                                        ▼
            ┌───────────────────────────────────────────────┐
            │ Child Process: run-workspace-command.mjs      │
            │ Started as: root                              │
            │                                               │
            │ 1. process.setgid(1001)  ← Drop group        │
            │ 2. process.setuid(1001)  ← Drop user (IRREVERSIBLE) │
            │ 3. process.chdir("/srv/webalive/sites/example.com/user") │
            │                                               │
            │ Now running as: site-example-com (UID 1001)  │
            │                                               │
            │ 4. spawnSync("bun", ["add", "react"])        │
            │    ├─ All files created: site-example-com:site-example-com │
            │    ├─ All deps installed correctly           │
            │    └─ No permission errors                   │
            │                                               │
            │ 5. Exit with stdout/stderr/exitCode          │
            └───────────────────────────────────────────────┘
```

### Concrete Example

**User Journey:**
```
1. User creates website "example.com"
   → Deployment script runs: /root/webalive/claude-bridge/scripts/deploy-site-systemd.sh example.com

2. System creates:
   User:      site-example-com (UID: 1001, GID: 1001)
   Workspace: /srv/webalive/sites/example.com/
   Owner:     site-example-com:site-example-com (chown -R)
   Service:   site@example-com.service (runs as site-example-com)
   Port:      3338 (auto-assigned from registry)

3. User chats with Claude: "Install react and tailwind"
   → Claude calls: mcp__workspace-management__install_package

4. Bridge receives request:
   {
     "packageName": "react",
     "version": "18.2.0",
     "workspaceRoot": "/srv/webalive/sites/example.com/user"
   }

5. API route: /api/install-package/route.ts
   a. Validates workspace path (security check)
   b. Calls: runAsWorkspaceUser({ command: "bun", args: ["add", "react@18.2.0"] })

6. command-runner.ts:
   a. stat("/srv/webalive/sites/example.com/user") → {uid: 1001, gid: 1001}
   b. spawn("node", ["scripts/run-workspace-command.mjs"])
   c. Send via stdin: {"command": "bun", "args": ["add", "react@18.2.0"]}

7. run-workspace-command.mjs:
   a. Read command from stdin
   b. process.setgid(1001)  // Drop to site-example-com group
   c. process.setuid(1001)  // Drop to site-example-com user (can't go back!)
   d. process.chdir("/srv/webalive/sites/example.com/user")
   e. spawnSync("bun", ["add", "react@18.2.0"])
      → bun runs as site-example-com
      → Creates files owned by site-example-com:site-example-com
      → All dependencies install correctly
   f. Return stdout/stderr/exitCode to parent

8. API route verifies service restarted and is running:
   a. systemctl restart site@example-com.service
   b. Wait 2 seconds
   c. systemctl is-active site@example-com.service
   d. If not active: get logs, return user-friendly error
   e. If active: return success

9. User sees: "✓ Successfully installed react@18.2.0 and restarted dev server"
```

### Why This Works

**Filesystem Ownership:**
```bash
# Before (wrong):
$ ls -la /srv/webalive/sites/example.com/node_modules/react/
drwxr-xr-x root root 4096 Nov 11 22:00 .

# After (correct):
$ ls -la /srv/webalive/sites/example.com/node_modules/react/
drwxr-xr-x site-example-com site-example-com 4096 Nov 11 22:00 .

# Systemd service can now read/write these files:
$ systemctl cat site@example-com.service
[Service]
User=site-example-com
Group=site-example-com
ExecStart=/usr/local/bin/bun run dev --port 3338
WorkingDirectory=/srv/webalive/sites/example.com/user
```

**Security Isolation:**
```bash
# User A's workspace (UID 1001):
$ ls -la /srv/webalive/sites/example.com/
drwxr-xr-x site-example-com site-example-com 4096 Nov 11 22:00 .

# User B's workspace (UID 1002):
$ ls -la /srv/webalive/sites/another-site.com/
drwxr-xr-x site-another-site-com site-another-site-com 4096 Nov 11 22:00 .

# User A's process (running as UID 1001) CANNOT access User B's files
# Linux kernel enforces this at the filesystem level
```

## When to Use This Pattern

**ALWAYS use workspace execution for:**
- ✅ `bun add` / `npm install` / package managers
- ✅ `bun run build` / builds
- ✅ `git` commands (if we add git MCP tools)
- ✅ Any command that creates/modifies workspace files

**DON'T use workspace execution for:**
- ❌ `systemctl` commands (system operations, need root)
- ❌ `journalctl` (reading logs, read-only)
- ❌ Reading files (SDK already handles this with correct user)

## How to Use

### For Commands (package install, build, etc.)

```typescript
import { runAsWorkspaceUser } from "@/lib/workspace-execution/command-runner"

// Run command as workspace user
const result = await runAsWorkspaceUser({
  command: "bun",
  args: ["add", "react@18.2.0"],
  workspaceRoot: "/srv/webalive/sites/example.com/user",
  timeout: 60000,
})

if (!result.success) {
  console.error("Command failed:", result.stderr)
}
```

### For SDK Operations (Claude file operations)

```typescript
import { runAgentChild } from "@/lib/workspace-execution/agent-child-runner"

// SDK runs as workspace user automatically
const stream = runAgentChild(workspaceRoot, {
  message: "Create a new component",
  model: "claude-sonnet-4",
})
```

## How It Works

**1. Spawner (`lib/workspace-execution/command-runner.ts`):**
- Gets workspace user from filesystem: `stat(workspaceRoot)` → `{ uid, gid }`
- Spawns child process: `scripts/run-workspace-command.mjs`
- Passes credentials via environment: `TARGET_UID`, `TARGET_GID`

**2. Child Script (`scripts/run-workspace-command.mjs`):**
- Reads command from stdin
- **Drops privileges**: `process.setgid(gid)`, `process.setuid(uid)`
- Runs command as workspace user
- Returns stdout/stderr/exitCode

**3. Result:**
- All files created by command owned by workspace user
- Package managers work correctly (no permission errors)
- Systemd service can read/write files (same user)

## Security Notes

**Safe:**
- Domain extracted from filesystem path, not user input
- Uses `shell: false` everywhere (no command injection)
- Credentials from `stat()`, not string parsing
- Child process is isolated (can't escalate back to root)

**Critical:**
- NEVER parse domain from user input
- NEVER use `shell: true`
- ALWAYS validate workspace path with `isPathWithinWorkspace()`

## File Structure and Responsibilities

```
apps/web/
├── lib/
│   └── workspace-execution/
│       ├── command-runner.ts          # TypeScript spawner for commands
│       │   Purpose: Spawn run-workspace-command.mjs with correct credentials
│       │   Exports: runAsWorkspaceUser(), shouldUseWorkspaceUser()
│       │   Used by: /api/install-package, future tools (build, git)
│       │
│       └── agent-child-runner.ts      # TypeScript spawner for SDK
│           Purpose: Spawn run-agent.mjs for Claude file operations
│           Exports: runAgentChild(), shouldUseChildProcess()
│           Used by: /api/claude/stream (SDK execution)
│
├── scripts/
│   ├── run-workspace-command.mjs      # Standalone Node.js script
│   │   Purpose: Drop privileges and run arbitrary command
│   │   Protocol: Reads JSON from stdin, writes stdout/stderr, exits with status
│   │   Why .mjs: Executed directly by Node, not bundled by Next.js
│   │   Security: Uses setuid/setgid (IRREVERSIBLE privilege drop)
│   │
│   └── run-agent.mjs                  # Standalone Node.js script
│       Purpose: Drop privileges and run Claude Agent SDK
│       Protocol: Same stdin/stdout pattern as run-workspace-command.mjs
│       Additional: Handles OAuth credentials, MCP servers, tool whitelisting
│
├── app/api/
│   ├── install-package/
│   │   └── route.ts                   # Uses workspace execution pattern
│   │       1. Validates workspace path
│   │       2. Calls runAsWorkspaceUser() for package install
│   │       3. Restarts systemd service
│   │       4. Verifies service started with isServiceRunning()
│   │       5. Returns user-friendly error if service failed
│   │
│   └── claude/stream/
│       └── route.ts                   # Uses agent child runner
│           1. Validates workspace and auth
│           2. Calls runAgentChild() for SDK execution
│           3. Streams SDK responses via SSE
│
└── lib/
    └── workspace-service-manager.ts   # Systemd service management
        Exports:
        - extractDomainFromWorkspace() - Get domain from path (SECURITY CRITICAL)
        - domainToServiceName() - Convert domain to systemd service name
        - restartSystemdService() - Restart systemd service
        - isServiceRunning() - Check if service is active
        - getServiceLogs() - Get recent logs from journalctl
```

### Why Scripts Are Separate from Lib

**Question:** Why not put `run-workspace-command.mjs` inside `lib/workspace-execution/`?

**Answer:** Build system and runtime path resolution.

```
Development:
- TypeScript in lib/ compiled to .next/server/app/lib/
- Scripts in scripts/ copied to .next/standalone/scripts/
- process.cwd() points to app root in both environments

Production (standalone build):
- .next/standalone/apps/web/scripts/run-workspace-command.mjs
- __dirname would be wrong if script was in compiled lib/
- process.cwd() + "scripts/..." always works

Why it matters:
- Next.js standalone builds have specific structure
- Scripts must be at predictable paths
- TypeScript compilation would break direct Node execution
```

## Real Example: Install Package

**Before (broken):**
```typescript
// Runs as root, wrong ownership, incomplete install
spawnSync("bun", ["add", "better-sqlite3"], {
  cwd: workspaceRoot,
})
```

**After (correct):**
```typescript
// Runs as workspace user, correct ownership, complete install
await runAsWorkspaceUser({
  command: "bun",
  args: ["add", "better-sqlite3"],
  workspaceRoot,
})
```

**Result:**
- ✅ All deps installed (including transitive deps like `bindings`)
- ✅ Files owned by `site-example-com`
- ✅ Systemd service starts successfully

## See Also

- `/root/webalive/claude-bridge/docs/fixes/install-package-privilege-fix.md` - The bug that led to this pattern
- `lib/workspace-execution/` - Implementation
- `CLAUDE.md` - Quick reference
