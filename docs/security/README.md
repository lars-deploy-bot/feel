# Security

Authentication, workspace isolation, and security patterns.

## Overview

Claude Bridge implements multi-layered security:
- **Authentication** - JWT-based workspace sessions
- **Workspace isolation** - File system boundaries + systemd users
- **Tool whitelisting** - Explicit SDK/MCP tool permissions
- **Path validation** - Directory traversal prevention
- **systemd hardening** - Process isolation and security flags

## Core Security Concepts

| Topic | Description |
|-------|-------------|
| [Authentication](./authentication.md) | JWT sessions, workspace auth, login flow |
| [Workspace Enforcement](./workspace-enforcement.md) | Tool whitelisting, path validation, MCP security |
| [systemd Hardening](./systemd-hardening.md) | Process isolation, security flags, resource limits |

## Security Layers

### Layer 1: Authentication

User authenticates for specific workspace → JWT with workspace list:

```typescript
// JWT payload
{
  workspaces: ["example.com", "demo.site.com"],
  iat: 1234567890,
  exp: 1237159890  // 30 days
}
```

**Files:** `features/auth/lib/jwt.ts`, `features/auth/lib/auth.ts`

### Layer 2: Workspace Resolution

Request validated against JWT workspace list:

```typescript
const isAuth = await isWorkspaceAuthenticated(workspace)
if (!isAuth) return Response.json({ error: 'Unauthorized' }, { status: 401 })
```

### Layer 3: Tool Whitelisting

Only approved tools allowed:

```typescript
const ALLOWED_SDK_TOOLS = new Set(["Write", "Edit", "Read", "Glob", "Grep"])
const ALLOWED_MCP_TOOLS = new Set([...])  // See workspace-enforcement.md
```

### Layer 4: Path Validation

Every file operation validated:

```typescript
ensurePathWithinWorkspace(filePath, workspace.root)
// Throws if path escapes workspace
```

### Layer 5: OS Enforcement

systemd runs each site as dedicated user:

```bash
# site-example-com user cannot read site-demo-com files
# OS kernel enforces isolation
```

## Quick Reference

### Protected Route Pattern

```typescript
import { isWorkspaceAuthenticated } from '@/features/auth/lib/auth'

export async function POST(req: Request) {
  const { workspace } = await req.json()

  // Authenticate
  const isAuth = await isWorkspaceAuthenticated(workspace)
  if (!isAuth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate workspace path
  const workspacePath = getWorkspace(workspace).root

  // Validate file paths
  ensurePathWithinWorkspace(filePath, workspacePath)

  // Proceed with operation
}
```

### Local Development Bypass

```typescript
// BRIDGE_ENV=local bypasses authentication
if (process.env.BRIDGE_ENV === "local" && workspace === "test" && passcode === "test") {
  // Allow test user (dev mode only)
}
```

## Security Checklist

Before deploying changes:

- [ ] All protected routes use `isWorkspaceAuthenticated()`
- [ ] File operations call `ensurePathWithinWorkspace()`
- [ ] Tool whitelist exact (no wildcards)
- [ ] MCP tools don't expose `workspaceRoot` parameter
- [ ] New systemd sites use dedicated users
- [ ] systemd services have security flags (NoNewPrivileges, ProtectSystem, etc.)
- [ ] Path normalization before validation
- [ ] No hardcoded secrets in code
- [ ] Test data safety verified (see testing/README.md)

## Common Security Issues

**Path traversal not detected:**
- Missing `path.normalize()` before check
- Comparison doesn't include `path.sep`
- Symlinks not resolved

**Cross-workspace access:**
- JWT doesn't include workspace
- Workspace not validated against JWT
- OS permissions wrong (files owned by root)

**Tool whitelist bypass:**
- Tool name check case-sensitive mismatch
- MCP tool exposes workspace parameter
- Missing `canUseTool` callback

## Testing Security

### Unit Tests

```typescript
import { ensurePathWithinWorkspace } from '@/lib/security'

describe('Path validation', () => {
  it('denies path traversal', () => {
    expect(() =>
      ensurePathWithinWorkspace(
        '/srv/webalive/sites/example.com/user/../../etc/passwd',
        '/srv/webalive/sites/example.com/user'
      )
    ).toThrow('Path outside workspace')
  })
})
```

### Manual Testing

```bash
# Test path traversal
POST /api/claude/stream { "message": "read ../../../etc/passwd" }
# Should return "path_outside_workspace" error

# Test unauthorized workspace
POST /api/verify { "workspace": "other-site.com" }
# Should return 401 if not in JWT

# Test tool whitelist
# Try to use non-whitelisted tool (should be denied by SDK)
```

## See Also

- [Architecture: Workspace Isolation](../architecture/workspace-isolation.md) - Multi-tenant design
- [Testing: Security Tests](../testing/unit-testing.md#security-tests) - How to test security
- [Troubleshooting](../troubleshooting/README.md) - Common security issues
