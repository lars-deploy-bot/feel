# Security Incident Report: Cross-Tenant File System Access Vulnerability

**Date:** November 3, 2025
**Severity:** Critical
**Status:** Active Vulnerability
**Reporter:** System Administrator
**Affected System:** Claude Bridge Multi-Tenant Development Platform

---

## System Architecture Overview

### What is Claude Bridge?

Claude Bridge is a multi-tenant web development platform that allows multiple independent websites to be developed simultaneously on a single server, each in an isolated "workspace." Users interact with Claude AI through a web interface to write code, and the AI uses file system tools to create and modify files within workspace boundaries.

### Multi-Tenant Isolation Model

The system hosts multiple independent websites (tenants) on a single Linux server:

```
/srv/webalive/sites/
├── kranazilie.nl/        (Tenant A - Portfolio site)
├── homable.nl/           (Tenant B - Real estate platform)
├── riggedgpt.com/        (Tenant C - AI service)
├── demo-goalive-nl/      (Tenant D - Demo environment)
└── [15 other sites]
```

**Critical Requirement:** Each tenant must be completely isolated. Tenant A should never access Tenant B's files, code, or data.

---

## Security Architecture: Three-Layer Defense Model

### Layer 1: Operating System Process Isolation (systemd)

Each website runs as a separate Linux system user with a dedicated systemd service.

**Example Configuration:**

| Website | System User | UID | GID | Service Name |
|---------|-------------|-----|-----|--------------|
| kranazilie.nl | site-kranazilie-nl | 993 | 983 | site@kranazilie-nl.service |
| homable.nl | site-homable-nl | 994 | 984 | site@homable-nl.service |
| riggedgpt.com | site-riggedgpt-com | 995 | 985 | site@riggedgpt-com.service |

**What This Provides:**
- Each site's web server process runs with different Unix user credentials
- Linux kernel enforces file system access control based on UID/GID
- Memory isolation between processes
- Resource limits (CPU, memory, file descriptors)

**Example Process Tree:**
```
systemd (PID 1, UID 0)
├── site@kranazilie-nl.service (UID 993)
│   └── bun index.ts (UID 993) - Web server for kranazilie.nl
├── site@homable-nl.service (UID 994)
│   └── bun index.ts (UID 994) - Web server for homable.nl
```

### Layer 2: File System Permissions (UNIX DAC)

Linux uses Discretionary Access Control with permission triplets: User/Group/Other.

**Permission Notation:**
```
drwxr-x---
│││││││││└─ Other: no permissions (---)
││││││└┴┴─ Group: read + execute (r-x)
│││└┴┴───── User: read + write + execute (rwx)
│└┴─────── Type: directory (d)
```

**Standard Site Configuration (Expected):**
```bash
drwxr-x--- site-kranazilie-nl site-kranazilie-nl /srv/webalive/sites/kranazilie.nl/
```

Meaning:
- Owner (site-kranazilie-nl): Full access (rwx = 7)
- Group (site-kranazilie-nl): Read and traverse (r-x = 5)
- Others: No access (--- = 0)
- Numeric: 750

**Access Control Matrix:**

| User Attempting Access | Permission to kranazilie.nl/ | Can Read Files? | Can Write Files? | Can List Directory? |
|------------------------|------------------------------|-----------------|------------------|---------------------|
| site-kranazilie-nl (UID 993) | Owner | Yes | Yes | Yes |
| site-homable-nl (UID 994) | Other | No | No | No |
| root (UID 0) | Superuser | Yes | Yes | Yes |

**Why 750 Instead of 700:**
- Read (r): Required to read file contents
- Execute (x) on directory: Required to traverse/enter the directory
- Without execute permission on a directory, you cannot access ANY files inside it, even if you know their names
- Group permissions (5) allow same-group processes limited access if needed
- Other permissions (0) completely block cross-tenant access

### Layer 3: Claude Bridge Application-Level Enforcement

Claude Bridge adds an additional security layer specifically for AI-driven file operations.

**Implementation Location:** `apps/web/app/api/claude/stream/route.ts`

**Mechanism:**
```javascript
const canUseTool: Options["canUseTool"] = async (toolName, input) => {
  // Only allow specific tools
  const ALLOWED = new Set(["Write", "Edit", "Read", "Glob", "Grep"])
  if (!isToolAllowed(toolName, ALLOWED)) {
    return { behavior: "deny", message: "tool_not_allowed" }
  }

  // Validate file paths are within workspace
  const filePath = input.file_path || input.notebook_path || input.path
  if (filePath) {
    ensurePathWithinWorkspace(filePath, workspace.root)
    // workspace.root = /srv/webalive/sites/kranazilie.nl/user
  }

  return { behavior: "allow" }
}
```

**What This Provides:**
- Claude AI tools (Read, Write, Edit, Glob, Grep) are intercepted before execution
- Path validation prevents AI from accessing files outside workspace
- Example: AI cannot use `Read` tool with path `/srv/webalive/sites/homable.nl/config.env`

**Validation Function:**
```javascript
function ensurePathWithinWorkspace(requestedPath, workspaceRoot) {
  const resolved = path.resolve(workspaceRoot, requestedPath)
  if (!resolved.startsWith(workspaceRoot + path.sep)) {
    throw new Error('Path traversal attack detected')
  }
}
```

Test cases:
- `Read("./index.html")` → Resolves to `/srv/webalive/sites/kranazilie.nl/user/index.html` → ALLOWED
- `Read("../../../homable.nl/config.env")` → Resolves to `/srv/webalive/sites/homable.nl/config.env` → DENIED
- `Read("/etc/passwd")` → Absolute path outside workspace → DENIED

---

## The Vulnerability: Observations

### What Happened

A file created within kranazilie.nl workspace contains code that successfully accessed and displayed contents of `/srv/webalive/sites/`, exposing information from other tenants.

### How The Three-Layer Defense Behaved

#### Layer 1 (Process Isolation): Observation

**Expected Behavior:**
Process isolation prevents kranazilie.nl process from accessing homable.nl files.

**Actual Behavior:**
Process isolation worked as designed, but the parent directory `/srv/webalive/sites/` has the following permissions:

```bash
$ ls -ld /srv/webalive/sites/
drwxr-xr-x root root /srv/webalive/sites/
```

Permission breakdown:
- Owner (root): rwx (7)
- Group (root): r-x (5)
- Other: r-x (5)

This means ANY user on the system, including site-kranazilie-nl (UID 993), can:
- Read the directory listing (r)
- Traverse into it (x)
- See all subdirectory names

**Test Verification:**
```bash
$ sudo -u site-kranazilie-nl ls /srv/webalive/sites/
barendbootsma.com  homable.nl      riggedgpt.com
kranazilie.nl      demo-goalive-nl staging.goalive.nl
[... 15 other sites ...]
```
Result: SUCCESS - All tenant names enumerated

**Additional Discovery - World-Readable Tenants:**

Two sites have the following directory permissions:

```bash
$ ls -ld /srv/webalive/sites/demo-goalive-nl/
drwxr-xr-x site-demo-goalive-nl site-demo-goalive-nl demo-goalive-nl/

$ ls -ld /srv/webalive/sites/staging.goalive.nl/
drwxr-xr-x root root staging.goalive.nl/
```

The Other permission is r-x (5), meaning ANY system user can read all files:

```bash
$ sudo -u site-kranazilie-nl cat /srv/webalive/sites/demo-goalive-nl/package.json
{
  "name": "demo-goalive",
  "dependencies": { ... },
  "scripts": { ... }
}
```
Result: SUCCESS - Full file content access across tenant boundary

**Sites with 755 Permissions:**
1. `demo-goalive-nl/` - drwxr-xr-x
2. `staging.goalive.nl/` - drwxr-xr-x

#### Layer 2 (File Permissions): Observation

**Expected Behavior:**
File permissions should block cross-tenant access even if parent directory is traversable.

**Actual Behavior:**
Most production sites use 750 permissions:

```bash
drwxr-x--- site-kranazilie-nl site-kranazilie-nl kranazilie.nl/
drwxr-x--- site-homable-nl    site-homable-nl    homable.nl/
drwxr-x--- site-riggedgpt-com site-riggedgpt-com riggedgpt.com/
```

This prevents cross-tenant file access:
```bash
$ sudo -u site-kranazilie-nl cat /srv/webalive/sites/homable.nl/index.html
cat: /srv/webalive/sites/homable.nl/index.html: Permission denied
```

**However:**
- Parent directory listing succeeds (information disclosure)
- Two sites have 755 permissions (complete access granted)
- Symbolic links reveal target paths
- File metadata (sizes, timestamps) accessible via stat() syscalls

#### Layer 3 (Claude Bridge): Observation

**Expected Behavior:**
Claude Bridge should prevent file access outside workspace boundaries.

**Actual Behavior:**
Claude Bridge only validates SDK tool invocations. User-written application code runs without interception.

**The Bypass Mechanism:**

User code exists at this location:
```
/srv/webalive/sites/kranazilie.nl/user/vite-plugin-api.js
```

This file is inside the workspace. At runtime, the code contains:

```javascript
const targetDir = path.resolve(__dirname, '../../');
// __dirname = /srv/webalive/sites/kranazilie.nl/user
// Resolves to: /srv/webalive/sites/
```

**Execution Flow Observed:**

```
1. Browser → HTTP GET /api/filesystem
2. Vite Dev Server (running as UID 993) → Calls vite-plugin-api.js
3. vite-plugin-api.js → Executes path.resolve(__dirname, '../../')
4. Node.js fs.readdirSync() → Kernel syscall openat() + getdents()
5. Kernel checks: Is UID 993 allowed to read /srv/webalive/sites/?
6. Kernel response: Yes (drwxr-xr-x permissions)
7. Directory listing returned → Sent to browser
```

Claude Bridge did not intercept this operation because:
- The code is not using Claude SDK tools (Read, Write, Edit, etc.)
- It is user application code using native Node.js `fs` module
- It executes with full privileges of the site user (UID 993)

---

## Attack Surface Analysis

### What Was Successfully Accessed

**From kranazilie.nl workspace:**

1. **Enumeration of all tenant names** (confirmed)
   ```bash
   GET /api/filesystem
   → Returns: ["kranazilie.nl", "homable.nl", "riggedgpt.com", ...]
   ```

2. **Complete file trees from world-readable sites** (confirmed)
   - `demo-goalive-nl/` - Source code, dependencies, configuration
   - `staging.goalive.nl/` - Staging environment files

3. **Metadata collection** (observed)
   - Directory structure
   - File sizes
   - Modification timestamps
   - Symbolic link targets

### What Was Not Accessible

Sites with 750 permissions blocked direct file reads:
- `homable.nl/` - Permission denied on file access
- `riggedgpt.com/` - Permission denied on file access
- `barendbootsma.com/` - Permission denied on file access

**Observation:** Protection depends on correct permission configuration. Any file or directory with incorrect permissions (644 instead of 640, 755 instead of 750) would be readable.

---

## Root Cause: Architectural Observations

### Observation 1: Parent Directory Permissions

The parent directory `/srv/webalive/sites/` has permissions that allow all system users to:
- List directory contents (enumerate tenant names)
- Traverse into subdirectories

Question: What requires this access model? Can systemd services access their working directories without parent directory traversal permission?

### Observation 2: Application Code Validation Gap

Claude Bridge validates file paths for SDK tools but does not validate:
- User-written application code (Vite plugins, Express middleware, etc.)
- Runtime filesystem operations performed by application servers
- Child processes spawned by user code

Question: Is there a mechanism to restrict what user application code can access at runtime, or does it inherit full filesystem access of the site user?

### Observation 3: Two-Level Permission Models

The system uses:
1. Workspace path validation (Layer 3): `/srv/webalive/sites/kranazilie.nl/user/`
2. Process user permissions (Layer 1): site-kranazilie-nl can access `/srv/webalive/sites/`

These do not align. The process has broader filesystem access than the intended workspace boundary.

Question: How was this decided? What use cases require the process user to have access beyond the workspace directory?

### Observation 4: Permission Inconsistency

Most sites: 750 (secure)
Two sites: 755 (world-readable)

Question: What deployment process was used for demo-goalive-nl and staging.goalive.nl? Why do they have different permissions than production sites?

---

## Permission Audit Results

### Parent Directory

```bash
$ ls -ld /srv/webalive/sites/
drwxr-xr-x 17 root root 4096 Nov 2 16:30 /srv/webalive/sites/
```

Owner: root
Permissions: 755 (world-readable and executable)

### Individual Site Audit

| Site | Permissions | Owner:Group | Readable by Others? |
|------|-------------|-------------|---------------------|
| kranazilie.nl | drwxr-x--- (750) | site-kranazilie-nl:site-kranazilie-nl | No |
| homable.nl | drwxr-x--- (750) | site-homable-nl:site-homable-nl | No |
| riggedgpt.com | drwxr-x--- (750) | site-riggedgpt-com:site-riggedgpt-com | No |
| barendbootsma.com | drwxr-x--- (750) | site-barendbootsma-com:site-barendbootsma-com | No |
| demo-goalive-nl | drwxr-xr-x (755) | site-demo-goalive-nl:site-demo-goalive-nl | Yes |
| staging.goalive.nl | drwxr-xr-x (755) | root:root | Yes |
| [11 other sites] | drwxr-x--- (750) | [respective owners] | No |

### World-Readable Site Details

**demo-goalive-nl:**
```bash
$ namei -l /srv/webalive/sites/demo-goalive-nl/user/package.json
drwxr-xr-x root                   root                   /
drwxr-xr-x root                   root                   srv
drwxr-xr-x root                   root                   webalive
drwxr-xr-x root                   root                   sites
drwxr-xr-x site-demo-goalive-nl   site-demo-goalive-nl   demo-goalive-nl
drwxr-xr-x site-demo-goalive-nl   site-demo-goalive-nl   user
-rw-r--r-- site-demo-goalive-nl   site-demo-goalive-nl   package.json
```

Every directory in the path has "other execute" permission, and the file has "other read" permission.

**staging.goalive.nl:**
```bash
$ ls -ld /srv/webalive/sites/staging.goalive.nl/
drwxr-xr-x 3 root root 4096 Nov 2 16:30 staging.goalive.nl
```

Owned by root but world-readable.

---

## Evidence and Reproducibility

### Test Case 1: Directory Enumeration

```bash
$ sudo -u site-kranazilie-nl ls /srv/webalive/sites/
```
Result: Lists all tenant directories (barendbootsma.com, kranazilie.nl, homable.nl, riggedgpt.com, etc.)

### Test Case 2: Cross-Tenant File Access (World-Readable Sites)

```bash
$ sudo -u site-kranazilie-nl cat /srv/webalive/sites/demo-goalive-nl/package.json
```
Result: File content successfully read

### Test Case 3: Cross-Tenant File Access (Properly Secured Sites)

```bash
$ sudo -u site-kranazilie-nl cat /srv/webalive/sites/homable.nl/user/package.json
```
Result: Permission denied

### Test Case 4: Application-Level Access

```
HTTP GET http://kranazilie.nl/api/filesystem
```
Result: JSON response containing directory listing of `/srv/webalive/sites/` with all tenant names and file metadata

**Vulnerable Code Location:**
`/srv/webalive/sites/kranazilie.nl/user/vite-plugin-api.js` lines 84-138

```javascript
// Line 89
const targetDir = path.resolve(__dirname, '../../');

// Line 96
const items = fs.readdirSync(dirPath, { withFileTypes: true });
```

---

## Impact Assessment

### Confirmed Information Disclosure

1. **Tenant Enumeration:**
   - All 19 tenant domain names disclosed
   - System scale and customer information revealed

2. **Complete Data Access (2 sites):**
   - demo-goalive-nl: Source code, dependencies, configuration files
   - staging.goalive.nl: Staging environment data

3. **Metadata Disclosure (All sites):**
   - Directory structure
   - File sizes and timestamps
   - Symbolic link targets
   - User/group ownership information

### Potential for Escalation

Exposed information could enable:
- Reading credentials from staging/demo environments
- Studying source code for additional vulnerabilities
- Mapping infrastructure and deployment patterns
- Identifying high-value targets for focused attacks

### Business Impact

- Confidentiality: Complete breach for 2 sites, partial breach for all sites
- Integrity: Not directly compromised
- Availability: Not affected
- Compliance: Multi-tenant isolation requirement potentially violated

---

## Questions for Root Cause Analysis

### Architecture Questions

1. **Parent Directory Design:**
   - Why is `/srv/webalive/sites/` configured with 755 permissions?
   - What functionality requires all system users to list this directory?
   - Can systemd services access their working directories if parent is 700?
   - When was this permission set and by what process?

2. **Permission Configuration:**
   - Why do demo-goalive-nl and staging.goalive.nl have 755 permissions?
   - What deployment method was used for these sites vs others?
   - Is this intentional for development/staging access?
   - Were these deployed manually or via script?

3. **Application Security Model:**
   - What is the intended security boundary for user application code?
   - Should application code be restricted beyond UNIX permissions?
   - What use cases require site processes to access parent directory?
   - Has container isolation or chroot been considered?

### Deployment Questions

4. **Code Creation:**
   - How was vite-plugin-api.js created?
   - Was it created via Claude Bridge Write/Edit tools?
   - Was it manually deployed or scaffolded?
   - When was it created relative to workspace containment implementation?

5. **Validation Process:**
   - What validation occurred when this file was created?
   - Did path validation check only the file location, not content?
   - Is there static analysis for dangerous patterns in user code?
   - Does Claude Bridge inspect code content or only file paths?

### Detection Questions

6. **Monitoring Gaps:**
   - Why was this vulnerability not detected earlier?
   - Is there monitoring for filesystem access outside workspaces?
   - Is there automated scanning for path traversal patterns?
   - Are there audit logs of cross-tenant access attempts?

7. **Scope Assessment:**
   - Are there similar vulnerabilities in other sites?
   - Have other sites created code with filesystem access?
   - Are there other bypass vectors (network access to other sites' ports)?
   - What other Node.js APIs provide unrestricted system access?

### Design Intent Questions

8. **Layer 3 Scope:**
   - Is Layer 3 (Claude Bridge validation) intended to protect only AI operations?
   - Or should it also restrict user application runtime?
   - What is the security model for code created by AI vs executed by user?

9. **Permission Philosophy:**
   - Is the current three-layer model (systemd + UNIX + Claude Bridge) considered sufficient?
   - Or are additional isolation mechanisms planned?
   - What threat model was used when designing this architecture?

---

## Additional Investigation Areas

### Code Audit Required

1. Scan all workspaces for similar patterns:
   ```bash
   grep -r "path.resolve.*\.\." /srv/webalive/sites/*/user/
   grep -r "fs.readdir\|fs.readdirSync" /srv/webalive/sites/*/user/
   grep -r "__dirname.*\.\." /srv/webalive/sites/*/user/
   ```

2. Check for other filesystem APIs that bypass validation:
   - fs.readFile, fs.writeFile
   - fs.stat, fs.lstat (metadata access)
   - child_process.exec, child_process.spawn

3. Audit for network-based cross-tenant access:
   - Attempts to connect to localhost ports of other services
   - HTTP requests to other sites' development servers

### Permission Audit Required

1. Find all world-readable directories:
   ```bash
   find /srv/webalive/sites/ -type d -perm -o=r
   ```

2. Find all world-readable files:
   ```bash
   find /srv/webalive/sites/ -type f -perm -o=r
   ```

3. Verify ownership consistency:
   ```bash
   find /srv/webalive/sites/kranazilie.nl -not -user site-kranazilie-nl
   ```

### Process Analysis Required

1. What processes are currently running with workspace user permissions?
2. What capabilities do these processes have?
3. What syscalls are they making to the filesystem?
4. Are there strace logs available for analysis?

---

## Technical Evidence Summary

**Vulnerable System:**
- Platform: Claude Bridge Multi-Tenant Development Platform
- OS: Linux with systemd process management
- File System: Standard ext4/xfs with UNIX DAC permissions

**Attack Vector:**
- User-created application code in workspace
- Native Node.js filesystem APIs (fs.readdirSync)
- Executed with site user privileges (UID 993)
- No runtime validation of filesystem access

**Vulnerable File:**
- Location: `/srv/webalive/sites/kranazilie.nl/user/vite-plugin-api.js`
- Lines: 84-138
- Pattern: `path.resolve(__dirname, '../../')` + `fs.readdirSync()`

**Permission Configuration:**
- Parent: `/srv/webalive/sites/` → 755 (world-readable)
- Most sites: 750 (secure)
- Vulnerable sites: 755 (world-readable)
  - demo-goalive-nl
  - staging.goalive.nl

**Test Results:**
- Directory enumeration: Successful
- Cross-tenant file read (755 sites): Successful
- Cross-tenant file read (750 sites): Permission denied
- Application-level bypass: Successful

This report documents observations only. Root cause analysis and remediation planning should be performed by security team.
