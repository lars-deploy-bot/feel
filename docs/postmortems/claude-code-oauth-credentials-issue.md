# Postmortem: Claude Code OAuth Credentials & Child Process Authentication Failure

**Date**: November 3, 2025
**Incident**: "Invalid API key" errors when Claude Bridge attempted to spawn Claude Code for workspace operations
**Duration**: ~2 hours
**Status**: Resolved

## Summary

The Claude Bridge application was unable to execute Claude Code in child processes for systemd-managed workspaces. Users received "Invalid API key" errors when attempting to interact with Claude through the web UI. The issue was caused by passing an expired/invalid hardcoded API key as an environment variable (`ANTHROPIC_API_KEY`), which overrode Claude Code's valid OAuth credentials stored in `.credentials.json`.

## Timeline

1. **Initial Report**: Web UI showing "Invalid API key · Fix external API key" error
2. **API Key Validation**: Confirmed API key from `.env` was present and passed validation
3. **First Hypothesis**: Suspected expired API key from `.env` file
4. **Failed Attempt #1**: Removed hardcoded API key, expecting Claude Code to use session environment
5. **Failed Attempt #2**: Tried using OAuth token from `.credentials.json` as API key (wrong token type)
6. **Failed Attempt #3**: Attempted to inject credentials via PM2 ecosystem config
7. **Failed Attempt #4**: Restored original hardcoded API key (still failed)
8. **SDK Investigation**: Discovered SDK was spawning Claude Code subprocess (ProcessTransport mode)
9. **Permission Discovery**: Found child process couldn't access `/root/.claude/.credentials.json` after dropping privileges
10. **Credential Copy Implementation**: Added credential copying to temp directory before privilege drop
11. **Permission Issue**: Temp home directory owned by root, Claude Code couldn't write `.claude.json`
12. **Final Discovery**: `ANTHROPIC_API_KEY` env var was forcing Claude Code into direct API mode instead of OAuth
13. **Resolution**: Removed `ANTHROPIC_API_KEY` from child environment, allowing OAuth credentials to work

## Root Cause

### The Multi-Layered Problem

The issue had **three interconnected root causes**:

#### 1. Environment Variable Override (Primary)
The child process spawner was passing `ANTHROPIC_API_KEY` (containing an expired hardcoded API key from `.env`) to Claude Code. When Claude Code sees this environment variable, it **prioritizes direct API mode** over OAuth credentials, even if valid OAuth credentials exist.

**File**: `apps/web/lib/agent-child-runner.ts:55`
```typescript
env: {
  ANTHROPIC_API_KEY: env.ANTH_API_SECRET,  // ❌ Overrides OAuth
  HOME: process.env.HOME,
  ...
}
```

#### 2. Credential Access After Privilege Drop
After the child runner dropped from `root` to the workspace user (UID 993), it could no longer access `/root/.claude/.credentials.json` due to file permissions (`-rw------- root:root`). This meant even if OAuth mode was enabled, credentials were inaccessible.

#### 3. Temp Directory Permissions
The temporary home directory created for credentials was owned by `root:root`, preventing Claude Code (running as UID 993) from writing its configuration file `.claude.json`.

**Evidence**:
```bash
$ ls -la /tmp/claude-home-993/
drwxr-xr-x 3 root root 4096  # ❌ Owned by root
drwxr-xr-x 3 site-kranazilie-nl site-kranazilie-nl 4096  # .claude/ subdirectory
```

### Why Validation Passed But API Calls Failed

The environment validation in `lib/env.ts` only checked for the **presence** of an API key:
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTH_API_SECRET
if (!apiKey) {
  errors.push("ANTHROPIC_API_KEY or ANTH_API_SECRET is required")
}
```

This validation passed because the key **existed**, but Anthropic's API rejected it at call time because it was expired/revoked.

## What Went Wrong

### Architecture Misunderstanding

**Confusion about credential types:**
- **OAuth tokens** (`sk-ant-oat01-...`): Used by Claude.ai for browser-based authentication
- **API keys** (`sk-ant-api03-...`): Used for direct Anthropic API calls
- These are **completely different authentication systems** and not interchangeable

**Confusion about SDK behavior:**
- The Anthropic Agent SDK has two modes:
  - **Direct API mode**: SDK → HTTP → Anthropic servers (uses `ANTHROPIC_API_KEY`)
  - **ProcessTransport mode**: SDK → spawns Claude Code → Claude Code → Anthropic (uses OAuth credentials)
- The system **needs** ProcessTransport mode for Claude Code's internal tooling (MCP servers, advanced routing)
- Passing `ANTHROPIC_API_KEY` env var forces **direct API mode**, disabling ProcessTransport

### Failed Debugging Attempts

1. **Attempted to remove API key dependency**: Didn't work because PM2 processes don't inherit Claude Code CLI session environment
2. **Tried to use OAuth token as API key**: Failed because OAuth tokens aren't valid for direct API authentication
3. **Attempted ecosystem.config.js injection**: Injected wrong token type and Next.js doesn't reload env vars from PM2 changes
4. **Restored original key**: Still failed because the key was expired, confirming it wasn't just a configuration issue

### Process Issues

- **No stderr capture from Claude Code**: The child process stderr from Claude Code itself wasn't being logged, hiding the actual error
- **Validation too shallow**: Only checked for presence of API key, not validity or correct usage
- **Mixed authentication modes**: Tried to use both direct API and OAuth simultaneously

## What Went Right

### Systematic Debugging Approach

1. **Traced the execution flow**: Followed the complete path from Next.js → child runner → Claude Code subprocess
2. **Checked actual file permissions**: Verified credential file access at each privilege level
3. **Manual reproduction**: Tested `sudo -u site-kranazilie-nl env HOME=/tmp/claude-home-993 claude --help` to isolate the issue
4. **Incremental fixes**: Addressed each layer (credentials copy → permissions → env vars) systematically

### Architecture Understanding

The debugging process clarified the **complete multi-process architecture**:
```
Browser → Next.js (root, port 8999)
  → Child runner (spawned as root)
    → Credential copy (while root)
    → Drop to UID 993
    → SDK query()
      → Spawns Claude Code (UID 993, uses OAuth)
```

### Error Messages Led to Discovery

The `EACCES: permission denied, open '/tmp/claude-home-993/.claude.json'` error from manual testing revealed the temp directory permission issue, which wouldn't have been visible in production logs.

## Resolution

### Fix #1: Copy Credentials Before Privilege Drop

**File**: `apps/web/scripts/run-agent.mjs:34-49`

```javascript
// BEFORE dropping privileges (still root)
const originalHome = process.env.HOME || "/root"
const tempHome = `/tmp/claude-home-${targetUid}`
const credSource = join(originalHome, ".claude", ".credentials.json")
const credDest = join(tempHome, ".claude", ".credentials.json")

if (existsSync(credSource)) {
  mkdirSync(join(tempHome, ".claude"), { recursive: true, mode: 0o755 })
  copyFileSync(credSource, credDest)

  // Chown the ENTIRE temp home directory + contents
  chownSync(tempHome, targetUid, targetGid)
  chownSync(join(tempHome, ".claude"), targetUid, targetGid)
  chownSync(credDest, targetUid, targetGid)

  process.env.HOME = tempHome
}

// THEN drop privileges
process.setgid(targetGid)
process.setuid(targetUid)
```

**Why this works**:
- Credentials copied while still root (can read `/root/`)
- Ownership changed to workspace user before privilege drop
- After dropping to UID 993, process can access its own credentials

### Fix #2: Remove API Key Environment Variable

**File**: `apps/web/lib/agent-child-runner.ts:52-62`

```typescript
const child = spawn(process.execPath, [runnerPath], {
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    // ✅ REMOVED: ANTHROPIC_API_KEY: env.ANTH_API_SECRET
    // Let Claude Code use OAuth credentials from .credentials.json
    NODE_ENV: process.env.NODE_ENV,
    TARGET_UID: String(uid),
    TARGET_GID: String(gid),
    TARGET_CWD: workspaceRoot,
    LANG: "C.UTF-8",
    LC_CTYPE: "C.UTF-8",
  },
  stdio: ["pipe", "pipe", "pipe"],
})
```

**Why this works**:
- No `ANTHROPIC_API_KEY` → Claude Code defaults to OAuth mode
- Reads credentials from `$HOME/.claude/.credentials.json` (now accessible at `/tmp/claude-home-{uid}/`)
- Uses valid OAuth token instead of expired API key

### Fix #3: Remove OAuth Injection from PM2 Config

**File**: `ecosystem.config.js`

```javascript
// BEFORE
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
apiKey = creds.claudeAiOauth.accessToken;  // ❌ Wrong token type

// AFTER
// Removed entirely - let each child process handle its own credentials
```

## Complete Authentication Flow (Fixed)

### Request Path

1. **Browser** → `terminal.goalive.nl` → Caddy → `localhost:8999` (Next.js as root)
2. **Next.js route** → detects systemd workspace (checks UID of `/srv/webalive/sites/kranazilie.nl/`)
3. **Spawns child runner** (PID 4061500, still root)
   - Receives: `{ message: "hi", workspace: "kranazilie.nl", ... }`

### Credential Setup (As Root)

```bash
# Still running as root (UID 0)
cp /root/.claude/.credentials.json → /tmp/claude-home-993/.claude/.credentials.json
chown -R 993:983 /tmp/claude-home-993/
export HOME=/tmp/claude-home-993
```

### Privilege Drop

```bash
setgid(983)  # Drop to workspace group
setuid(993)  # Drop to workspace user (IRREVERSIBLE)
# Now running as site-kranazilie-nl
```

### SDK Execution

```javascript
const agentQuery = query({
  prompt: "hi",
  options: {
    cwd: "/srv/webalive/sites/kranazilie.nl/user",
    model: "claude-sonnet-4-5",
    maxTurns: 25,
    permissionMode: "acceptEdits",
    allowedTools: ["Write", "Edit", "Read", ...],
    mcpServers: { ... }
  }
})
```

### Claude Code Subprocess

```bash
# SDK auto-detects Claude Code executable
which claude → /usr/local/bin/claude

# Spawns Claude Code (inherits UID 993)
spawn('/usr/local/bin/claude', ['agent', 'query', ...], {
  env: {
    HOME: "/tmp/claude-home-993"  # ✅ Credentials accessible
    # ✅ NO ANTHROPIC_API_KEY → Uses OAuth mode
  }
})

# Claude Code reads OAuth credentials
cat $HOME/.claude/.credentials.json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat01-...",  # ✅ Valid OAuth token
    "refreshToken": "sk-ant-ort01-...",
    "expiresAt": 1762204811973
  }
}

# Connects to Anthropic using OAuth ✅
# Creates files owned by 993:983 ✅
```

## Multi-Tenant Isolation (How It Works)

### Per-Website Security

**kranazilie.nl**:
- **User**: `site-kranazilie-nl` (UID 993, GID 983)
- **Credentials**: `/tmp/claude-home-993/.claude/.credentials.json` (owned 993:983)
- **Files**: `/srv/webalive/sites/kranazilie.nl/` (owned 993:983)
- **Process**: All operations as UID 993 (cannot access other sites)

**riggedgpt.com**:
- **User**: `site-riggedgpt-com` (UID 994, GID 984)
- **Credentials**: `/tmp/claude-home-994/.claude/.credentials.json` (owned 994:984)
- **Files**: `/srv/webalive/sites/riggedgpt.com/` (owned 994:984)
- **Process**: All operations as UID 994 (cannot access other sites)

### Kernel-Level Enforcement

Linux kernel prevents UID 993 from accessing:
- Files owned by UID 994
- Credentials at `/tmp/claude-home-994/`
- Any files outside its workspace

This is **not application-level security** - it's OS-enforced isolation.

## Prevention Measures

### 1. Environment Variable Discipline

**Rule**: Never pass `ANTHROPIC_API_KEY` to Claude Code when using ProcessTransport mode.

```typescript
// ❌ BAD: Forces direct API mode
env: {
  ANTHROPIC_API_KEY: "sk-ant-api03-...",
  HOME: "/tmp/claude-home-993"
}

// ✅ GOOD: Allows OAuth mode
env: {
  HOME: "/tmp/claude-home-993",  // Claude Code finds credentials here
  PATH: process.env.PATH
}
```

### 2. Credential Copy Pattern

**Rule**: Always copy credentials **before** dropping privileges.

```javascript
// Execution order matters:
1. Copy /root/.claude/.credentials.json (as root)
2. chown to target UID (as root)
3. setuid() to drop privileges (irreversible)
4. Spawn Claude Code (as target UID, can access owned credentials)
```

### 3. Temp Directory Ownership

**Rule**: Entire temp home directory must be owned by target UID, not just subdirectories.

```javascript
// ❌ BAD: Only .claude/ subdirectory owned by target user
chownSync(join(tempHome, ".claude"), targetUid, targetGid)

// ✅ GOOD: Entire home directory + contents owned
chownSync(tempHome, targetUid, targetGid)
chownSync(join(tempHome, ".claude"), targetUid, targetGid)
```

### 4. Validation Improvements

**Add validation for**:
- Credential file accessibility after privilege drop
- Correct ownership of temp directories
- Absence of conflicting environment variables

```javascript
// Future validation
if (process.env.ANTHROPIC_API_KEY && processTransportMode) {
  console.warn("⚠️  ANTHROPIC_API_KEY set - will override OAuth credentials")
}
```

## Testing Verification

### Manual Test (Post-Fix)

```bash
# 1. Clean slate
rm -rf /tmp/claude-home-993

# 2. Test as workspace user
sudo -u site-kranazilie-nl env HOME=/tmp/claude-home-993 /usr/local/bin/claude --help
# ❌ Before fix: EACCES: permission denied
# ✅ After fix: Help text displays

# 3. Verify credentials accessible
sudo -u site-kranazilie-nl cat /tmp/claude-home-993/.claude/.credentials.json
# ✅ OAuth credentials readable
```

### End-to-End Test

1. Restart both PM2 processes
2. Clean all temp credential directories
3. Send "hi" message via web UI
4. Verify:
   - Credentials copied to `/tmp/claude-home-{uid}/`
   - Credentials owned by workspace user
   - Claude Code spawns successfully
   - Response received without errors

## Lessons Learned

### Technical

1. **Environment variables have precedence**: `ANTHROPIC_API_KEY` env var always overrides credential files in Claude Code
2. **OAuth ≠ API keys**: These are different authentication systems; OAuth tokens don't work as API keys and vice versa
3. **Privilege drops are irreversible**: Must copy/chown resources **before** `setuid()`
4. **ProcessTransport mode needs specific setup**: Claude Code subprocess needs correct `$HOME`, credentials, and **no conflicting env vars**
5. **Directory ownership hierarchy matters**: Parent directory must be writable, not just subdirectories

### Architecture

1. **Multi-process isolation is complex**: Each privilege level has different file access capabilities
2. **Credential flow must be traced end-to-end**: From root → child → subprocess → SDK → Claude Code
3. **Authentication mode detection is implicit**: SDK/Claude Code silently switches modes based on environment
4. **systemd workspaces require special handling**: Non-root ownership triggers child process isolation

### Debugging

1. **Symptoms can be misleading**: "Invalid API key" didn't mean the key was wrong - it meant the **wrong authentication mode** was being used
2. **Manual reproduction is critical**: Running `sudo -u {user} claude --help` revealed the real permission error
3. **Check every assumption**: "API key validation passed" didn't mean it was being **used correctly**
4. **Layer-by-layer fixes**: Each issue (credentials, permissions, env vars) needed separate resolution

### Process

1. **Documentation of attempts prevents loops**: Tracking what failed (and why) prevented repeating failed approaches
2. **Understanding > Quick fixes**: Taking time to understand ProcessTransport vs Direct API mode was essential
3. **Error visibility matters**: Claude Code's stderr wasn't being logged, hiding critical information
4. **Production != Development**: Local development uses different paths and users than production

## Action Items

### Completed ✅

- [x] Remove `ANTHROPIC_API_KEY` from child process environment
- [x] Implement credential copy before privilege drop
- [x] Fix temp directory ownership (entire directory, not just subdirectories)
- [x] Pass `HOME` env var to child process
- [x] Test end-to-end with systemd workspace
- [x] Document this postmortem
- [x] Clean up ecosystem.config.js (removed credential injection)

### Future Improvements

- [ ] Add validation: Warn if `ANTHROPIC_API_KEY` set in ProcessTransport mode
- [ ] Improve error logging: Capture Claude Code subprocess stderr
- [ ] Add health check: Verify credential file accessibility post-privilege-drop
- [ ] Monitoring: Alert if temp credential copies fail
- [ ] Documentation: Add "How Claude Code Authentication Works" explainer
- [ ] Consider: Shared credential cache to avoid per-request copying

## Future Considerations

### Credential Caching

**Current**: Credentials copied on every request
**Consideration**: Cache credentials in temp directory, refresh on expiry

```javascript
// Potential optimization
if (!existsSync(credDest) || isExpired(credDest)) {
  copyFileSync(credSource, credDest)
  chownSync(credDest, targetUid, targetGid)
}
```

**Trade-offs**:
- ✅ Faster: No copy overhead on every request
- ❌ Stale credentials if source updates
- ❌ Cleanup complexity (when to remove temp dirs?)

### Alternative: Shared Credential Service

**Idea**: Run a credential proxy service that all workspace users can query

**Trade-offs**:
- ✅ Central management
- ✅ No filesystem copies
- ❌ Additional service to maintain
- ❌ New attack surface

### Environment Variable Strategy

**Current approach**: No API key env var → OAuth automatic

**Alternative**: Explicit mode selection
```javascript
env: {
  CLAUDE_AUTH_MODE: "oauth",  // Explicit instead of implicit
  HOME: tempHome
}
```

**Trade-offs**:
- ✅ Clearer intent
- ❌ Requires SDK support
- ❌ Non-standard

## Key Takeaways

### For Multi-Tenant Systems

1. **Privilege boundaries affect credential access**: Plan credential flow across all privilege levels
2. **Each UID needs its own credential copy**: Isolation requires duplication
3. **Ownership must be complete**: Parent directories, subdirectories, and files all need correct ownership

### For Claude Code Integration

1. **OAuth vs API key matters**: Environment variables change SDK behavior
2. **ProcessTransport mode is preferred**: Needed for Claude Code's advanced tooling (MCP, etc.)
3. **Implicit mode detection is fragile**: Presence of `ANTHROPIC_API_KEY` silently changes behavior
4. **$HOME must be writable**: Claude Code needs to write `.claude.json` config

### For Debugging Complex Systems

1. **Trace authentication end-to-end**: From browser → server → child → subprocess
2. **Test manually at each privilege level**: `sudo -u {user}` reveals permission issues
3. **Document failed attempts**: Prevents debugging loops
4. **Understand before fixing**: Quick fixes without understanding cause more issues

---

**Most Critical Learning**: When integrating Claude Code via SDK in ProcessTransport mode, **never set `ANTHROPIC_API_KEY` environment variable**. This forces direct API mode and bypasses OAuth credentials, breaking the authentication flow entirely.
