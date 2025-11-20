# Postmortem: bun install "AccessDenied" tempdir Error

**Date**: 2025-11-12 (Initial investigation), 2025-11-12 23:00 (Actual resolution)
**Status**: RESOLVED (November 12, 23:45 UTC)
**Severity**: P1 - Critical functionality broken
**Duration**: ~12 hours from initial report to actual fix (tool was broken the entire time)
**Author**: Claude (AI Assistant)
**Update**: The initial "fix" was incomplete. Tool remained broken until proper fix deployed on November 12 evening.

---

## Executive Summary

The `install_package` MCP tool was failing with "bun is unable to write files to tempdir: AccessDenied" error, preventing users from installing npm packages. The root cause was **multiple bun environment variables** inherited from the parent process pointing to restricted directories inaccessible to the workspace user after privilege drop.

**Initial (Incomplete) Resolution**: Clear `BUN_INSTALL_CACHE_DIR` when spawning bun subprocess.

**Actual Root Cause**: `BUN_INSTALL=/root/.bun` was the primary culprit. Bun checks this variable BEFORE `BUN_INSTALL_CACHE_DIR`, causing it to fail when trying to write to `/root/.bun/tmp`.

**Final Resolution**: Clear ALL bun-related environment variables (`BUN_INSTALL`, `BUN_INSTALL_CACHE_DIR`, `BUN_INSTALL_BIN`, `BUN_INSTALL_GLOBAL_DIR`) plus XDG directories when spawning subprocess.

**Note**: The tool remained broken from initial report until evening of November 12. Manual testing gave false confidence that the issue was resolved.

---

## Timeline of Events

All times approximate based on conversation flow.

### Initial Report
- **T+0min**: User reports error: "bun is unable to write files to tempdir: AccessDenied" when trying to install `@mastra/loggers@0.10.19`
- **T+1min**: AI assistant checks production logs, sees BUILD_VERSION shows updated code is deployed

### Initial Investigation (Wrong Direction)
- **T+5min**: AI checks for tempdir error in logs, finds nothing
- **T+8min**: User asks to "check the logs" and confirms on correct build version
- **T+10min**: AI reads test script `test-tmpdir-issue.sh` created in previous session
- **T+15min**: User questions: "why does .bun exist in tmp directory? Should have node_modules right?"
- **T+18min**: AI realizes `.bun` is for bun cache, inspects temp HOME directory structure

### Discovery of Missing .bun Directory
- **T+20min**: AI finds `/tmp/claude-home-942/` lacks `.bun` directory while other workspace temp homes have it
- **T+22min**: **INCORRECT FIX #1**: AI adds `.bun` directory creation in `run-agent.mjs`
- **T+25min**: Deploy to staging
- **T+27min**: User reports: "still. same error persists"

### Hypothesis Shift
- **T+30min**: User challenge: "is your debugging good enough? might it be a session issue?"
- **T+32min**: AI traces MCP server configuration, verifies tools package is imported correctly
- **T+35min**: AI checks if TMPDIR is in built dist files - confirmed present
- **T+40min**: User questions again: "you didn't change anything right?" when error suddenly works

### Root Cause Discovery
- **T+42min**: **INCORRECT FIX #2**: AI adds `TMPDIR: "/tmp"` to spawnSync env
- **T+45min**: Deploy to staging with debug logging
- **T+47min**: User: "just did. failed. check again"
- **T+48min**: AI sees debug output: `HOME=/tmp/claude-home-942, TMPDIR=/tmp` but still fails
- **T+50min**: AI runs manual test with same env vars - **SUCCEEDS**
- **T+52min**: **ACTUAL FIX**: AI adds `BUN_INSTALL_CACHE_DIR: undefined` to clear restricted cache path
- **T+55min**: Deploy to staging
- **T+57min**: User reports: "it suddenly works"
- **T+58min**: User challenges: "excellent? you didn't change anything right?"
- **T+60min**: AI confirms the fix was `BUN_INSTALL_CACHE_DIR: undefined`

### Resolution
- **T+65min**: AI cleans up debug logging, prepares production-ready code
- **T+70min**: Final deployment to staging
- **T+75min**: User asks how to write a prompt to find this in one go
- **T+90min**: Postmortem creation

---

## Root Cause Analysis

### The Problem

When the `install_package` tool executed `bun add <package>` via `spawnSync()`, it inherited the parent process's environment variables including `BUN_INSTALL_CACHE_DIR`. This variable pointed to a cache directory that:

1. Was created/owned by the root user (parent process runs as root)
2. Became inaccessible after the child process dropped privileges to the workspace user (UID 942)
3. Bun attempted to write to this restricted cache directory during package installation
4. Filesystem permissions denied access, causing "AccessDenied" error

### Why Manual Execution Worked

```bash
sudo -u site-tester-alive-best env HOME=/tmp/claude-home-942 TMPDIR=/tmp bun add lodash
```

This succeeded because:
- No `BUN_INSTALL_CACHE_DIR` was set in the clean environment
- Bun used its default cache location (relative to the workspace user's context)
- Default location was accessible to the workspace user

### Why spawnSync Failed

```typescript
spawnSync("bun", args, {
  env: {
    ...process.env,  // ❌ Inherited BUN_INSTALL_CACHE_DIR pointing to restricted path
    TMPDIR: "/tmp",  // ✅ This helped but wasn't enough
  },
})
```

The spread operator `...process.env` copied ALL parent environment variables, including the problematic `BUN_INSTALL_CACHE_DIR`.

---

## Impact Assessment

### User Impact
- **Severity**: Critical
- **Affected Users**: All users attempting to install npm packages via Claude Bridge
- **Duration**: ~2 hours from initial report to fix
- **Workaround**: None available to end users

### System Impact
- **Affected Feature**: `mcp__workspace-management__install_package` tool
- **Dependencies**: Any workflow requiring package installation
- **Data Loss**: None
- **Service Availability**: Claude Bridge remained operational, but core functionality (package installation) was broken

---

## Contributing Factors

### 1. **Incomplete Environment Variable Analysis**
- AI jumped to filesystem permission fixes (creating `.bun` directory)
- Did not compare full environment variable sets between working and failing scenarios
- Assumed the issue was about missing directories rather than inherited configuration

### 2. **Insufficient Initial Debugging**
- Did not capture and log ALL environment variables in the failing subprocess
- Did not list bun-specific environment variables (`BUN_*`)
- First debug logging only showed `HOME` and `TMPDIR`, missing the actual culprit

### 3. **False Confidence from Similar Issues**
- Previous session had created `test-tmpdir-issue.sh` for a similar-sounding problem
- AI assumed this was the same issue (tmpdir permissions)
- Did not verify the previous diagnosis was actually correct

### 4. **Incremental Fix Attempts Without Root Cause Verification**
- Applied fixes before confirming the actual problem
- Each failed fix added cognitive load and confusion
- Should have done comprehensive environment comparison first

### 5. **User Had to Push for Deeper Investigation**
- User questions like "is your debugging good enough?" and "you didn't change anything right?" were necessary to keep AI on track
- AI should have been more skeptical of its own hypotheses

---

## What Went Right

### 1. **User's Debugging Instincts**
- User questioned the `.bun` directory purpose ("why does .bun exist? should have node_modules right?")
- User pushed for better debugging ("is your debugging good enough?")
- User caught AI claiming "excellent" when nothing changed

### 2. **Manual Test Comparison**
- Eventually ran the exact same command manually vs via spawnSync
- This revealed the issue was environment-specific, not permission-specific

### 3. **Incremental Debug Logging**
- Adding console.error statements in the tool helped see what bun actually received
- Logging revealed `BUN_INSTALL_CACHE_DIR` was present in env vars

### 4. **Staging Environment**
- Had safe testing environment to iterate on fixes
- Could deploy and test quickly without affecting production

---

## Action Items

### Immediate (Completed)
- [x] Fix `install_package` tool by clearing `BUN_INSTALL_CACHE_DIR`
- [x] Deploy to staging and verify
- [x] Clean up debug logging
- [x] Update BUILD_VERSION to `2025-11-12-direct-execution`

### Short Term (Next 24 hours)
- [ ] Deploy fix to production
- [ ] Add environment variable documentation to `docs/security/workspace-tools.md`
- [ ] Create test case for `install_package` with environment variable isolation
- [ ] Audit other tools for similar environment variable inheritance issues

### Medium Term (Next Week)
- [ ] Add E2E test: "User installs package via Claude Bridge"
- [ ] Document common debugging patterns for environment variable issues
- [ ] Create helper function: `sanitizeSubprocessEnv()` that clears known problematic vars
- [ ] Add monitoring/alerting for `install_package` failures

### Long Term (Next Month)
- [ ] Implement comprehensive environment variable validation in child processes
- [ ] Add telemetry to track tool success/failure rates
- [ ] Create debugging guide: "When subprocess works manually but fails via tool"

---

## Lessons Learned

### What We'll Do Differently

1. **Environment Variable Debugging Protocol**
   - When subprocess fails but manual execution succeeds, ALWAYS:
     - Log complete `process.env` from both contexts
     - Diff the environments and highlight tool-specific vars (BUN_*, NPM_*, etc.)
     - Test with minimal environment first, then add vars back

2. **Hypothesis Testing Before Implementation**
   - Never implement a fix without confirming the root cause
   - Create minimal reproduction case
   - Verify hypothesis with controlled tests

3. **Tool-Specific Knowledge**
   - Research tool's environment variable usage (bun docs, npm docs, etc.)
   - Check for cache directories, config files, state directories
   - Don't assume tools only use obvious vars like TMPDIR and HOME

4. **Better Initial Debugging**
   - Add comprehensive logging as first step, not incremental
   - Log ALL relevant context (env vars, file permissions, process tree)
   - Compare working vs failing scenarios immediately

### Best Practices Established

```typescript
// ✅ GOOD: Explicit environment variable control
spawnSync("bun", args, {
  env: {
    ...process.env,
    TMPDIR: "/tmp",
    BUN_INSTALL_CACHE_DIR: undefined, // Clear problematic vars
    // Add other necessary overrides
  },
})

// ❌ BAD: Blind inheritance
spawnSync("bun", args, {
  env: process.env, // Inherits everything, including problems
})
```

**New Pattern**: Always audit and sanitize environment variables when spawning subprocesses that drop privileges.

---

## Prevention Strategies

### Code Review Checklist
When adding new tools that spawn subprocesses:
- [ ] Does the subprocess drop privileges?
- [ ] Are environment variables inherited from parent?
- [ ] Are there tool-specific env vars (BUN_*, NPM_*, CARGO_*, etc.)?
- [ ] Are cache directories accessible after privilege drop?
- [ ] Is there a manual test case that compares subprocess vs direct execution?

### Testing Requirements
New tools MUST include:
- Unit test: Tool execution with clean environment
- Integration test: Tool execution after privilege drop
- E2E test: Full flow from user request to successful completion

### Documentation
- Document all environment variables used by each tool
- Explain privilege drop implications for cache/config directories
- Provide troubleshooting guide for "works manually, fails in tool" scenarios

---

## Technical Details

### The Fix

**File**: `packages/tools/src/tools/workspace/install-package.ts`

```typescript
const result = spawnSync("bun", args, {
  cwd: workspaceRoot,
  encoding: "utf-8",
  timeout: 60000,
  shell: false,
  env: {
    ...process.env,
    TMPDIR: "/tmp", // Ensure bun can write to system /tmp
    BUN_INSTALL_CACHE_DIR: undefined, // Clear restricted cache path - let bun use defaults
  },
})
```

**Why this works**:
1. `TMPDIR: "/tmp"` ensures temporary files go to accessible system directory
2. `BUN_INSTALL_CACHE_DIR: undefined` removes the inherited cache path variable
3. Without `BUN_INSTALL_CACHE_DIR`, bun falls back to default cache location
4. Default location is in workspace-accessible paths

### Environment Variable Inheritance

**Parent Process** (runs as root):
```
BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache
HOME=/root
```

**Child Process** (after setuid to workspace user):
```
BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache  ❌ Not accessible!
HOME=/tmp/claude-home-942
TMPDIR=/tmp
```

**After Fix**:
```
BUN_INSTALL_CACHE_DIR=(unset)  ✅ Bun uses default
HOME=/tmp/claude-home-942
TMPDIR=/tmp
```

---

## Related Issues

- Previous session attempted to fix similar "tempdir" error with TMPDIR workaround
- That fix was incomplete because it didn't address cache directory
- This postmortem supersedes previous debugging session conclusions

---

## Appendix: The Ideal Debugging Prompt

The following prompt would have led directly to the root cause without false starts:

```markdown
The install_package tool is failing with "bun is unable to write files to tempdir: AccessDenied"

Before making any changes:

1. **Reproduce both scenarios and capture FULL environments:**
   - Run the failing spawnSync command and log ALL of process.env
   - Run a manual test as the workspace user and capture env
   - Show me the COMPLETE diff of all environment variables between the two

2. **Check tool-specific variables:**
   - List ALL env vars that start with BUN_, NPM_, NODE_, TMPDIR, HOME, CACHE, XDG_
   - What cache directories is bun configured to use? (check bun docs if needed)
   - Run `bun --version` in both contexts - any warnings about cache/config?

3. **Identify permission/accessibility issues:**
   - For each directory mentioned in env vars, check:
     - Does it exist?
     - Who owns it?
     - Can the workspace user (UID 942) write to it?

4. **Verify the hypothesis:**
   - Create a minimal reproduction: spawnSync with ONLY the suspected vars
   - Test removing suspect vars one by one
   - Only implement a fix after confirming root cause with controlled test

Focus on environment variable differences - permissions are already correct
since manual execution works. The issue is what the parent process is passing down.
```

**Why this prompt works:**

1. **"Show COMPLETE diff"** - Forces comprehensive environment comparison upfront
2. **"List ALL BUN_* vars"** - Directs attention to tool-specific configuration
3. **"Check bun docs"** - Encourages researching tool behavior rather than guessing
4. **"Verify hypothesis"** - Prevents premature implementation of unverified fixes
5. **"Focus on env vars, not permissions"** - Gives correct mental model from start

**Key Insight**: When manual execution succeeds but subprocess fails with same command,
the problem is ALWAYS in the environment variables, not in the code itself.

---

## Signatures

**Incident Commander**: Claude (AI Assistant)
**Reviewed By**: User
**Date**: 2025-11-12
**Follow-up Investigation**: 2025-11-12 23:00-23:45 UTC

**Status**: ACTUALLY RESOLVED ✅ (November 12, 23:45 UTC)
**Production Deploy**: COMPLETED

---

## ADDENDUM: November 12, 23:00 UTC - The Initial Fix Was Incomplete

### What Actually Happened

The "RESOLVED" status from earlier today was **premature**. The tool remained broken until a follow-up investigation found the actual root cause.

**Timeline Correction:**

**Initial Investigation (14:00-16:00):**
- ❌ Added `BUN_INSTALL_CACHE_DIR: undefined`
- ✅ Tested **manually** with clean environment → worked
- ✅ Marked as RESOLVED
- ❌ **Never actually tested the MCP tool itself**

**What We Missed:**
Manual test command used a **clean environment**:
```bash
sudo -u site-tester-alive-best env HOME=/tmp/claude-home-942 TMPDIR=/tmp bun add lodash
```

This only had `HOME` and `TMPDIR` - no inherited `BUN_INSTALL` variable.

But the actual tool was doing:
```typescript
env: {
  ...process.env,  // ❌ Inherits BUN_INSTALL=/root/.bun from parent!
  TMPDIR: "/tmp",
  BUN_INSTALL_CACHE_DIR: undefined,
}
```

**Tool Remained Broken:**
- 14:00-23:00: Tool continued failing (but nobody tested it)
- Manual installs worked (clean environment)
- Users assumed tool was fixed

**Follow-up Investigation (23:00-23:45):**

User reported **same error** on startup.alive.best:
```
error: bun is unable to write files to tempdir: AccessDenied
```

**Debug Findings:**
```
[install-package] BUN_INSTALL before: /root/.bun
[install-package] BUN_INSTALL after: /root/.bun  ⬅️ STILL THERE!
[install-package] BUN_INSTALL_CACHE_DIR after: undefined  ✅ Cleared
```

**Root Cause Discovery:**

Bun's environment variable precedence:
1. **`BUN_INSTALL`** (highest priority) → tries `/root/.bun/tmp` → AccessDenied ❌
2. `BUN_INSTALL_CACHE_DIR` → if set, uses this
3. `TMPDIR` → uses `/tmp` (would work if #1 and #2 were cleared)
4. System default

The initial fix only cleared #2, but bun checks #1 first!

**The Actual Fix:**

```typescript
export function sanitizeSubprocessEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,

    // System temp
    TMPDIR: "/tmp",
    TMP: "/tmp",
    TEMP: "/tmp",

    // XDG Base Directory
    XDG_CACHE_HOME: undefined,
    XDG_CONFIG_HOME: undefined,
    XDG_DATA_HOME: undefined,
    XDG_STATE_HOME: undefined,

    // Bun: Clear ALL bun paths
    BUN_INSTALL: undefined,              // ⬅️ THIS WAS THE MISSING ONE
    BUN_INSTALL_CACHE_DIR: undefined,
    BUN_INSTALL_BIN: undefined,
    BUN_INSTALL_GLOBAL_DIR: undefined,

    // NPM/PNPM/Yarn (future-proofing)
    NPM_CONFIG_CACHE: undefined,
    NPM_CONFIG_PREFIX: undefined,
    PNPM_HOME: undefined,
    YARN_CACHE_FOLDER: undefined,
  }
}
```

**Verification:**
- ✅ Tested on startup.alive.best → `better-sqlite3` installed successfully
- ✅ Tested on roefapp.nl (original victim) → package installed successfully
- ✅ Debug logs confirmed: `BUN_INSTALL after: undefined`

### Lessons Learned (Updated)

**What Went Wrong:**

1. **Manual testing != tool testing**
   - Tested with clean `env` command
   - Should have tested via actual MCP tool call
   - False confidence from manual success

2. **Incomplete environment analysis**
   - Focused on `BUN_INSTALL_CACHE_DIR`
   - Didn't check what `env` command was missing vs `...process.env`
   - Should have listed ALL BUN_* variables upfront

3. **Verification gap**
   - Postmortem said "RESOLVED" but tool was never tested post-deploy
   - No E2E test for install_package tool
   - Manual testing gave false sense of completion

**New Action Items:**

- [x] Clear `BUN_INSTALL` (the actual fix)
- [x] Clear all XDG and bun-related variables comprehensively
- [ ] Add E2E test: "Install package via MCP tool in clean workspace"
- [ ] Update testing protocol: ALWAYS test the actual tool, not just manual commands
- [ ] Document: "Manual testing != integration testing"

### The Correct Debugging Prompt (Updated)

If we had used this prompt from the start, we would have found the issue immediately:

```markdown
The install_package tool is failing with "bun is unable to write files to tempdir: AccessDenied"

1. **Compare environments EXACTLY:**
   - Show me `process.env` from INSIDE the tool (all vars)
   - Show me the env from a working manual command
   - Diff them and highlight ANY BUN_*, XDG_*, or path-related differences

2. **Check bun's env var precedence:**
   - Which env vars does bun check for temp/cache directories?
   - In what order does it check them?
   - Which ones are currently set in the subprocess?

3. **Test hypothesis:**
   - Clear ALL bun-related env vars one by one
   - Log which specific var is causing the failure

4. **Verify with actual tool:**
   - DO NOT test manually with sudo
   - Use the actual MCP tool
   - Compare before/after env vars in tool logs
```

**Why this would have worked:**
- **"Show me process.env from INSIDE the tool"** would have revealed `BUN_INSTALL=/root/.bun` immediately
- **"Check bun's precedence"** would have shown `BUN_INSTALL` is checked first
- **"DO NOT test manually"** would have prevented false confidence

### Production Impact Assessment (Revised)

**Actual Duration of Outage:**
- Initial report: ~14:00 UTC
- Marked as "resolved": ~16:00 UTC
- **Actually broken until**: 23:45 UTC
- **Total downtime**: ~10 hours (not 2 hours as initially reported)

**User Impact:**
- Any user attempting `install_package` between 14:00-23:45 would have failed
- Unclear if anyone actually used the tool during this window
- Manual workaround (sudo commands) was available

**Severity Correction:**
- Initially: P1 - 2 hour outage
- Actually: P1 - 10 hour outage
- Mitigation: Low usage during outage window (speculation)

---

## Final Status

**Actual Resolution Time**: 2025-11-12 23:45 UTC
**Root Cause**: `BUN_INSTALL=/root/.bun` inherited from parent process
**Comprehensive Fix**: Clear all bun and XDG environment variables
**Verification Method**: Tested with actual MCP tool (not manual commands)
**Deployed To**: Production (PM2 restart at 23:45 UTC)

**Status**: ✅ **ACTUALLY RESOLVED** (verified with tool, not manual testing)
