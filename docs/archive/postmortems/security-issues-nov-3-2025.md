# Incident Report: Tool Permission Bypass & OAuth Authentication Failure

**Date**: November 3, 2025
**Status**: Resolved
**Severity**: Critical (Security)
**Duration**: ~2 hours debugging, multiple failed approaches
**Impact**: All workspaces at risk; users could access unauthorized tools

---

## Executive Summary

Two interconnected security issues were discovered and resolved on November 3, 2025:

1. **Tool Permission Bypass**: Users had access to 14+ tools (Bash, Task, WebSearch, etc.) instead of the intended 8 safe tools (Write, Edit, Read, Glob, Grep, + 3 MCP tools)
2. **OAuth Credential Failure**: Claude Bridge child processes couldn't authenticate with Claude Code due to environment variable conflicts and file permission issues

The first issue exposed dangerous tools to users. The second issue occurred during debugging attempts to fix the first. These were **separate problems with different root causes**: Issue #1 was caused by `settingSources` overriding the `allowedTools` whitelist, while Issue #2 was caused by `ANTHROPIC_API_KEY` environment variable forcing direct API mode and credential access problems after privilege drop.

---

## Issue #1: Tool Permission Bypass

**Note**: This issue was caused by `settingSources` overriding the `allowedTools` whitelist. The OAuth authentication failure (Issue #2 below) was a separate problem with different root causes. Fixing `settingSources` alone resolved the tool bypass but did not fix the OAuth issue.

### The Problem

Users accessing Claude Bridge received unauthorized tools:

```javascript
// ACTUAL tools users received:
tools: [
  'Task', 'Bash', 'Glob', 'Grep', 'ExitPlanMode',
  'Read', 'Edit', 'Write', 'NotebookEdit',
  'WebFetch', 'TodoWrite', 'WebSearch',
  'BashOutput', 'KillShell'
]

// INTENDED tools (from allowedTools config):
tools: [
  'Write', 'Edit', 'Read', 'Glob', 'Grep',
  'mcp__workspace-management__restart_dev_server',
  'mcp__tools__list_guides',
  'mcp__tools__get_guide'
]
```

This meant users could:
- ✅ Execute arbitrary shell commands (`Bash`)
- ✅ Spawn sub-agents (`Task`)
- ✅ Read `.env` files and credentials
- ✅ Make external network requests (`WebFetch`, `WebSearch`)
- ✅ Kill/manipulate processes (`BashOutput`, `KillShell`)

### Root Cause Analysis

**Location**: `apps/web/app/api/claude/stream/route.ts:254`

The SDK options included `settingSources: ["project"]`, which caused the SDK to:

1. Look for project-level config files (`.clauderc`, `.claude.toml`, `claude.config.js`)
2. Load defaults when none existed
3. **Override the explicit `allowedTools` whitelist with default Claude Code toolset**

```typescript
// ❌ VULNERABLE CODE
const claudeOptions: Options = {
  allowedTools: ["Write", "Edit", "Read", "Glob", "Grep", ...],
  settingSources: ["project"],  // This line caused the bypass
}
```

The `settingSources` parameter takes precedence over `allowedTools`, creating a **whitelist bypass**.

### Security Impact

**Process Isolation Working** ✅
- Bash commands ran as workspace user (e.g., `site-kranazilie-nl`)
- File operations sandboxed to workspace directory
- Cannot access other sites' files
- systemd security restrictions applied

**Tool Restriction Broken** ❌
- Full Claude Code toolset accessible despite restrictions
- Users could execute shell commands as their site user
- Could read workspace files including `.env`, credentials
- Could spawn sub-agents and make external requests

---

## Issue #2: OAuth Credential & Authentication Failure

### The Problem

During testing/debugging, child processes failed to authenticate:

```
Error: Invalid API key · Fix external API key
```

This prevented Claude Bridge from executing Claude Code in child processes for systemd-managed workspaces.

### The Multi-Layered Root Cause

This issue had **three interconnected problems**:

#### Problem 1: API Key Environment Variable Override (PRIMARY)

**File**: `apps/web/lib/agent-child-runner.ts:55`

```typescript
// ❌ VULNERABLE CODE
env: {
  ANTHROPIC_API_KEY: env.ANTH_API_SECRET,  // Overrides OAuth
  HOME: process.env.HOME,
  ...
}
```

When `ANTHROPIC_API_KEY` environment variable is set, Claude Code **prioritizes direct API mode** over OAuth credentials, even if valid credentials exist. The hardcoded API key in `.env` was expired/invalid, causing authentication failure.

**Why this was wrong**: The SDK has two authentication modes:
- **Direct API mode**: Uses `ANTHROPIC_API_KEY` env var → HTTP → Anthropic servers
- **ProcessTransport mode**: Uses OAuth credentials → spawns Claude Code subprocess → OAuth → Anthropic

Passing an API key forces direct API mode and **completely bypasses the OAuth flow** that was needed for ProcessTransport.

#### Problem 2: Credential Access After Privilege Drop

The child runner drops from `root` to workspace user (UID 993) via `setuid()`. Before the fix, it couldn't access `/root/.claude/.credentials.json` due to file permissions (`-rw------- root:root`).

#### Problem 3: Temp Directory Ownership

The temporary home directory created for credentials was owned by `root:root`, preventing Claude Code (running as UID 993) from writing to `.claude.json`.

---

## What Went Wrong: The Failed Debugging Process

### Failed Attempt #1: Remove API Key
**Thinking**: "If we remove the hardcoded API key, Claude Code will use session environment"
**Result**: ❌ Failed - PM2 processes don't inherit Claude Code CLI session environment

**Lesson**: Didn't understand the difference between process environments and CLI session environment.

### Failed Attempt #2: Use OAuth Token as API Key
**Thinking**: "The credentials file has an access token; let's use that instead of the API key"
**Result**: ❌ Failed - OAuth tokens aren't valid for direct Anthropic API authentication

```typescript
// ❌ WRONG
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
apiKey = creds.claudeAiOauth.accessToken  // OAuth token ≠ API key
```

**Lesson**: Confused two completely different authentication systems (OAuth vs. API keys)

### Failed Attempt #3: Inject Credentials via PM2 Config
**Thinking**: "PM2 can set environment variables that Next.js will use"
**Result**: ❌ Failed - Next.js doesn't reload `process.env` from PM2 ecosystem config changes

**Lesson**: Misunderstood how Next.js loads and caches environment variables

### Failed Attempt #4: Restore Original Key
**Thinking**: "The original hardcoded API key should work"
**Result**: ❌ Failed - Confirmed the key was expired/revoked

**Lesson**: This actually provided valuable confirmation that environment variable configuration was the issue, not the specific key value

### Root Problem with Debugging

The core issue was **misunderstanding the authentication architecture**:

1. **Confusion about credential types**:
   - OAuth tokens (`REDACTED_TOKEN`) for browser authentication
   - API keys (`REDACTED_KEY`) for direct API calls
   - These are **completely different and not interchangeable**

2. **Confusion about SDK behavior**:
   - Didn't know that `ANTHROPIC_API_KEY` env var forces direct API mode
   - Didn't understand ProcessTransport vs. Direct API modes
   - Didn't know that OAuth credentials in `.credentials.json` were the correct authentication method

3. **Process Issue**:
   - No stderr capture from Claude Code subprocess
   - Only shallow validation (key presence, not validity or correct mode)
   - Trying to mix both direct API and OAuth simultaneously

---

## The Actual Fixes

### Fix #1: Remove `settingSources` Parameter (Tool Permission Bypass)

**File**: `apps/web/app/api/claude/stream/route.ts`

```typescript
// ✅ FIXED CODE
const claudeOptions: Options = {
  allowedTools: ["Write", "Edit", "Read", "Glob", "Grep",
                 "mcp__workspace-management__restart_dev_server",
                 "mcp__tools__list_guides",
                 "mcp__tools__get_guide"],
  settingSources: [],  // Explicit: disable project settings loading
}
```

**Why this works**:
- Whitelist security model (only explicitly allowed tools available)
- SDK can no longer load default tool configurations
- No maintenance burden (no blacklist of dangerous tools)
- Self-documenting code

### Fix #2: Copy Credentials Before Privilege Drop (Auth Failure)

**File**: `apps/web/scripts/run-agent.mjs:34-49`

```javascript
// ✅ FIXED: Copy credentials WHILE STILL ROOT
const originalHome = process.env.HOME || "/root"
const tempHome = `/tmp/claude-home-${targetUid}`
const credSource = join(originalHome, ".claude", ".credentials.json")
const credDest = join(tempHome, ".claude", ".credentials.json")

if (existsSync(credSource)) {
  // Create .claude directory
  mkdirSync(join(tempHome, ".claude"), { recursive: true, mode: 0o755 })

  // Copy credentials (only possible as root)
  copyFileSync(credSource, credDest)

  // Change ownership BEFORE privilege drop (irreversible operation)
  chownSync(tempHome, targetUid, targetGid)
  chownSync(join(tempHome, ".claude"), targetUid, targetGid)
  chownSync(credDest, targetUid, targetGid)

  // Set HOME to temp directory
  process.env.HOME = tempHome
}

// THEN drop privileges (irreversible)
process.setgid(targetGid)
process.setuid(targetUid)
```

**Key insight**: Privilege drops are irreversible. Must copy and chown resources **before** calling `setuid()`.

### Fix #3: Remove API Key Environment Variable (Auth Failure)

**File**: `apps/web/lib/agent-child-runner.ts:52-62`

```typescript
// ✅ FIXED: Remove ANTHROPIC_API_KEY, allow OAuth
const child = spawn(process.execPath, [runnerPath], {
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    // ✅ REMOVED: ANTHROPIC_API_KEY: env.ANTH_API_SECRET
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
- Reads credentials from `$HOME/.claude/.credentials.json` (now accessible)
- Uses valid OAuth token instead of expired API key
- ProcessTransport mode works correctly

### Fix #4: Clean Up PM2 Config

**File**: `ecosystem.config.js`

Removed the credential injection attempt that was trying to use OAuth tokens as API keys.

---

## Complete Corrected Authentication Flow

### Request Path
```
Browser → terminal.goalive.nl → Caddy → localhost:8999 (Next.js as root)
```

### Credential Setup (As Root)
```bash
# Copy credentials from root's home to temp directory
cp /root/.claude/.credentials.json → /tmp/claude-home-993/.claude/.credentials.json

# Change ownership to workspace user
chown -R 993:983 /tmp/claude-home-993/

# Set HOME for child process
export HOME=/tmp/claude-home-993
```

### Privilege Drop (Irreversible)
```bash
setgid(983)   # Drop to workspace group
setuid(993)   # Drop to workspace user
# Now running as site-kranazilie-nl (UID 993)
```

### SDK Execution
```javascript
// Workspace user calls SDK
const agentQuery = query({
  prompt: "user message",
  options: {
    cwd: "/srv/webalive/sites/kranazilie.nl/user",
    allowedTools: ["Write", "Edit", "Read", "Glob", "Grep", ...],
    settingSources: [],  // ✅ Don't load default tools
  }
})
```

### Claude Code Subprocess
```bash
# SDK auto-detects Claude Code executable
which claude → /usr/local/bin/claude

# Spawns Claude Code as workspace user (UID 993)
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
    "accessToken": "REDACTED_TOKEN",  # ✅ Valid
    "refreshToken": "REDACTED_TOKEN",
    "expiresAt": 1762204811973
  }
}

# Connects to Anthropic using OAuth ✅
```

---

## Multi-Tenant Isolation (How It Actually Works)

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

**Kernel-Level Enforcement**: Linux kernel prevents UID 993 from accessing files owned by UID 994 or credentials at different temp paths. This is **OS-level isolation, not application logic**.

---

## Lessons Learned

### What I Got Wrong

1. **Confused authentication systems**: Didn't understand OAuth tokens are different from API keys
2. **Misunderstood SDK architecture**: Didn't know `ANTHROPIC_API_KEY` env var forces direct API mode
3. **Ignored environment variable precedence**: Didn't realize env vars override credential files
4. **Didn't understand privilege drop implications**: Thought copying credentials after `setuid()` would work
5. **Shallow debugging**: Only looked at error messages, not the authentication mode being used
6. **Mixed concerns**: Tried to fix both authentication AND tool restriction at the same time
7. **Didn't consult documentation**: Didn't check SDK docs about `settingSources` override behavior

### What Went Right

1. **Systematic layer-by-layer analysis**: Eventually traced every component (root → child → subprocess → SDK)
2. **Manual reproduction**: Running `sudo -u site-kranazilie-nl claude --help` revealed the real permission error
3. **Tracked failed attempts**: Prevented repeating the same approaches
4. **Understood the isolation model**: Eventually grasped the multi-UID privilege structure
5. **Documentation of investigation**: Created detailed analysis that led to the fix

### Critical Insights

1. **Environment variables have implicit behavior**: `ANTHROPIC_API_KEY` silently changes authentication mode
2. **OAuth ≠ API keys**: Completely different systems; tokens aren't interchangeable
3. **Privilege drops are irreversible**: Must copy/chown resources **before** `setuid()`
4. **ProcessTransport mode requires specific setup**: Correct `$HOME`, credentials, and **no conflicting env vars**
5. **Directory ownership hierarchy matters**: Parent directories must be writable by target user
6. **Settings parameters override whitelists**: `settingSources` overrides `allowedTools` in SDK
7. **Symptoms can be misleading**: "Invalid API key" meant wrong authentication mode, not wrong key value

---

## Prevention Measures

### 1. Environment Variable Discipline

**Rule**: Never pass `ANTHROPIC_API_KEY` to Claude Code when using ProcessTransport mode.

```typescript
// ❌ BAD
env: {
  ANTHROPIC_API_KEY: "REDACTED_KEY",  // Forces direct API mode
  HOME: "/tmp/claude-home-993"
}

// ✅ GOOD
env: {
  HOME: "/tmp/claude-home-993",  // Claude Code finds credentials here
  PATH: process.env.PATH
}
```

### 2. Credential Copy Pattern

**Rule**: Always copy credentials **before** dropping privileges.

```javascript
// Correct order:
1. Copy /root/.claude/.credentials.json (as root)
2. chown to target UID (as root)
3. setuid() to drop privileges (irreversible)
4. Spawn Claude Code (as target UID, can access owned credentials)
```

### 3. Tool Restriction Pattern

**Rule**: Never use `settingSources` with `allowedTools`.

```typescript
// ❌ BAD
{
  allowedTools: ["Write", "Edit", ...],
  settingSources: ["project"]  // Overrides allowedTools!
}

// ✅ GOOD
{
  allowedTools: ["Write", "Edit", ...],
  settingSources: []  // Explicit: disable setting loading
}
```

### 4. Directory Ownership

**Rule**: Entire temp home directory must be owned by target UID.

```javascript
// ❌ BAD: Only subdirectory owned
chownSync(join(tempHome, ".claude"), targetUid, targetGid)

// ✅ GOOD: Entire tree owned
chownSync(tempHome, targetUid, targetGid)
chownSync(join(tempHome, ".claude"), targetUid, targetGid)
chownSync(credDest, targetUid, targetGid)
```

### 5. Add Validation

```javascript
// Warn if conflicting environment variables
if (process.env.ANTHROPIC_API_KEY && processTransportMode) {
  console.warn("⚠️  ANTHROPIC_API_KEY set - will override OAuth credentials")
}

// Verify credential file accessibility after privilege drop
const canAccessCreds = accessSync(credDest)
if (!canAccessCreds) {
  throw new Error("Credentials not accessible after privilege drop")
}
```

---

## Files Modified

1. **`apps/web/app/api/claude/stream/route.ts`** - Removed `settingSources: ["project"]`
2. **`apps/web/scripts/run-agent.mjs`** - Added credential copy before privilege drop
3. **`apps/web/lib/agent-child-runner.ts`** - Removed `ANTHROPIC_API_KEY` env var
4. **`ecosystem.config.js`** - Removed credential injection attempt

---

## Testing Verification

### Manual Tests (Post-Fix)

```bash
# Test 1: Verify tool restrictions
curl -X POST http://localhost:8999/api/claude/stream \
  -d '{"message": "use bash to list files"}' \
# Expected: "tool not available" error for Bash

# Test 2: Verify credentials accessible
sudo -u site-kranazilie-nl cat /tmp/claude-home-993/.claude/.credentials.json
# Expected: OAuth credentials readable

# Test 3: Verify Claude Code subprocess
sudo -u site-kranazilie-nl env HOME=/tmp/claude-home-993 /usr/local/bin/claude --help
# Expected: Help text displays (no permission errors)
```

### End-to-End Test

1. Send message via web UI to workspace
2. Verify credentials copied to `/tmp/claude-home-{uid}/`
3. Verify credentials owned by workspace user
4. Verify Claude Code spawns successfully
5. Verify response received without authentication errors
6. Verify logs show only allowed tools in system:init message

---

## Future Improvements

- [ ] Add validation: Warn if `ANTHROPIC_API_KEY` set in ProcessTransport mode
- [ ] Improve error logging: Capture Claude Code subprocess stderr
- [ ] Add health check: Verify credential file accessibility post-privilege-drop
- [ ] Monitoring: Alert if temp credential copies fail
- [ ] Documentation: Add "How Claude Code Authentication Works" explainer
- [ ] Consider: Shared credential cache to avoid per-request copying

---

## Key Takeaways

### For Multi-Tenant Systems

1. **Privilege boundaries affect credential access**: Plan credential flow across all privilege levels
2. **Each UID needs its own credential copy**: Isolation requires duplication
3. **Ownership must be complete**: Parent directories, subdirectories, and files

### For Claude Code Integration

1. **OAuth vs API key matters**: Environment variables change SDK behavior
2. **ProcessTransport mode is preferred**: Needed for Claude Code's advanced tooling
3. **Implicit mode detection is fragile**: Presence of `ANTHROPIC_API_KEY` silently changes behavior
4. **Settings override whitelists**: `settingSources` parameter overrides `allowedTools`
5. **$HOME must be writable**: Claude Code needs to write `.claude.json` config

### For Debugging Complex Systems

1. **Trace authentication end-to-end**: From browser → server → child → subprocess
2. **Test manually at each privilege level**: `sudo -u {user}` reveals permission issues
3. **Document failed attempts**: Prevents debugging loops
4. **Understand before fixing**: Quick fixes without understanding cause more issues
5. **Check implicit behavior**: Environment variables and SDK parameters have hidden effects

---

**Most Critical Learning**: When integrating Claude Code via SDK in ProcessTransport mode:
- **Never set `ANTHROPIC_API_KEY` environment variable** (forces direct API mode, breaks OAuth)
- **Never use `settingSources` with `allowedTools`** (settings override whitelists)
- **Always copy/chown credentials before privilege drop** (setuid is irreversible)
