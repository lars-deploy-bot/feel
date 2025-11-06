# Workspace Enforcement

## Files

- `features/workspace/lib/workspace-secure.ts` – Workspace resolution & validation
- `lib/claude/tool-permissions.ts` – Tool whitelisting & path validation
- `app/api/claude/stream/route.ts` – Integration

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

**SDK tools**: Require path validation (local file operations)
**MCP tools**: No path validation (handled by child process context)

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
