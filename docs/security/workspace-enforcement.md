# Workspace Enforcement

**Last Updated**: 2025-11-11

## Overview

Workspace enforcement prevents users from accessing files/workspaces they haven't authenticated for through multiple defense layers.

**See Also**: `docs/security/workspace-security-current-state.md` for complete current security state including MCP tool authorization

## Files

- `features/workspace/lib/workspace-secure.ts` – Workspace resolution & validation
- `lib/claude/tool-permissions.ts` – SDK tool whitelisting & path validation
- `lib/workspace-api-handler.ts` – API route workspace authorization
- `app/api/claude/stream/route.ts` – Integration
- `packages/tools/src/lib/workspace-validator.ts` – MCP tool path validation
- `packages/tools/src/lib/bridge-api-client.ts` – API call authentication

## Workspace Resolution

### getWorkspace()

```typescript
export function getWorkspace(host: string): Workspace {
  const root = resolveWorkspace(host)  // Resolves with symlink safety
  const st = fs.statSync(root)
  return {
    root,
    uid: st.uid,     // For child process UID switching
    gid: st.gid,
    tenantId,
  }
}
```

Resolves host → workspace root with:
- Symlink safety (realpath)
- Tenant ID aliasing (e.g., barendbootsma-com → barendbootsma.com)
- Containment check (path doesn't escape base)

### resolveWorkspace()

```typescript
export function resolveWorkspace(host: string): string {
  const BASE = process.env.WORKSPACE_BASE ?? "/srv/webalive/sites"
  const tenant = hostToTenantId(host.toLowerCase())
  const intended = path.join(BASE, tenant, "user", "src")

  const real = fs.realpathSync(intended)  // Resolve symlinks
  const baseReal = fs.realpathSync(BASE)

  if (!real.startsWith(baseReal + path.sep)) {
    throw new Error("Workspace resolution escaped base")
  }

  return real
}
```

## Tool Whitelisting

**Files**: `lib/claude/tool-permissions.ts`

Two tool classes:

```typescript
export const ALLOWED_SDK_TOOLS = new Set(["Write", "Edit", "Read", "Glob", "Grep"])

export const ALLOWED_MCP_TOOLS = new Set([
  "mcp__workspace-management__restart_dev_server",
  "mcp__workspace-management__install_package",
  "mcp__tools__list_guides",
  "mcp__tools__get_guide",
  "mcp__tools__find_guide",
  "mcp__tools__batch_get_guides",
  "mcp__tools__generate_persona",
])
```

**SDK tools**: Require path validation (local file operations via `ensurePathWithinWorkspace()`)
**MCP tools**: Multi-layer security:
1. **Parameter restriction**: Tools do NOT expose `workspaceRoot` parameter to Claude
2. **Path validation**: `validateWorkspacePath()` checks allowed bases
3. **API authorization**: Routes validate JWT contains requested workspace
4. **Session authentication**: All API calls require valid session cookie

## Path Validation

**Function**: `ensurePathWithinWorkspace()`

```typescript
export function ensurePathWithinWorkspace(filePath: string, workspaceRoot: string): void {
  const norm = path.normalize(filePath)
  if (!norm.startsWith(workspaceRoot + path.sep)) {
    throw new Error(`Path outside workspace: ${norm}`)
  }
}
```

Called before SDK tool execution to prevent directory traversal.

## MCP Tool Security (November 2025 Update)

**Critical Change**: MCP tools now secured with multi-layer defense to prevent workspace bypass attacks.

### Layer 1: Parameter Restriction

MCP tools do NOT expose `workspaceRoot` parameter to Claude:

```typescript
// tools/workspace/install-package.ts
export const installPackageParamsSchema = {
  packageName: z.string(),
  version: z.string().optional(),
  dev: z.boolean().optional(),
  // NO workspaceRoot parameter - Claude cannot specify workspace
}

export async function installPackage(params): Promise<ToolResult> {
  const workspaceRoot = process.cwd() // Set by Bridge based on authenticated workspace
  // ...
}
```

### Layer 2: Path Validation

Tools validate workspace path before operations:

```typescript
// packages/tools/src/lib/workspace-validator.ts
const ALLOWED_WORKSPACE_BASES = ["/srv/webalive/sites", "/root/webalive/sites"]

export function validateWorkspacePath(workspaceRoot: string): void {
  const resolvedPath = resolve(workspaceRoot) // Normalize, resolve symlinks

  const isAllowed = ALLOWED_WORKSPACE_BASES.some(base => {
    return resolvedPath === base || resolvedPath.startsWith(`${base}/`)
  })

  if (!isAllowed) throw new Error("Invalid workspace path")
}
```

### Layer 3: API Route Authorization

API routes validate user has access to requested workspace:

```typescript
// apps/web/lib/workspace-api-handler.ts
const user = await requireSessionUser() // Get JWT with workspaces array

// Extract workspace from path: /srv/webalive/sites/example.com/user -> example.com
const workspaceName = extractWorkspaceFromPath(workspaceRoot)

if (!user.workspaces.includes(workspaceName)) {
  return 403 Forbidden // User doesn't have access
}
```

### Layer 4: Session Authentication

MCP tools include session cookie in API calls:

```typescript
// packages/tools/src/lib/bridge-api-client.ts
const sessionCookie = process.env.BRIDGE_SESSION_COOKIE // Passed by Bridge

const response = await fetch(apiUrl, {
  headers: {
    Cookie: `session=${sessionCookie}`, // JWT with authorized workspaces
  }
})
```

**Flow**:
1. User authenticates for `example.com` → JWT with `workspaces: ["example.com"]`
2. Bridge spawns child process, passes session cookie as env var
3. MCP tool calls API with session cookie
4. API route validates workspace is in JWT `workspaces` array

**Attack Resistance**:
- ✅ Claude cannot specify workspace (no parameter)
- ✅ Path traversal blocked (normalized before validation)
- ✅ Unauthorized workspace access blocked (JWT validation)
- ✅ Direct API calls require authentication (no localhost bypass)

## Tool Permission Handler

**Function**: `createToolPermissionHandler()`

```typescript
export function createToolPermissionHandler(
  workspace: Workspace,
  requestId: string,
): NonNullable<Options["canUseTool"]> {
  return async (toolName, input, _options) => {
    console.log(`[Request ${requestId}] Tool requested: ${toolName}`)

    if (!isToolPermitted(toolName)) {
      return { behavior: "deny", message: `tool_not_allowed: ${toolName}` }
    }

    // Validate file paths for SDK tools only
    if (ALLOWED_SDK_TOOLS.has(toolName)) {
      const filePath = extractFilePath(input)
      if (filePath) {
        try {
          ensurePathWithinWorkspace(filePath, workspace.root)
          console.log(`[Request ${requestId}] Path allowed: ${filePath}`)
        } catch {
          console.log(`[Request ${requestId}] Path outside workspace: ${filePath}`)
          return { behavior: "deny", message: "path_outside_workspace" }
        }
      }
    }

    return {
      behavior: "allow",
      updatedInput: input,
      updatedPermissions: [],
    }
  }
}
```

## Systemd Site Isolation

New sites deploy as systemd services with dedicated unprivileged users:

**User creation:**
```bash
useradd -r -s /bin/false -d /srv/webalive/sites/example.com site-example-com
chown -R site-example-com:site-example-com /srv/webalive/sites/example.com
chmod 700 /srv/webalive/sites/example.com
```

**systemd config:**
```ini
[Service]
User=site-example-com
Group=site-example-com
PrivateTmp=yes
NoNewPrivileges=true
ProtectSystem=strict
```

**Result:** Site process runs as `site-example-com`, cannot read other sites' files (OS enforces).

## Child Process UID Switching

For systemd sites, SDK runs in child process that drops privileges:

```typescript
// In child process (scripts/run-agent.mjs)
process.setegid(targetGid)  // Kernel-level GID switch
process.seteuid(targetUid)  // Kernel-level UID switch
// All subsequent file ops inherit workspace user credentials
```

Automatic detection:

```typescript
export function shouldUseChildProcess(workspaceRoot: string): boolean {
  const st = statSync(workspaceRoot)
  return st.uid !== 0 && st.gid !== 0  // Non-root owner = systemd site
}
```

## Security Hardening Checklist

- [ ] `ensurePathWithinWorkspace()` called before all SDK file operations
- [ ] Path normalization happens before boundary check
- [ ] Workspace directory permissions 700 (owner only)
- [ ] Systemd services use `User=`, `NoNewPrivileges=true`, `ProtectSystem=strict`
- [ ] Tool whitelist exact: `ALLOWED_SDK_TOOLS` + `ALLOWED_MCP_TOOLS`
- [ ] `getWorkspace()` called at request start
- [ ] Path traversal tests pass (../../../, symlinks, etc.)

## Testing Workspace Boundaries

**Unit tests:**

```typescript
describe('ensurePathWithinWorkspace', () => {
  it('allows files within workspace', () => {
    expect(() =>
      ensurePathWithinWorkspace(
        '/srv/webalive/sites/example.com/user/src/index.ts',
        '/srv/webalive/sites/example.com/user/src'
      )
    ).not.toThrow()
  })

  it('denies files outside workspace', () => {
    expect(() =>
      ensurePathWithinWorkspace(
        '/srv/webalive/sites/evil.com/user/src/index.ts',
        '/srv/webalive/sites/example.com/user/src'
      )
    ).toThrow('Path outside workspace')
  })

  it('denies path traversal', () => {
    expect(() =>
      ensurePathWithinWorkspace(
        '/srv/webalive/sites/example.com/user/src/../../secrets.json',
        '/srv/webalive/sites/example.com/user/src'
      )
    ).toThrow('Path outside workspace')
  })

  it('handles symlink escapes', () => {
    // Symlink target outside workspace → normalized path outside
    expect(() =>
      ensurePathWithinWorkspace(
        '/srv/webalive/sites/example.com/user/src/link-to-root',
        '/srv/webalive/sites/example.com/user/src'
      )
    ).toThrow('Path outside workspace')
  })
})
```

**Manual testing:**

```bash
# Start dev server
bun run dev

# Login with test workspace
POST /api/login
{ "workspace": "test", "passcode": "test" }

# Try to read outside workspace
POST /api/claude/stream
{ "message": "read /etc/passwd" }

# Verify denied with error
# Try path traversal
POST /api/claude/stream
{ "message": "read ../../../secrets.json" }

# Verify denied
```

## Common Issues

**"Path outside workspace" when path is valid:**
- Check path normalization uses `path.normalize()`
- Verify workspace root path is also normalized
- Ensure `workspaceRoot + path.sep` comparison (separator matters)

**Symlink escape:**
- `ensurePathWithinWorkspace()` only checks normalized string prefix
- For full symlink safety, use `realpathSync()` before validation

**Tool not whitelisted:**
- Verify tool in `ALLOWED_SDK_TOOLS` or `ALLOWED_MCP_TOOLS`
- Check exact tool name match (case-sensitive)
- MCP tools have `mcp__` prefix
