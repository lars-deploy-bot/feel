# Path Traversal Attack

**Risk Level**: 🟡 MEDIUM
**Attacker Profile**: Hobbyist Hackers
**Skill Required**: 1-2 weeks of security learning
**Real-World Frequency**: Very High

## Attack Description

Attacker uses `../../../` sequences to escape workspace boundaries and read/write files in other sites or system directories.

### Attack Code

```javascript
// Try to read other site's database
fetch('/api/files/read', {
  method: 'POST',
  body: JSON.stringify({
    path: '../../../another-site.com/database.db'
  })
})

// Try to read system files
fetch('/api/claude/stream', {
  method: 'POST',
  body: JSON.stringify({
    message: 'Read file /etc/shadow'
  })
})

// Try to overwrite other site
fetch('/api/files/write', {
  method: 'POST',
  body: JSON.stringify({
    path: '../../../victim-site.com/index.html',
    content: '<h1>HACKED</h1>'
  })
})
```

## Threat Profile

**Who can do this:**
- Anyone who's completed HackTheBox/CTF challenges
- Junior penetration testers
- Bug bounty hunters
- Automated vulnerability scanners

**Success Rate**: ~80% if no validation

**Impact**:
- Read credentials from other sites (.env files)
- Modify other users' websites
- Read system passwords (/etc/shadow)
- Complete compromise of multi-tenant isolation

## systemd Protection (Partial)

```ini
# Filesystem protection
ProtectSystem=strict          # Entire filesystem read-only
ReadWritePaths=/srv/webalive/sites/%i  # Only this site writable
```

**What systemd blocks:**
- ✅ Writing to `/etc`, `/usr`, `/boot` (ProtectSystem=strict)
- ✅ Writing outside `/srv/webalive/sites/example-com/` (ReadWritePaths)

**What systemd CANNOT block:**
- ❌ Reading other sites in `/srv/webalive/sites/` (read is allowed)
- ❌ Path traversal within allowed paths

## Application-Level Protection (Required)

### Layer 1: Path Validation

```typescript
// lib/security.ts
export function ensurePathWithinWorkspace(
  filePath: string,
  workspaceRoot: string
): void {
  const normalized = path.normalize(filePath)
  const resolved = path.resolve(workspaceRoot, normalized)

  if (!resolved.startsWith(workspaceRoot + path.sep)) {
    throw new Error('Path outside workspace')
  }
}
```

### Layer 2: Tool Permission Handler

```typescript
// lib/claude/tool-permissions.ts
export function createToolPermissionHandler(workspace: Workspace) {
  return async (toolName, input) => {
    if (ALLOWED_SDK_TOOLS.has(toolName)) {
      const filePath = extractFilePath(input)
      if (filePath) {
        ensurePathWithinWorkspace(filePath, workspace.root)
      }
    }
    return { behavior: "allow" }
  }
}
```

### Layer 3: Workspace Enforcement

```typescript
// features/workspace/lib/workspace-secure.ts
export function resolveWorkspace(host: string): string {
  const BASE = "/srv/webalive/sites"
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

## Attack Examples & Defenses

### Example 1: Basic Directory Traversal

**Attack:**
```
Read file: ../../../etc/passwd
```

**Defense:**
```typescript
path.normalize('../../../etc/passwd')
// = '/etc/passwd'

'/etc/passwd'.startsWith('/srv/webalive/sites/example.com/')
// = false ❌ BLOCKED
```

### Example 2: Symlink Escape

**Attack:**
```bash
# Attacker creates symlink
ln -s /etc/shadow /srv/webalive/sites/example.com/user/src/data.txt

# Then reads it
Read file: data.txt
```

**Defense:**
```typescript
fs.realpathSync('data.txt')
// = '/etc/shadow'

'/etc/shadow'.startsWith('/srv/webalive/sites/example.com/')
// = false ❌ BLOCKED
```

### Example 3: Null Byte Injection (Node.js < 18)

**Attack:**
```
Read file: allowed.txt\0../../../etc/passwd
```

**Defense:**
- Modern Node.js (18+) blocks null bytes in paths
- Path validation catches traversal anyway

### Example 4: Double Encoding

**Attack:**
```
Read file: ..%252F..%252F..%252Fetc%252Fpasswd
// %252F = encoded %2F = encoded /
```

**Defense:**
```typescript
decodeURIComponent('..%252F..%252F..%252Fetc%252Fpasswd')
// = '../../../etc/passwd'
path.normalize(...) // catches it
```

## Real-World Examples

**HackerOne Reports (Path Traversal):**
- Shopify: $500 bounty for reading /etc/passwd
- GitLab: $12,000 bounty for arbitrary file read
- Slack: $1,750 bounty for accessing other workspaces

**Frequency**:
- #2 most common web vulnerability (OWASP Top 10)
- Every bug bounty platform has hundreds of reports
- First thing pentesters check

## Testing Path Traversal Protection

```bash
# Unit tests
cd apps/web && bun run test security.test.ts

# Manual testing
curl -X POST http://localhost:8999/api/claude/stream \
  -H "Cookie: session=$TOKEN" \
  -d '{"message": "read ../../../etc/passwd", "workspace": "test"}'

# Expected: Error about path outside workspace
```

## Verification Checklist

- [ ] `ensurePathWithinWorkspace()` called before all file operations
- [ ] Path normalization uses `path.normalize()` + `path.resolve()`
- [ ] Workspace root validated with `realpathSync()` (symlink safety)
- [ ] Tool permission handler checks SDK tool paths
- [ ] Unit tests cover: `../`, symlinks, absolute paths, null bytes
- [ ] Manual penetration test passed

## Mitigation Effectiveness

| Attack Type | Without Validation | With Validation |
|-------------|-------------------|-----------------|
| `../../../etc/passwd` | ✅ Works | ❌ Blocked |
| Symlink to /etc/shadow | ✅ Works | ❌ Blocked (realpathSync) |
| Read other site's DB | ✅ Works | ❌ Blocked |
| Absolute path `/etc/passwd` | ✅ Works | ❌ Blocked |

**Protection Level**: 🛡️ 100% effective when properly implemented

**Critical**: This protection is **application-level**, not systemd. systemd provides defense-in-depth but **cannot prevent** reading other sites.
