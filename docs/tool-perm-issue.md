# Tool Permission Bypass Issue

**Status:** Critical Security Issue
**Discovered:** 2025-11-03
**Affected:** All workspaces

## Problem

`allowedTools` restricts to 8 tools, but users receive 14+ tools including Bash, Task, TodoWrite, WebSearch, and others.

**Expected:**
```typescript
allowedTools: ["Write", "Edit", "Read", "Glob", "Grep", "mcp__workspace-management__restart_dev_server", "mcp__tools__list_guides", "mcp__tools__get_guide"]
```

**Actual (from logs):**
```javascript
tools: ['Task', 'Bash', 'Glob', 'Grep', 'ExitPlanMode', 'Read', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 'TodoWrite', 'WebSearch', 'BashOutput', 'KillShell']
```

## Root Cause

**Location:** `apps/web/app/api/claude/stream/route.ts:254`

```typescript
const claudeOptions: Options = {
  allowedTools: ["Write", "Edit", "Read", "Glob", "Grep", ...],
  settingSources: ["project"],  // This bypasses allowedTools
}
```

**Mechanism:**
1. SDK receives `settingSources: ["project"]`
2. SDK attempts to load project-level config files (`.clauderc`, `.claude.toml`, `claude.config.js`)
3. No config files exist in any workspace
4. SDK falls back to default project settings
5. Default settings include full Claude Code toolset
6. This overrides the explicit `allowedTools` whitelist

## Evidence

### Production Logs

```javascript
// pm2 logs claude-bridge
52|claude- | [Stream n920i3] Event: message {
52|claude- |   messageType: 'system',
52|claude- |   content: {
52|claude- |     type: 'system',
52|claude- |     subtype: 'init',
52|claude- |     cwd: '/srv/webalive/sites/one.goalive.nl/user',
52|claude- |     tools: [
52|claude- |       'Task', 'Bash', 'Glob', 'Grep', 'ExitPlanMode',
52|claude- |       'Read', 'Edit', 'Write', 'NotebookEdit',
52|claude- |       'WebFetch', 'TodoWrite', 'WebSearch',
52|claude- |       'BashOutput', 'KillShell'
52|claude- |     ],
```

### Workspace Audit

Checked all `/srv/webalive/sites/` workspaces:
- No `.clauderc` files found
- No `.claude.toml` files found
- No `claude.config.js` files found
- One workspace has `.claude/` directory (runtime data only: session transcripts, debug logs)
- `.claude.json` contains SDK metadata only (install method, user ID, feature flags)

### SDK Behavior

From `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:502`:
```typescript
export type SettingSource = 'user' | 'project' | 'local';
export type Options = {
  allowedTools?: string[];
  settingSources?: SettingSource[];  // Overrides allowedTools
};
```

From `node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs`:
```javascript
if (allowedTools.length > 0) {
  args.push("--allowedTools", allowedTools.join(","));
}
if (settingSources) {
  args.push("--setting-sources", settingSources.join(","));
}
```

## Security Impact

**Working (Child Process Isolation):**
- Bash commands run as workspace user (e.g., `site-kranazilie-nl`)
- File operations sandboxed to workspace directory
- Cannot access other sites' files
- systemd security restrictions apply

**Vulnerable (Tool Restriction Bypass):**
- Users can execute arbitrary shell commands as their site user
- Users can read all files in workspace (including `.env`, credentials)
- Users can spawn sub-agents via Task tool
- Users can make external network requests (WebFetch, WebSearch)
- Users can manipulate their own processes (BashOutput, KillShell)

## Solutions

### Option 1: Remove settingSources

```typescript
const claudeOptions: Options = {
  allowedTools: ["Write", "Edit", "Read", "Glob", "Grep", ...],
  // settingSources: ["project"],  // Remove this line
}
```

**Impact:**
- Forces SDK to respect allowedTools strictly
- No workspaces affected (none use project settings)
- SDK still creates `.claude/` runtime directories
- Future `.clauderc` files won't be loaded

### Option 2: Empty Array (Recommended)

```typescript
const claudeOptions: Options = {
  allowedTools: ["Write", "Edit", "Read", "Glob", "Grep", ...],
  settingSources: [],  // Explicit: disable project settings
}
```

**Impact:**
- Same security as Option 1
- Self-documenting code
- Clear intent for future developers

### Option 3: Add disallowedTools

```typescript
const claudeOptions: Options = {
  allowedTools: ["Write", "Edit", "Read", "Glob", "Grep", ...],
  disallowedTools: ["Bash", "Task", "TodoWrite", "WebSearch", "WebFetch", "NotebookEdit", "BashOutput", "KillShell", "ExitPlanMode"],
  settingSources: ["project"],
}
```

**Impact:**
- Maintains project settings capability
- Requires manual updates when SDK adds tools
- Blacklist approach: new dangerous tools enabled by default
- Does not address root cause

## Recommendation

**Use Option 2**: Set `settingSources: []`

**Rationale:**
- Whitelist security model (only explicitly allowed tools available)
- No maintenance burden
- Self-documenting
- No workspace dependencies on project settings

**Implementation:**
```typescript
// apps/web/app/api/claude/stream/route.ts:254
settingSources: [],  // Disable project settings - enforce allowedTools whitelist
```

## Verification

After applying fix:

1. Check system:init message in logs shows only allowed tools
2. Verify tool list contains exactly:
   ```javascript
   tools: ['Write', 'Edit', 'Read', 'Glob', 'Grep',
           'mcp__workspace-management__restart_dev_server',
           'mcp__tools__list_guides', 'mcp__tools__get_guide']
   ```
3. Attempt Bash command - should fail with "tool not available"
4. Attempt Task command - should fail with "tool not available"

## Related Files

- `apps/web/app/api/claude/stream/route.ts` - Streaming endpoint (primary fix location)
- `apps/web/app/api/claude/route.ts` - Polling endpoint (has same issue)
- `apps/web/scripts/run-agent.mjs` - Child process runner

---

## Investigation Framework

### Boxes to Tick

1. Verify settingSources is the root cause
2. Confirm no workspaces have .clauderc config files
3. Test that removing settingSources doesn't break existing functionality
4. Verify child process isolation is working correctly
5. Confirm SDK actually loads default tools when settingSources=["project"] and no config exists
6. Test that settingSources=[] prevents tool bypass
7. Verify both streaming and polling endpoints have the issue
8. Confirm fix works in production without restart issues

### Questions to Answer

1. Does SDK load default tools when settingSources=["project"] and no .clauderc exists, or does something else enable extra tools?
2. What exactly happens if a user creates a .clauderc file after the fix?
3. Does the child process runner (run-agent.mjs) have the same issue even though it doesn't set settingSources?
4. Are there other code paths that call the SDK with different options?
5. Does permissionMode="acceptEdits" affect tool availability?
6. Can canUseTool callback block tools even if they're in the tools list?
7. What happens to existing active sessions when the fix is deployed?
8. Is there SDK documentation that explicitly states settingSources overrides allowedTools?

### Proof Strategy

1. Deploy fix to staging, capture system:init message, verify tool list matches allowedTools
2. Attempt to use Bash tool through staging bridge, confirm rejection
3. Create test .clauderc in staging workspace with tool overrides, verify it's ignored
4. Check if run-agent.mjs (child process) exhibits same behavior without explicit settingSources
5. Review SDK source code to confirm settingSources loading mechanism and fallback behavior
6. Test both streaming (/api/claude/stream) and polling (/api/claude) endpoints
7. Monitor production logs after deploy for tool list in system:init messages
8. Create automated test that fails if extra tools appear in system:init
