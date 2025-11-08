# Possible Solutions: Cross-Tenant File Access Vulnerability

**Date:** November 3, 2025
**Status:** Solution Analysis & Recommendations
**Focus:** Five architectural approaches to fix multi-tenant isolation on Hetzner

---

## Executive Summary

The root cause is **architectural misalignment**: Process permissions are broader than the intended workspace boundary. Five distinct approaches can fix this, ranging from lightweight/fast to heavyweight/secure.

**Quick Decision Guide:**
- **Maximum security needed?** → Solution #1 (Containers)
- **Need fast startup times?** → Solution #4 (Deno) or #5 (Permissions)
- **Minimal infrastructure changes?** → Solution #5 (Quick Fix)
- **Best balance?** → Solution #3 (AppArmor + Validation)

---

## Core Problem Recap

```
Intended boundary:     /srv/webalive/sites/[site]/user/
Actual accessible:     /srv/webalive/sites/
                       └─ Due to 755 permissions on parent
                       └─ No runtime validation of user code
                       └─ All three security layers failed
```

---

## Solution #1: Container Isolation (Docker)

### Description

Each tenant's Vite dev server runs in a **dedicated Docker container** with:
- Isolated filesystem (only site's directory mounted)
- Isolated network (if needed)
- Resource limits (CPU, memory)
- Separate user namespace

### Implementation

```yaml
# docker-compose.yml for each site
version: '3.9'
services:
  site-a:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - /srv/webalive/sites/site-a:/app:ro  # Only this site
      - /srv/webalive/sites/site-a/node_modules:/app/node_modules
    ports:
      - "5173:5173"
    command: "bun run dev"
    user: "1000:1000"
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
```

**systemd integration:**
```ini
[Unit]
Description=Site A Dev Server
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/docker-compose up site-a
ExecStop=/usr/bin/docker-compose down

[Install]
WantedBy=multi-user.target
```

### Security Guarantee

**Isolation level:** Kernel-enforced via Linux namespaces
- Cannot see other container's filesystems
- Cannot access other sites' code
- Cannot enumerate sibling tenants
- Parent directory `/srv/webalive/sites/` is invisible

**Attack scenario:** Tenant A tries path traversal:
```bash
path.resolve('/app', '../../')
# Inside container, / is only /srv/webalive/sites/site-a
# Result: /app/.. → /app (cannot escape)
```

### Performance Overhead

- **Startup time:** +2-5 seconds (container initialization)
- **Memory:** +50-100MB per container (for alpine base)
- **CPU:** Minimal overhead, namespace operations are fast
- **Disk:** Container images ~300MB each

### Implementation Complexity

**Effort:** Medium
- Requires Docker/podman installation
- Update systemd unit files
- Update Caddy reverse proxy configuration
- Handle volume mounting for code sync
- Deal with file permissions in mounts

**Pros:**
- Battle-tested isolation (AWS, GCP, Heroku use this)
- Can easily scale horizontally
- Clear security boundary
- Straightforward to audit

**Cons:**
- Slight startup delay
- Container overhead on Hetzner
- Adds Docker dependency
- More complex deployment

---

## Solution #2: chroot/Namespace Jailing

### Description

Use **chroot + Linux user namespaces** to jail each Vite process to its workspace directory.

```bash
#!/bin/bash
# scripts/start-vite-jailed.sh

SITE=$1
WORKSPACE="/srv/webalive/sites/$SITE"
SITE_USER="site-$SITE"

# Create chroot environment (filesystem copy or bind mount)
# For performance, use bind mount to avoid duplication:
mkdir -p /var/chroot/$SITE/{app,tmp,proc,sys,dev}
mount --bind $WORKSPACE /var/chroot/$SITE/app

# Drop into chroot as site user
sudo -u $SITE_USER chroot --userspec=$SITE_USER /var/chroot/$SITE \
  bun /app/dev-server.ts
```

### How It Works

**chroot:** Changes root filesystem to `WORKSPACE/`
- Process sees `/` as actually `/var/chroot/$SITE/app`
- Parent directory `/srv/webalive/sites/` is hidden
- Cannot `cd /..` to escape

**User namespace:** Isolates UIDs
- Prevents privilege escalation
- UID 0 inside chroot ≠ root on host

### Security Guarantee

**Isolation level:** Good (filesystem boundary)
- Cannot see parent directory
- Cannot enumerate other sites
- Path traversal attempts fail (no parent)

**Attack scenario:**
```javascript
const targetDir = path.resolve(__dirname, '../../');
// Inside chroot: __dirname = /
// path.resolve('/', '../../') = /
// fs.readdirSync('/') → Only sees: app, tmp, proc, sys, dev
// Cannot access /srv/webalive/sites/other-site
```

### Performance Overhead

- **Startup time:** <500ms (no container)
- **Memory:** Negligible
- **CPU:** Minimal (chroot is just a syscall)
- **Disk:** Minimal (bind mounts use existing files)

### Implementation Complexity

**Effort:** Medium-High
- Understanding chroot/namespaces required
- Need bind mount management
- systemd integration is tricky
- Requires CAP_SYS_CHROOT capability

**Pros:**
- Lightweight (no container runtime)
- Very fast startup
- Better performance than Docker
- Proven technology

**Cons:**
- chroot has [known escape techniques](https://en.wikipedia.org/wiki/Chroot#Limitations)
- Requires root for setup
- Less well-understood than containers
- Not as portable

---

## Solution #3: seccomp + AppArmor Restrictions

### Description

Use **AppArmor** (or SELinux) to restrict which filesystem paths each process can access, regardless of UNIX permissions.

### AppArmor Profile

```apparmor
# /etc/apparmor.d/site-apps

profile site-vite flags=(attach_disconnected,mediate_deleted) {
  # Allow read/write only within site workspace
  /srv/webalive/sites/site-a/** rw,
  /srv/webalive/sites/site-a/ r,

  # Deny everything else
  deny /srv/webalive/sites/ r,
  deny /srv/webalive/sites/** r,
  deny /root/** rwx,
  deny /home/** rwx,
  deny /etc/** rwx,

  # Allow necessary system paths
  /proc/ r,
  /proc/** r,
  /sys/ r,
  /sys/** r,
  /tmp/ rw,
  /tmp/** rw,
  /dev/ r,
  /dev/null rw,
  /dev/urandom r,

  # Network (if needed)
  network inet,
  network inet6,

  # Libraries
  /usr/lib/** mr,
  /lib/** mr,
}
```

### Systemd Integration

```ini
# /etc/systemd/system/site@.service

[Service]
User=site-%i
ExecStart=/usr/bin/aa-exec -p site-vite -- /usr/bin/bun /app/dev-server.ts
```

Load profile:
```bash
sudo apparmor_parser -r /etc/apparmor.d/site-apps
systemctl restart site@site-a
```

### Security Guarantee

**Isolation level:** Syscall-level enforcement
- AppArmor intercepts filesystem syscalls
- Even if UNIX permissions allow access, AppArmor blocks it
- **Defense in depth**: Works even if permissions are wrong

**Attack scenario:**
```javascript
path.resolve(__dirname, '../../');  // = /srv/webalive/sites/
fs.readdirSync('/srv/webalive/sites/');
// AppArmor blocks: DENIED /srv/webalive/sites/ r
// fs.readdirSync() throws: Permission denied
```

### Performance Overhead

- **Startup time:** None (no container, no chroot)
- **Memory:** ~10MB per profile
- **CPU:** <1% overhead for syscall checking
- **Disk:** Profile files ~5KB each

### Implementation Complexity

**Effort:** Low-Medium
- Write AppArmor profiles (relatively simple)
- Reload profiles (one command)
- No changes to deployment scripts
- Existing systemd units work as-is

**Pros:**
- Lightweight (no runtime overhead)
- Fast startup
- Works with existing infrastructure
- Easy to modify and audit
- Syscall-level enforcement

**Cons:**
- Not available on all Linux distros (requires AppArmor/SELinux)
- Requires kernel support
- Profiles can be complex for complex apps
- Learning curve on AppArmor syntax

---

## Solution #4: Deno-Based Dev Server

### Description

Replace Node.js **Vite** with a **Deno-based dev server** that runs with explicit filesystem permission grants.

### Concept

Deno has a sophisticated permission model:
```typescript
// Deno runtime with explicit permission grants
deno run \
  --allow-read=/srv/webalive/sites/site-a \
  --allow-write=/srv/webalive/sites/site-a \
  --allow-net=localhost:5173 \
  dev-server.ts
```

Any filesystem access outside the allowed paths → **PermissionDenied error**

### Implementation

```typescript
// dev-server.ts (Deno)
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { contentType } from "https://deno.land/std@0.208.0/media_types/mod.ts";

const SITE_ROOT = "/srv/webalive/sites/site-a";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;

  // Construct path
  let filePath = `${SITE_ROOT}/user${path}`;

  // Resolve and validate within workspace
  const resolved = await Deno.realPath(filePath);
  const siteRoot = await Deno.realPath(SITE_ROOT);

  if (!resolved.startsWith(siteRoot)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Serve file
  try {
    const file = await Deno.open(resolved);
    const { size } = await Deno.fstat(file);
    const ext = resolved.split(".").pop() || "bin";

    return new Response(file.readable, {
      headers: {
        "Content-Type": contentType(ext) || "application/octet-stream",
        "Content-Length": size.toString(),
      },
    });
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response("Server Error", { status: 500 });
  }
}

serve(handler, { hostname: "localhost", port: 5173 });
```

### systemd Service

```ini
[Service]
User=site-%i
ExecStart=/usr/bin/deno run \
  --allow-read=/srv/webalive/sites/%i \
  --allow-write=/srv/webalive/sites/%i \
  --allow-net=localhost:5173 \
  /usr/local/bin/dev-server.ts
```

### Security Guarantee

**Isolation level:** Runtime-enforced by Deno VM
- Cannot access files outside allowed paths
- Throws at runtime, cannot be bypassed
- **Defense in depth**: Even if attacker modifies code, still blocked

**Attack scenario:**
```typescript
const targetDir = path.resolve(__dirname, '../../');  // /srv/webalive/sites/
fs.readdirSync(targetDir);
// Deno: PermissionDenied: read access to "/srv/webalive/sites/"
```

### Performance Overhead

- **Startup time:** <1 second
- **Memory:** ~50MB (Deno runtime)
- **CPU:** Minimal
- **Disk:** Negligible

### Implementation Complexity

**Effort:** Medium
- Rewrite Vite dev server in Deno (or find existing one)
- Update systemd units
- Train team on Deno (if new to them)
- Handle compatibility with existing JavaScript/TypeScript

**Pros:**
- **Language-level isolation** (permission model is built-in)
- Very fast startup
- Low overhead
- Excellent for security-first design
- Clear permission model

**Cons:**
- Requires rewriting server code
- Deno ecosystem smaller than Node.js
- Team must learn Deno
- May need compatibility layer for npm modules

---

## Solution #5: Permission Fix + Runtime Validation (Quick Fix)

### Description

**Immediate, low-effort fix** combining:
1. Fix filesystem permissions (chmod)
2. Add runtime validation in Claude Bridge
3. Scan existing code for similar vulnerabilities

### Part 1: Fix Filesystem Permissions

```bash
# Immediately: Change parent directory from 755 to 700
chmod 700 /srv/webalive/sites/

# Verify individual sites are 750
find /srv/webalive/sites -maxdepth 1 -type d -exec chmod 750 {} \;

# Fix world-readable sites
chmod 750 /srv/webalive/sites/demo-goalive-nl
chmod 750 /srv/webalive/sites/staging.goalive.nl

# Verify
ls -ld /srv/webalive/sites/
```

**Impact of chmod 700:**
- Site users can still access their own directories ✓
- Site users cannot enumerate sibling tenants ✓
- Information disclosure eliminated ✓

### Part 2: Add Runtime Validation

Extend Claude Bridge to validate **user code**, not just SDK tools.

```typescript
// apps/web/lib/code-validator.ts

/**
 * Scan user code for dangerous filesystem patterns
 * Returns array of findings with locations
 */
export async function scanCodeForPathTraversal(
  filePath: string,
  workspaceRoot: string
): Promise<CodeFinding[]> {
  const content = await Deno.readTextFile(filePath);
  const findings: CodeFinding[] = [];

  // Pattern 1: __dirname with path.resolve and ../
  const pattern1 = /__dirname.*path\.resolve.*\.\./g;
  let match;
  while ((match = pattern1.exec(content)) !== null) {
    findings.push({
      type: 'PATH_TRAVERSAL',
      severity: 'high',
      line: content.substring(0, match.index).split('\n').length,
      pattern: match[0],
      message: 'Dangerous pattern: __dirname with relative path traversal'
    });
  }

  // Pattern 2: fs.readdir/readdirSync on non-workspace paths
  const pattern2 = /fs\.readdir(Sync)?\(['"`](?!.*\/user\/)/g;
  while ((match = pattern2.exec(content)) !== null) {
    findings.push({
      type: 'DANGEROUS_FS_API',
      severity: 'high',
      line: content.substring(0, match.index).split('\n').length,
      pattern: match[0],
      message: 'fs.readdir on path outside workspace'
    });
  }

  // Pattern 3: Absolute paths
  const pattern3 = /fs\.(readdir|stat|open)\(['"`]\/[^u]/g;
  while ((match = pattern3.exec(content)) !== null) {
    findings.push({
      type: 'ABSOLUTE_PATH_ACCESS',
      severity: 'high',
      line: content.substring(0, match.index).split('\n').length,
      pattern: match[0],
      message: 'Absolute path access outside workspace'
    });
  }

  return findings;
}
```

**Claude Bridge integration:**

```typescript
// apps/web/app/api/claude/stream/route.ts

const canUseTool: Options["canUseTool"] = async (toolName, input) => {
  // ... existing SDK validation ...

  // NEW: If tool is Write/Edit, scan the content
  if ((toolName === "Write" || toolName === "Edit") && input.content) {
    const findings = await scanCodeForPathTraversal(
      input.file_path,
      workspace.root
    );

    if (findings.length > 0) {
      return {
        behavior: "deny",
        message: `Code contains dangerous patterns: ${findings.map(f => f.message).join('; ')}`
      };
    }
  }

  return { behavior: "allow" };
};
```

### Part 3: Scan Existing Code

Audit all existing user code:

```bash
#!/bin/bash
# scripts/audit-code.sh

echo "Scanning for path traversal patterns..."

grep -r "path.resolve.*\.\." /srv/webalive/sites/*/user/ \
  --include="*.js" --include="*.ts"

grep -r "fs.readdir" /srv/webalive/sites/*/user/ \
  --include="*.js" --include="*.ts" | grep -v "user/"

grep -r "__dirname.*\.\." /srv/webalive/sites/*/user/ \
  --include="*.js" --include="*.ts"

echo "Done. Review findings above."
```

### Security Guarantee

**Isolation level:** Multiple layers
1. **Filesystem level** (chmod 700): Blocks at OS level
2. **Application level** (code validation): Prevents vulnerable code creation
3. **Runtime validation** (Layer 3): Already exists in Claude Bridge

**Attack scenario after fix:**
```bash
# Layer 1: Permission denied
sudo -u site-a ls /srv/webalive/sites/
# ls: cannot open directory: /srv/webalive/sites/: Permission denied

# Layer 2: Code validation prevents creation
Claude attempts to Write code with path.resolve(__dirname, '../../')
# Denied: Code contains dangerous pattern

# Layer 3: SDK tools already validate
Claude attempts to Read /srv/webalive/sites/other-site/
# Denied: Path outside workspace
```

### Performance Overhead

- **Startup time:** None
- **Memory:** None
- **CPU:** Negligible
- **Disk:** None

### Implementation Complexity

**Effort:** Low
- One chmod command for permissions
- Add ~50 lines of validation code
- Run audit script
- No infrastructure changes
- Reversible if needed

**Pros:**
- **Immediate relief** (chmod fixes within minutes)
- Low effort
- No infrastructure changes
- Easy to implement and test
- Can do immediately while planning long-term solution

**Cons:**
- **Not a complete fix** for all edge cases
- Permissions alone don't prevent all attacks
- Code validation has false positives/negatives
- Still leaves attack surface via other Node.js APIs
- Does not address architectural misalignment long-term

---

## Comparison Matrix

| Aspect | #1: Containers | #2: chroot | #3: AppArmor | #4: Deno | #5: Permissions |
|--------|---|---|---|---|---|
| **Security Level** | Excellent | Good | Excellent | Excellent | Good |
| **Startup Overhead** | +2-5s | <500ms | None | <1s | None |
| **Memory Overhead** | +50-100MB | Negligible | ~10MB | ~50MB | None |
| **CPU Overhead** | Minimal | Minimal | <1% | Minimal | None |
| **Implementation Effort** | Medium | Medium-High | Low-Medium | Medium | Low |
| **Infrastructure Changes** | Docker required | chroot/namespaces | AppArmor only | Deno only | Permission only |
| **DevOps Complexity** | High | High | Low | Medium | Very Low |
| **Portability** | Excellent | Linux-only | Linux-only | Excellent | Linux-only |
| **Proven Technology** | Battle-tested | Proven | Proven | New | Proven |
| **Can implement today?** | Yes | Yes | Yes | Partial | Yes ✓ |
| **Recommended for MVP?** | No | No | Yes | No | Yes ✓ |
| **Recommended long-term?** | Yes ✓ | Maybe | Yes ✓ | Yes ✓ | No |

---

## Recommendations

### Immediate (Next 24 hours)

**Do Solution #5 now:**
1. `chmod 700 /srv/webalive/sites/` - Fixes 80% of the problem
2. Fix the two world-readable sites
3. Add code validation to Claude Bridge
4. Audit existing code
5. Document the fix

**Effort:** 2-3 hours
**Impact:** High (eliminates information disclosure and cross-tenant access for properly-permissioned sites)

### Short-term (Week 1-2)

**Implement Solution #3 (AppArmor):**
1. Write AppArmor profiles for each site type
2. Test in audit mode first
3. Roll out gradually with monitoring
4. Provides syscall-level protection on top of permission fix

**Effort:** 4-6 hours
**Impact:** Very High (defense in depth, catches permission mistakes)

### Medium-term (Week 2-4)

**Plan and pilot either Solution #1 or #4:**
- **#1 (Containers)** if you want industry-standard isolation
- **#4 (Deno)** if you want security-first language-level isolation

Start with staging environment, test thoroughly.

**Effort:** 1-2 weeks (depending on choice)
**Impact:** Excellent (eliminates architectural misalignment permanently)

### Strategic Questions

Before choosing long-term solution:
1. **Do you plan to keep multi-tenant on single server?**
   - Yes → Containers (#1) or Deno (#4)
   - No → Less urgent, just fix immediately

2. **How important is startup time?**
   - Critical → #4 (Deno) or #3 (AppArmor)
   - Important → #2 (chroot)
   - Not critical → #1 (Containers)

3. **Do you have Docker expertise?**
   - Yes → #1 (Containers)
   - No → #3 (AppArmor) or #4 (Deno)

---

## Implementation Checklist

### Immediate Fix (Solution #5)
- [ ] Run `chmod 700 /srv/webalive/sites/`
- [ ] Fix 755 sites to 750
- [ ] Implement code validation in Claude Bridge
- [ ] Run audit script for existing code
- [ ] Document all findings
- [ ] Notify affected customers (if any data accessed)

### AppArmor Layer (Solution #3)
- [ ] Write AppArmor profiles
- [ ] Test in audit mode
- [ ] Verify no false positives
- [ ] Deploy to production
- [ ] Monitor denials in logs

### Long-term Solution
- [ ] Decide between #1, #2, #4
- [ ] Design deployment architecture
- [ ] Create test environment
- [ ] Test thoroughly
- [ ] Plan rollout
- [ ] Execute with monitoring

---

## References & Resources

- OWASP: Multi-tenant Application Security
- Linux AppArmor: https://gitlab.com/apparmor/apparmor/-/wikis/home
- Deno Security Model: https://deno.land/manual/basics/permissions
- Docker Security: https://docs.docker.com/engine/security/
- chroot Limitations: https://en.wikipedia.org/wiki/Chroot#Limitations
