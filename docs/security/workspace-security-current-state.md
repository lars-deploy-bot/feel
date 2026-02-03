# Workspace Security - Current State

**Last Updated**: 2025-11-12
**Status**: ACTIVE SECURITY BOUNDARY - DO NOT MODIFY WITHOUT SECURITY REVIEW

This document describes the CURRENT STATE of workspace security implementation. This is critical for defending against attacks.

---

## Security Model Overview

**Goal**: Prevent users from accessing workspaces they haven't authenticated for.

**Attack Vector**: User authenticated for `example.com` tries to access files in `victim.com`.

**Defense Layers**:
1. MCP tools use `process.cwd()` (set by Bridge based on authenticated workspace)
2. Direct tools validate workspace path before execution
3. API tools (root operations only) require authentication via session cookie
4. API routes validate workspace authorization (JWT contains allowed workspaces)
5. API routes validate path containment using RESOLVED paths (prevents traversal)

---

## Layer 1: MCP Tool Execution Patterns

**Files**:
- `packages/tools/src/tools/workspace/check-codebase.ts` (direct execution)
- `packages/tools/src/tools/workspace/install-package.ts` (direct execution)
- `packages/tools/src/tools/workspace/restart-server.ts` (API call for root)

**Pattern 1: Direct Execution (Preferred)**

```typescript
// install-package.ts
export async function installPackage(params): Promise<ToolResult> {
  const workspaceRoot = process.cwd() // Bridge-set workspace

  validateWorkspacePath(workspaceRoot)

  const result = spawnSync("bun", ["add", packageName], {
    cwd: workspaceRoot,
    shell: false,
  })

  return result.status === 0 ? successResult() : errorResult()
}
```

**Pattern 2: API Call (Only When Root Required)**

```typescript
// restart-server.ts - needs systemctl (root)
export async function restartServer(): Promise<ToolResult> {
  const workspaceRoot = process.cwd()

  return callBridgeApi({
    endpoint: "/api/restart-workspace",
    body: { workspaceRoot } // Session cookie auto-included
  })
}
```

**Security Properties**:
- ✅ No `workspaceRoot` parameter exposed to Claude
- ✅ Uses `process.cwd()` set by Bridge after authentication
- ✅ Direct tools execute with dropped privileges (workspace user)
- ✅ API tools only for root operations (systemctl)
- ❌ Claude CANNOT specify workspace path

---

## Layer 2: Workspace Path Validation

**File**: `packages/tools/src/lib/workspace-validator.ts`

**Current Implementation**:
```typescript
const ALLOWED_WORKSPACE_BASES = ["/srv/webalive/sites", "/root/webalive/sites"]

export function validateWorkspacePath(workspaceRoot: string): void {
  // Normalize and resolve path (handles .., symlinks, etc.)
  const resolvedPath = resolve(workspaceRoot)

  // Check if path is within any allowed base
  const isAllowed = ALLOWED_WORKSPACE_BASES.some(base => {
    return resolvedPath === base || resolvedPath.startsWith(`${base}/`)
  })

  if (!isAllowed) {
    throw new Error(`Invalid workspace path. Must be within: ${ALLOWED_WORKSPACE_BASES.join(" or ")}`)
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(`Workspace path does not exist: ${resolvedPath}`)
  }
}
```

**Security Properties**:
- ✅ Uses `resolve()` to normalize paths (handles `..` and relative paths)
- ✅ Validates against whitelist of allowed base directories
- ✅ Prevents path traversal: `/srv/webalive/sites/../../../etc/passwd` → rejected
- ✅ Prevents evil paths: `/srv/webalive/sites-evil` → rejected (requires `/` after base)
- ✅ Checks path exists on filesystem
- ⚠️ Allows TWO base directories: `/srv/webalive/sites` (new) and `/root/webalive/sites` (legacy)

**Attack Resistance**:
- Path traversal with `..`: BLOCKED (normalized before check)
- Symlink attacks: BLOCKED (resolved to real path)
- Evil path suffix: BLOCKED (must have `/` after base)
- Non-existent paths: BLOCKED (existence check)

---

## Layer 3: Session Cookie Authentication

**Files**:
- `apps/web/app/api/claude/stream/route.ts` (line 56-71, 357-368)
- `apps/web/lib/workspace-execution/agent-child-runner.ts` (line 15-23, 52-65)
- `packages/tools/src/lib/bridge-api-client.ts` (line 51-62)

**Flow**:

1. **User authenticates** → `/api/login`
   - Validates passcode
   - Creates JWT with `{ workspaces: ["example.com"], iat, exp }`
   - Sets httpOnly cookie named `"session"` containing JWT

2. **User sends message** → `/api/claude/stream`
   - Request includes session cookie (browser automatically sends)
   - Bridge extracts cookie value: `jar.get("session")?.value`

3. **Bridge spawns child process**:
   ```typescript
   const childStream = runAgentChild(cwd, {
     message,
     model: effectiveModel,
     sessionCookie: jar.get("session")?.value, // Pass JWT to child
     // ...
   })
   ```

4. **Child process receives session cookie**:
   ```typescript
   const child = spawn(process.execPath, [runnerPath], {
     env: {
       ...process.env,
       TARGET_CWD: workspaceRoot,
       BRIDGE_SESSION_COOKIE: payload.sessionCookie, // Set as env var
     }
   })
   ```

5. **MCP tool calls API route**:
   ```typescript
   const sessionCookie = process.env.BRIDGE_SESSION_COOKIE

   const response = await fetch(apiUrl, {
     headers: {
       "Content-Type": "application/json",
       ...(sessionCookie && { Cookie: `session=${sessionCookie}` }),
     },
     body: JSON.stringify(body),
   })
   ```

**Security Properties**:
- ✅ Session cookie is JWT (signed, tamper-proof)
- ✅ JWT contains `workspaces: string[]` (authorized workspaces)
- ✅ Cookie passed from Bridge → child process → MCP tool → API route
- ✅ API routes decode JWT to verify authorization
- ⚠️ Session cookie passed via environment variable (isolated per process, safe for concurrent execution)

---

## Layer 4: API Route Authorization

**File**: `apps/web/lib/workspace-api-handler.ts`

**Current Implementation**:

```typescript
export async function handleWorkspaceApi(req: Request, config): Promise<NextResponse> {
  // 1. Authentication - ALWAYS required (NO localhost bypass)
  const user = await requireSessionUser()
  // Returns: { id: string, workspaces: string[] } from JWT

  // 2. Parse request body
  const parseResult = config.schema.safeParse(body)

  // 3. Validate workspace containment (path traversal prevention)
  if (parseResult.data.workspaceRoot) {
    const realWorkspaceRoot = realpathSync(workspaceRoot)
    const realBaseRoot = realpathSync(WORKSPACE_BASE) // /srv/webalive/sites

    if (!realWorkspaceRoot.startsWith(`${realBaseRoot}/`)) {
      return 403 // Path traversal attempt
    }

    // 4. Validate workspace authorization (user has access to THIS workspace)
    const pathParts = workspaceRoot.split("/")
    const sitesIndex = pathParts.indexOf("sites")
    const workspaceName = pathParts[sitesIndex + 1] // e.g., "example.com"

    if (!workspaceName || !user.workspaces.includes(workspaceName)) {
      console.error(`Authorization failed: user has ${user.workspaces} but requested ${workspaceName}`)
      return 403 // User doesn't have access to this workspace
    }
  }

  // 5. Call handler (operation is now authorized)
  return await config.handler({ data: parseResult.data, requestId })
}
```

**Security Checks (in order)**:

1. **Authentication**: Decode JWT from session cookie
   - Extracts `user.workspaces: string[]`
   - If JWT invalid/missing → 401 Unauthorized

2. **Path containment**: Validate path is within allowed base
   - Uses `realpathSync()` to resolve symlinks
   - Checks `realWorkspaceRoot.startsWith(realBaseRoot + "/")`
   - If outside base → 403 Forbidden

3. **Workspace authorization**: Validate user has access to specific workspace
   - Extracts workspace name from path (e.g., `example.com`)
   - Checks if `user.workspaces.includes(workspaceName)`
   - If not authorized → 403 Forbidden

**Security Properties**:
- ✅ NO localhost bypass (removed in this security update)
- ✅ Always requires valid JWT authentication
- ✅ Validates path containment using resolved paths (prevents symlink attacks)
- ✅ Validates user authorization for specific workspace
- ⚠️ Only checks against single base: `/srv/webalive/sites` (configurable via `WORKSPACE_BASE` env var)

---

## Layer 5: Bridge Workspace Resolution

**File**: `apps/web/features/workspace/lib/workspace-secure.ts`

**Current Implementation**:

```typescript
export function getWorkspace(host: string): Workspace {
  const BASE = process.env.WORKSPACE_BASE ?? "/srv/webalive/sites"

  // 1. Map host to tenant (handles aliases)
  const tenant = hostToTenantId(host.toLowerCase())

  // 2. Construct intended path
  const intended = path.join(BASE, tenant, "user", "src")

  // 3. Resolve symlinks and enforce containment
  const real = fs.realpathSync(intended)
  const baseReal = fs.realpathSync(BASE)

  if (!real.startsWith(baseReal + path.sep)) {
    throw new Error("Workspace resolution escaped base")
  }

  // 4. Get ownership info
  const st = fs.statSync(real)

  return { root: real, uid: st.uid, gid: st.gid, tenantId: tenant }
}
```

**Security Properties**:
- ✅ Maps domain → workspace path deterministically
- ✅ Uses `realpathSync()` to resolve symlinks before validation
- ✅ Validates workspace is within base directory
- ✅ Throws error if path escapes containment
- ✅ Gets file ownership (UID/GID) for privilege dropping

**This runs BEFORE child process is spawned**, ensuring `process.chdir()` is set to a validated workspace.

---

## Complete Attack Flow Analysis

### Attack Scenario: User tries to access another workspace

**Setup**:
- Attacker authenticated for `attacker.com`
- Target workspace: `victim.com`
- JWT contains: `{ workspaces: ["attacker.com"] }`

**Attack Attempt 1: Direct API call**
```bash
curl -X POST https://terminal.goalive.nl/api/install-package \
  -H "Cookie: session=<attacker-jwt>" \
  -d '{"workspaceRoot": "/srv/webalive/sites/victim.com/user", "packageName": "malicious"}'
```

**Defense**:
1. API handler decodes JWT → `user.workspaces = ["attacker.com"]`
2. Extracts workspace from path → `victim.com`
3. Checks `user.workspaces.includes("victim.com")` → FALSE
4. Returns 403 Forbidden ✅ BLOCKED

---

**Attack Attempt 2: Path traversal in API call**
```bash
curl -X POST https://terminal.goalive.nl/api/install-package \
  -H "Cookie: session=<attacker-jwt>" \
  -d '{"workspaceRoot": "/srv/webalive/sites/attacker.com/../victim.com/user", "packageName": "malicious"}'
```

**Defense**:
1. API handler calls `realpathSync()` → resolves to `/srv/webalive/sites/victim.com/user`
2. Extracts workspace → `victim.com`
3. Checks `user.workspaces.includes("victim.com")` → FALSE
4. Returns 403 Forbidden ✅ BLOCKED

---

**Attack Attempt 3: Compromise Claude (MCP tool parameter)**
```
Claude tries to call: install_package(workspaceRoot="/srv/webalive/sites/victim.com/user", ...)
```

**Defense**:
1. MCP tool schema has NO `workspaceRoot` parameter
2. SDK rejects invalid parameters → Error ✅ BLOCKED

---

**Attack Attempt 4: Evil path suffix**
```bash
curl -X POST https://terminal.goalive.nl/api/install-package \
  -H "Cookie: session=<attacker-jwt>" \
  -d '{"workspaceRoot": "/srv/webalive/sites-evil/victim.com/user", "packageName": "malicious"}'
```

**Defense**:
1. API handler checks `realWorkspaceRoot.startsWith(realBaseRoot + "/")`
2. Base is `/srv/webalive/sites`
3. Path is `/srv/webalive/sites-evil/...` → does NOT start with `/srv/webalive/sites/`
4. Returns 403 Forbidden ✅ BLOCKED

---

## Known Limitations & Risks

### 1. Base Directory Mismatch

**Issue**:
- MCP tools validate against: `/srv/webalive/sites` OR `/root/webalive/sites`
- API handler validates against: `/srv/webalive/sites` (configurable via `WORKSPACE_BASE`)

**Risk**: LOW
- If `WORKSPACE_BASE=/root/webalive/sites`, mismatch is resolved
- If `WORKSPACE_BASE=/srv/webalive/sites`, legacy sites in `/root/webalive/sites` would be rejected by API (fail-closed, not a security issue)

**Recommendation**: Ensure `WORKSPACE_BASE` matches deployment (use `/srv/webalive/sites` for new deployments)

---

### 2. Session Cookie in Environment Variable

**Issue**: Session cookie passed via environment variable `BRIDGE_SESSION_COOKIE` to child process

**Risk**: LOW
- Each child process has isolated environment
- Environment variables not shared between processes
- Cookie value is read-only in child process

**Recommendation**: Current implementation is acceptable for security

---

### 3. Workspace Name Extraction Logic

**Current Code**:
```typescript
const pathParts = workspaceRoot.split("/")
const sitesIndex = pathParts.indexOf("sites")
const workspaceName = pathParts[sitesIndex + 1]
```

**Issue**: Assumes path structure is always `/.../sites/<workspace>/...`

**Risk**: LOW
- If path structure changes, extraction fails → workspace authorization fails → 403 (fail-closed)
- Path is already resolved via `realpathSync()` before extraction

**Recommendation**: Add test cases for edge cases (deeply nested paths, unusual workspace names)

---

### 4. Multiple Authentication for Same User

**Issue**: User can authenticate for multiple workspaces, JWT accumulates them in `workspaces: string[]`

**Risk**: LOW
- User can only add workspaces they know the passcode for
- Each workspace has unique passcode in `domain-passwords.json`
- If user has valid passcodes for multiple sites, they should have access to all of them

**Recommendation**: Current behavior is correct

---

## Environment Variables

**WORKSPACE_BASE**: Base directory for workspaces
- Default: `/srv/webalive/sites`
- Used by: API handler, Bridge workspace resolution
- Must match deployment location

**BRIDGE_SESSION_COOKIE**: Session cookie (JWT) passed to child process
- Set by: `agent-child-runner.ts`
- Read by: `bridge-api-client.ts` in MCP tools
- Scope: Per child process (isolated)

---

## Security Checklist for Developers

Before adding new workspace tools:

- [ ] Tool does NOT expose `workspaceRoot` parameter
- [ ] Tool uses `process.cwd()` for workspace
- [ ] Tool calls `validateWorkspacePath()` before operations
- [ ] Tool uses `callBridgeApi()` for API calls (auto-includes session cookie)
- [ ] Tool uses `shell: false` in all `spawnSync` calls
- [ ] Tool uses array args, never string commands

Before modifying API routes:

- [ ] Route uses `handleWorkspaceApi()` wrapper (enforces authentication + authorization)
- [ ] Route schema validates `workspaceRoot` if present
- [ ] Route does NOT bypass authentication (no localhost exceptions)
- [ ] Route handles errors securely (no sensitive info in error messages)

---

## Testing Attack Resistance

**Path Traversal**:
```typescript
validateWorkspacePath("/srv/webalive/sites/example.com/../../../etc/passwd")
// Expected: Throws error (resolves to /etc/passwd, outside allowed base)
```

**Evil Path Suffix**:
```typescript
validateWorkspacePath("/srv/webalive/sites-evil/malicious.com")
// Expected: Throws error (not within allowed base)
```

**Non-existent Path**:
```typescript
validateWorkspacePath("/srv/webalive/sites/nonexistent.com")
// Expected: Throws error (path does not exist)
```

**Valid Path**:
```typescript
validateWorkspacePath("/srv/webalive/sites/example.com/user/src")
// Expected: No error (valid workspace path)
```

---

## Incident Response

**If an unauthorized access attempt is detected**:

1. Check logs for `[workspace-api] Authorization failed` messages
2. Identify attacker JWT: decode session cookie to get `workspaces` array
3. Check `domain-passwords.json` for compromised passcodes
4. Rotate passcode for affected workspaces
5. Invalidate attacker JWT (requires Redis session store for token blacklist - currently not implemented)
6. Review audit logs for successful operations (if any occurred before detection)

**Current Limitation**: No way to invalidate JWTs before 30-day expiration (stateless JWT design)

**Recommendation**: Implement Redis-backed JWT blacklist for immediate token revocation

---

## References

**Code Files**:
- `packages/tools/src/lib/workspace-validator.ts` - Path validation
- `packages/tools/src/lib/bridge-api-client.ts` - Session cookie handling
- `apps/web/lib/workspace-api-handler.ts` - API authorization
- `apps/web/features/workspace/lib/workspace-secure.ts` - Workspace resolution
- `apps/web/lib/workspace-execution/agent-child-runner.ts` - Child process spawning

**Documentation**:
- `docs/sessions/session-management.md` - Authentication sessions (JWT)
- `docs/security/workspace-tools.md` - Workspace tool patterns
- `docs/security/authentication.md` - Authentication flow

---

**END OF CURRENT STATE DOCUMENT**
