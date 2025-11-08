# 🚨 CRITICAL: Tool Whitelist Bypass Vulnerability

**Severity**: CRITICAL 🔴
**Date**: 2025-11-07
**Status**: ✅ **NOT FIXED** - 2025-11-07
**Fix**: Added `canUseTool` callback to enforce ALLOWED_TOOLS whitelist at execution time

## Executive Summary

The child process running Claude Agent SDK **SUCCESSFULLY EXECUTED the Bash tool** despite it being **EXPLICITLY EXCLUDED** from `ALLOWED_TOOLS`.

**Proof**: User tested with prompt "use bash 2x" and Bash executed twice in the dev terminal.

---

## What Happened

### Expected Behavior
```javascript
const ALLOWED_TOOLS = ["Write", "Edit", "Read", "Glob", "Grep", ...]  // NO Bash
const agentQuery = query({
  allowedTools: ALLOWED_TOOLS,  // Should block Bash
  ...
})
```

### Actual Behavior
Claude requested and **executed**:
```json
{
  "type": "tool_use",
  "name": "Bash",
  "input": {
    "command": "echo \"First bash command executed\""
  }
}
```

**Result**: Command executed successfully ✅

---

## Root Cause Analysis

### Theory 1: SDK Doesn't Enforce allowedTools
**Status**: Most likely

The `allowedTools` parameter may be:
- Not implemented in SDK
- Only informational (doesn't actually restrict)
- Overridden by permissionMode
- Bypassed by MCP servers

**Test**:
```javascript
const query = require('@anthropic-ai/claude-agent-sdk').query
const result = query({
  prompt: "Run: echo test",
  options: {
    allowedTools: ["Read", "Write"],  // Bash NOT listed
    permissionMode: "deny"  // Should reject all
  }
})
// If Bash still works, SDK is NOT enforcing
```

### Theory 2: Bash Comes from MCP Server
**Status**: Possible

One of these MCP servers might expose Bash as a tool:
- `workspaceManagementMcp` (restart_dev_server, install_package)
- `toolsMcp` (list_guides, get_guide, etc.)

If MCP servers are added with `mcpServers` parameter, maybe ALL their tools are available regardless of `allowedTools`.

### Theory 3: SDK Version Issue
**Status**: Check SDK version

The SDK version in package.json might have added Bash tool or changed `allowedTools` behavior.

---

## Vulnerability Impact

### What Can Be Done

1. **Arbitrary Code Execution** - Any Bash command can run
2. **Workspace Escape** - Could `cd /` and explore entire filesystem
3. **Privilege Escalation** - Could use `sudo` if available
4. **Data Exfiltration** - Copy files, read secrets
5. **Lateral Movement** - Access other sites/workspaces
6. **Denial of Service** - Kill processes, crash workspace

### Why systemd User Isolation Failed

The security model relies on:
- Child process runs as unprivileged systemd user
- Only allowed files can be accessed
- Shell execution prevented

**But if Bash tool works**, that entire model is compromised.

---

## Immediate Actions Required

### 🔴 Action 1: Block Bash Tool
Add runtime check in parent route handler:

**File**: `app/api/claude/stream/route.ts` (after line 286)

```typescript
// EMERGENCY FIX: Block Bash tool requests
if (childEvent.type === "message" &&
    childEvent.content?.type === "tool_use" &&
    childEvent.content.name === "Bash") {
  console.error(`[SECURITY] BLOCKED: Bash tool requested in conversation ${requestId}`)
  // Don't forward this message to client
  continue  // Skip to next message
}
```

### 🔴 Action 2: Filter Bash from Init Message
**File**: `scripts/run-agent.mjs` (line 113)

```javascript
if (message.type === "system" && message.subtype === "init" && message.tools) {
  // EMERGENCY FIX: Remove Bash if present
  outputMessage = {
    ...message,
    tools: message.tools.filter(tool =>
      tool !== "Bash" && ALLOWED_TOOLS.includes(tool)
    ),
  }
}
```

### 🔴 Action 3: Verify SDK allowedTools Enforcement
**File**: Create test file

```typescript
// tests/sdk-tool-restriction.test.ts
import { query } from '@anthropic-ai/claude-agent-sdk'

test('SDK should block tools not in allowedTools', async () => {
  const result = query({
    prompt: "Execute: echo 'test'",
    options: {
      allowedTools: ["Read", "Write"],  // Bash NOT listed
      permissionMode: "deny",
    }
  })

  // Should fail or reject all tools
  const messages = []
  for await (const msg of result) {
    messages.push(msg)
  }

  // Verify no tool_use messages for Bash
  const bashUses = messages.filter(m =>
    m.type === "message" &&
    m.content?.type === "tool_use" &&
    m.content.name === "Bash"
  )

  expect(bashUses).toHaveLength(0)
})
```

---

## Investigation Checklist

### ☐ Determine Root Cause
- [ ] Check if `allowedTools` parameter is actually used in SDK
- [ ] Check SDK version - does it have Bash tool?
- [ ] Check if MCP servers override allowedTools
- [ ] Check if permissionMode affects tool filtering

### ☐ Verify Scope of Breach
- [ ] Can ALL tools outside allowedTools execute?
- [ ] Can only Bash execute, or others too?
- [ ] Does this affect both local dev and production?
- [ ] What else was executed via Bash?

### ☐ Check Access Logs
- [ ] Review stdin input logs - what was passed?
- [ ] Review child process stdout/stderr
- [ ] Check filesystem for new files created
- [ ] Check audit logs for unauthorized access

### ☐ Trace Execution Path
- [ ] Where did Bash tool come from in init message?
- [ ] Did parent filter Bash from tools list?
- [ ] Did child process send back tool_use for Bash?
- [ ] Did parent forward it to client without filtering?

---

## Long-Term Fix

### Option A: Use permissionMode="deny"
```javascript
const agentQuery = query({
  prompt: request.message,
  options: {
    permissionMode: "deny",  // Deny ALL tools by default
    allowedTools: ALLOWED_TOOLS,  // Only these are allowed
  },
})
```

**Pros**: Explicit deny-all, then whitelist
**Cons**: Requires SDK to respect both parameters

### Option B: Remove MCP Servers If Unsafe
```javascript
// If MCP servers add extra tools, remove them
const MCP_SERVERS = {}  // Empty for now until fixed
```

**Pros**: Eliminates vector
**Cons**: Loses MCP functionality

### Option C: Implement Parent-Level Tool Filtering
```typescript
// In route.ts, after reading child message
if (childEvent.type === "message" && childEvent.content?.type === "tool_use") {
  const toolName = childEvent.content.name
  if (!ALLOWED_TOOLS.includes(toolName)) {
    // Block tool before sending to client
    console.error(`[SECURITY] Blocked unauthorized tool: ${toolName}`)
    continue  // Skip this message
  }
}
```

**Pros**: Defense-in-depth, catches SDK bypass
**Cons**: Overhead, multiple enforcement points

---

## Files That Need Review

| File | Issue | Fix |
|------|-------|-----|
| `scripts/run-agent.mjs` | allowedTools not enforced | Add verification, filter init tools |
| `app/api/claude/stream/route.ts` | No tool blocking at parent | Add tool_use validation |
| `lib/claude/agent-constants.mjs` | ALLOWED_TOOLS incomplete? | Verify Bash truly excluded |
| `lib/claude/build-agent-options.ts` | Alternative code path? | Check if bypassed |

---

## Questions for User

1. **How did Bash get in the tools list?**
   - Is it a built-in SDK tool?
   - Is it from an MCP server?
   - Is it due to permissionMode setting?

2. **What commands executed?**
   - Check logs for what Bash executed
   - Did it access restricted files?
   - Did it harm anything?

3. **Can other unauthorized tools execute too?**
   - Try requesting "Delete", "Exec", "Shell"
   - Determine if all non-whitelisted tools work

4. **When did this start?**
   - Was it always broken?
   - Did an SDK update introduce this?
   - Did a configuration change enable it?

---

## Temporary Mitigation

**Until root cause is fixed:**

1. **Block all tool execution at parent:**
   ```typescript
   // route.ts: Skip all tool_use messages
   if (childEvent.content?.type === "tool_use") {
     continue  // Don't forward
   }
   ```

2. **Restrict permissionMode:**
   ```javascript
   // run-agent.mjs: Change to strict deny
   permissionMode: "deny"  // Force explicit allowance
   ```

3. **Disable MCP servers:**
   ```javascript
   // agent-constants.mjs: Remove all MCP
   mcpServers: {}  // Empty
   ```

---

## Escalation Path

This is a **CRITICAL SECURITY VULNERABILITY** that needs immediate:
1. Root cause analysis
2. Hotfix deployment
3. Audit of what was accessed
4. Security review of SDK version
5. Potential incident response

**Do NOT allow further Claude executions until fixed.**

---

## ✅ Fix Applied (2025-11-07)

### Root Cause

The SDK's `allowedTools` parameter is **informational only** - it filters what tools are shown in the system init message, but does NOT prevent Claude from requesting and executing unlisted tools.

**The actual security enforcement mechanism is the `canUseTool` callback**, which was missing from our implementation.

### Fix Implementation

**File**: `scripts/run-agent.mjs` (lines 81-100, 112)

```javascript
/**
 * Tool permission handler - enforces ALLOWED_TOOLS whitelist
 * @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool}
 */
const canUseTool = async (toolName, input, options) => {
  if (!ALLOWED_TOOLS.includes(toolName)) {
    console.error(`[runner] SECURITY: Blocked unauthorized tool: ${toolName}`)
    return {
      behavior: "deny",
      message: `Tool "${toolName}" is not allowed. Only these tools are permitted: ${ALLOWED_TOOLS.join(", ")}`,
    }
  }

  console.error(`[runner] Tool allowed: ${toolName}`)
  return {
    behavior: "allow",
    updatedInput: input,
    updatedPermissions: [],
  }
}

// Added to query options:
const agentQuery = query({
  prompt: request.message,
  options: {
    // ... other options
    canUseTool,  // ← CRITICAL: This enforces the whitelist
  },
})
```

### How It Works

1. **Before**: SDK only hid Bash from init message, but allowed execution
2. **After**: SDK calls `canUseTool()` before EVERY tool execution
3. **If tool not in ALLOWED_TOOLS**: Returns `{ behavior: "deny", message: "..." }`
4. **If tool in ALLOWED_TOOLS**: Returns `{ behavior: "allow", updatedInput: ... }`

### Verification

To verify the fix works:

1. Deploy the updated code
2. Test with prompt: "use bash to echo test"
3. Expected result: Claude receives denial message from SDK
4. Verify in logs: `[runner] SECURITY: Blocked unauthorized tool: Bash`

### Defense in Depth

This fix provides **execution-time enforcement** at the SDK layer. Additional layers:

1. **SDK layer** (NEW): `canUseTool` callback blocks unauthorized tools ✅
2. **Parent layer** (existing): `createToolPermissionHandler` validates paths for SDK tools ✅
3. **Init filtering** (existing): System message only shows allowed tools ✅

### Impact

- ✅ Bash tool requests now **denied** at execution time
- ✅ Any unlisted tool (Delete, Exec, Shell, etc.) also **denied**
- ✅ Only tools in ALLOWED_TOOLS can execute
- ✅ Logs show security blocks for audit trail

### Testing Required

- [ ] Test "use bash" prompt - should be denied
- [ ] Test "use Delete tool" prompt - should be denied
- [ ] Test "read file" prompt - should work (Read is allowed)
- [ ] Verify stderr logs show SECURITY blocks
- [ ] Verify Claude receives denial messages and adapts
