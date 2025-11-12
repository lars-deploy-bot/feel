# Workspace Tools Security

**CRITICAL SECURITY RULE**: MCP tools NEVER accept `workspaceRoot` from Claude.

## Why This Matters

The Bridge implements multi-tenant security:

1. **User authenticates** for specific workspace (e.g., `example.com`)
2. **Bridge resolves** workspace path via `getWorkspace(host)`
3. **Bridge sets** `process.cwd()` to authenticated workspace
4. **Bridge spawns** MCP tools with dropped privileges (UID/GID of workspace owner)

If tools accepted `workspaceRoot` parameter from Claude, a user authenticated for `example.com` could access files in `other-site.com` by passing a different path.

## Pattern 1: Direct Tools (Preferred)

Tools that execute directly in workspace (no API route needed):

```typescript
import { spawnSync } from "node:child_process"
import { errorResult, successResult, type ToolResult } from "../../lib/bridge-api-client.js"
import { validateWorkspacePath } from "../../lib/workspace-validator.js"

export async function myDirectTool(_params): Promise<ToolResult> {
  // Security: Use Bridge-set workspace, never from user input
  const workspaceRoot = process.cwd()

  try {
    validateWorkspacePath(workspaceRoot)

    const result = spawnSync("command", ["args"], {
      cwd: workspaceRoot,
      encoding: "utf-8",
      timeout: 60000,
    })

    return result.status === 0
      ? successResult("Success")
      : errorResult("Failed", result.stderr)
  } catch (error) {
    return errorResult("Error", error.message)
  }
}
```

**Examples**: `install-package`, `check-codebase`

**Why preferred**: Child process already runs as workspace user with correct permissions. No HTTP roundtrip needed.

## Pattern 2: API Tools (Only When Root Required)

Tools that need root privileges (systemctl, system operations):

```typescript
import { callBridgeApi, type ToolResult } from "../../lib/bridge-api-client.js"

export async function myApiTool(_params): Promise<ToolResult> {
  // Security: Use Bridge-set workspace, never from user input
  const workspaceRoot = process.cwd()

  // Note: API call required because operation needs root (systemctl, etc.)
  return callBridgeApi({
    endpoint: "/api/my-tool",
    body: { workspaceRoot } // Auto-validated, session cookie included
  })
}
```

**Examples**: `restart-server` (needs `systemctl restart`)

**Why API call**: Child process drops privileges and cannot regain root. API route runs in parent process with root access for system operations.

## Security Checklist

- ✅ ALWAYS use `process.cwd()` for workspace
- ✅ NEVER accept `workspaceRoot` parameter from Claude
- ✅ Prefer Pattern 1 (direct execution) unless root required
- ✅ API tools: Use `callBridgeApi()` (auto-validates + includes session cookie)
- ✅ Direct tools: Call `validateWorkspacePath()` explicitly
- ✅ Always `shell: false` in `spawnSync`
- ✅ Always array args: `["bun", "add", pkg]` not string commands

## Why process.cwd() is Safe

The Bridge's `run-agent.mjs` script:
1. Validates user is authenticated for workspace
2. Calls `process.chdir(targetCwd)` to set working directory
3. Drops privileges to workspace user (UID/GID)
4. MCP tools inherit this secure context

Any attempt to access files outside `process.cwd()` is blocked by:
- `validateWorkspacePath()` (direct tools)
- `callBridgeApi()` auto-validation (API tools)
