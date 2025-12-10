# Plan: Superadmin Bridge Editing

Allow superadmins (Lars only) to edit the Claude Bridge repository itself from within the platform.

## Overview

Currently, workspaces are limited to `/srv/webalive/sites/{domain}/user`. This plan adds a special "bridge" workspace that points to `/root/webalive/claude-bridge` and runs as root, available only to superadmins.

## Current Architecture

```
User → verifyWorkspaceAccess() → workspace must be in JWT's workspaces[]
     → resolveWorkspace() → /srv/webalive/sites/{domain}/user
     → Child process drops to site-{slug} user
     → Claude SDK runs with limited filesystem access
```

## Proposed Architecture

```
User → verifyWorkspaceAccess()
     → IF superadmin AND workspace === "claude-bridge"
           → Skip normal workspace resolution
           → Use /root/webalive/claude-bridge as workspace
           → Run as root (no privilege drop)
           → All tools allowed (including Bash)
     → ELSE normal flow
```

## Implementation Steps

### Phase 1: Define Superadmin

**File: `packages/shared/src/config.ts`**

Add superadmin constants:

```typescript
export const SUPERADMIN = {
  /** Emails with superadmin access (can edit Bridge itself) */
  EMAILS: ["eedenlars@gmail.com"] as readonly string[],

  /** Special workspace name for Bridge editing */
  WORKSPACE_NAME: "claude-bridge",

  /** Path to Bridge repository */
  WORKSPACE_PATH: "/root/webalive/claude-bridge",
} as const
```

### Phase 2: Create Bridge Domain Record

**SQL Migration or Manual Insert:**

```sql
-- Insert special domain for Bridge editing
-- Use org_id from Lars's "larry" organization
INSERT INTO app.domains (hostname, port, org_id)
VALUES ('claude-bridge', 0, (
  SELECT org_id FROM iam.orgs WHERE slug = 'larry'
));
```

This makes `claude-bridge` appear in Lars's workspace list.

### Phase 3: Modify Workspace Resolution

**File: `apps/web/features/chat/lib/workspaceRetriever.ts`**

Add superadmin workspace handling:

```typescript
import { SUPERADMIN } from "@webalive/shared"

export function getWorkspace({ host, body, requestId }: GetWorkspaceParams): WorkspaceResult {
  // Check for superadmin bridge workspace FIRST
  if (body?.workspace === SUPERADMIN.WORKSPACE_NAME) {
    // Don't resolve here - let auth layer handle it
    // Just return the special path
    return {
      success: true,
      workspace: SUPERADMIN.WORKSPACE_PATH,
    }
  }

  // Normal flow...
}
```

### Phase 4: Modify Auth Check for Superadmin

**File: `apps/web/features/auth/lib/auth.ts`**

Add superadmin check:

```typescript
import { SUPERADMIN } from "@webalive/shared"

function isSuperadmin(email: string): boolean {
  return SUPERADMIN.EMAILS.some(e => e.toLowerCase() === email.toLowerCase())
}

export async function verifyWorkspaceAccess(
  user: SessionUser,
  body: Record<string, unknown>,
  logPrefix = "[Auth]",
): Promise<string | null> {
  const workspace = body.workspace

  // Superadmin bridge access
  if (workspace === SUPERADMIN.WORKSPACE_NAME) {
    if (!isSuperadmin(user.email)) {
      console.log(`${logPrefix} Non-superadmin attempted bridge access: ${user.email}`)
      return null
    }
    console.log(`${logPrefix} Superadmin bridge access granted: ${user.email}`)
    return SUPERADMIN.WORKSPACE_NAME
  }

  // Normal workspace verification...
}
```

### Phase 5: Skip Privilege Drop for Superadmin

**File: `apps/web/app/api/claude/stream/route.ts`**

Detect superadmin workspace and skip privilege drop:

```typescript
import { SUPERADMIN } from "@webalive/shared"

// In the route handler, after workspace resolution:
const isSuperadminWorkspace = resolvedWorkspaceName === SUPERADMIN.WORKSPACE_NAME

// When spawning child/worker:
if (isSuperadminWorkspace) {
  // Run as root - no uid/gid change
  // All tools allowed (Bash, etc.)
}
```

**File: `apps/web/lib/workspace-execution/agent-child-runner.ts`**

Add option to skip privilege drop:

```typescript
interface AgentRequest {
  // ... existing fields
  skipPrivilegeDrop?: boolean  // For superadmin only
}

export function runAgentChild(workspaceRoot: string, payload: AgentRequest): ReadableStream<Uint8Array> {
  let uid: number | undefined
  let gid: number | undefined

  if (!payload.skipPrivilegeDrop) {
    const creds = getWorkspaceCredentials(workspaceRoot)
    uid = creds.uid
    gid = creds.gid
  }
  // If skipPrivilegeDrop, uid/gid remain undefined → run as root

  const child = spawn(process.execPath, [runnerPath], {
    env: {
      ...process.env,
      // Only set if we have values (undefined = don't drop)
      ...(uid && { TARGET_UID: String(uid) }),
      ...(gid && { TARGET_GID: String(gid) }),
      TARGET_CWD: workspaceRoot,
      ANTHROPIC_API_KEY: payload.apiKey || process.env.ANTHROPIC_API_KEY,
    },
    // ... rest
  })
}
```

**File: `apps/web/scripts/run-agent.mjs`**

Handle missing UID/GID (don't drop privileges):

```javascript
const targetUid = process.env.TARGET_UID && Number(process.env.TARGET_UID)
const targetGid = process.env.TARGET_GID && Number(process.env.TARGET_GID)

// Only drop privileges if explicitly set
if (targetGid && process.setgid) {
  process.setgid(targetGid)
}
if (targetUid && process.setuid) {
  process.setuid(targetUid)
}
// If neither set, continue running as root
```

### Phase 6: Enable All Tools for Superadmin

**File: `packages/shared/src/bridge-tools.ts`**

Add superadmin tool set:

```typescript
/**
 * Get all allowed tools for superadmin mode (everything enabled)
 */
export function getSuperadminAllowedTools(): string[] {
  // All SDK tools + all MCP tools
  return [
    ...BRIDGE_ALLOWED_SDK_TOOLS,
    ...BRIDGE_ADMIN_ONLY_SDK_TOOLS,
    "Task",      // Enable subagents for superadmin
    "WebSearch", // Enable web search for superadmin
  ]
}

export function getSuperadminDisallowedTools(): string[] {
  return [] // Nothing disallowed for superadmin
}
```

**File: `apps/web/lib/claude/agent-constants.mjs`**

```javascript
export function getAllowedTools(workspacePath, isAdmin = false, isSuperadmin = false) {
  if (isSuperadmin) {
    return getSuperadminAllowedTools()
  }
  return getBridgeAllowedTools(getEnabledMcpToolNames, isAdmin)
}

export function getDisallowedTools(isAdmin = false, isSuperadmin = false) {
  if (isSuperadmin) {
    return getSuperadminDisallowedTools()
  }
  return getBridgeDisallowedTools(isAdmin)
}
```

### Phase 7: Add Bridge to JWT Workspaces

When Lars logs in, include `claude-bridge` in his JWT workspaces array.

**Option A: Database trigger** - Add domain to his org
**Option B: Special case in login** - If superadmin, inject workspace

Recommended: Option A (cleaner, uses existing system)

```sql
-- Find Lars's org
SELECT org_id FROM iam.orgs WHERE slug = 'larry';

-- Add bridge domain to his org
INSERT INTO app.domains (hostname, port, org_id)
VALUES ('claude-bridge', 0, 'lars-org-id-here');
```

### Phase 8: UI Changes (Optional)

Show "Claude Bridge" in workspace switcher with special styling (dev badge, different icon, etc.)

## Security Considerations

1. **Double-check superadmin status** - Verify at EVERY layer (auth, workspace resolution, child process)
2. **Audit logging** - Log all superadmin actions
3. **No credential leaks** - Ensure .env files aren't readable/editable
4. **Git safety** - Don't allow destructive git operations (force push to main)

## File Changes Summary

| File | Change |
|------|--------|
| `packages/shared/src/config.ts` | Add `SUPERADMIN` constants |
| `packages/shared/src/bridge-tools.ts` | Add superadmin tool functions |
| `apps/web/features/auth/lib/auth.ts` | Add `isSuperadmin()`, modify `verifyWorkspaceAccess()` |
| `apps/web/features/chat/lib/workspaceRetriever.ts` | Handle bridge workspace |
| `apps/web/app/api/claude/stream/route.ts` | Pass superadmin flag to child |
| `apps/web/lib/claude/agent-constants.mjs` | Add superadmin tool handling |
| `apps/web/lib/workspace-execution/agent-child-runner.ts` | Add `skipPrivilegeDrop` option |
| `apps/web/scripts/run-agent.mjs` | Handle missing UID/GID |
| Database | Add `claude-bridge` domain to Lars's org |

## Testing

1. **Non-superadmin cannot access** - Regular user tries `claude-bridge` workspace → 401
2. **Superadmin can access** - Lars selects `claude-bridge` → sees Bridge files
3. **Superadmin has all tools** - Bash, Task, WebSearch available
4. **Files owned by root** - Created files have root:root ownership
5. **No privilege drop** - Verify process runs as root (check logs)

## Rollback

If issues arise:
1. Remove `claude-bridge` domain from database
2. Revert code changes
3. Lars loses Bridge editing access but normal sites unaffected
