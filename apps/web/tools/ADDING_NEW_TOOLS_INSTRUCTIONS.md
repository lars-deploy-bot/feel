# Adding New Tools to Claude Bridge

This directory contains custom MCP tools that extend Claude's capabilities beyond the built-in SDK tools (Read, Write, Edit, Glob, Grep).

## Architecture (Read This First)

**Two-Process Model:**
- **Parent** (`/app/api/claude/stream/route.ts`): SDK runs as root → files owned by root
- **Child** (`/scripts/run-agent.mjs`): SDK runs as workspace user → files owned by workspace user
- **Auto-detection:** Checks directory ownership with `shouldUseChildProcess()`

**Why Tools Call localhost APIs:**
- Child process = workspace user (no root access)
- Parent PM2 process = root
- Tools call `localhost:8998/api/*` to execute privileged operations (systemctl, etc.)

**MCP Tool Naming:**
```
tool("restart_dev_server")  →  createSdkMcpServer({ name: "workspace-management" })
    └─→ Full name: "mcp__workspace-management__restart_dev_server"
                    (use this in allowedTools)
```

## Critical Requirements

### 1. Zod Version - MUST BE 3.x

⚠️ **IMPORTANT:** The SDK requires Zod 3.25.0+ but is **NOT compatible with Zod 4.x**

```bash
# Correct version
bun add zod@^3.25.0

# WRONG - Will cause "keyValidator._parse is not a function" error
bun add zod@^4.0.0
```

**Why:** Zod 4.x changed internal APIs. The SDK uses `_parse` method which doesn't exist in v4.

### 2. Schema Format - Raw Shape, NOT z.object()

```typescript
// ✅ CORRECT - Pass raw Zod shape
tool(
  "my_tool",
  "Description",
  {
    field: z.string().describe("Field description")
  },
  async (args) => { /* handler */ }
)

// ❌ WRONG - Don't wrap in z.object()
tool(
  "my_tool",
  "Description",
  z.object({  // SDK wraps this internally!
    field: z.string().describe("Field description")
  }),
  async (args) => { /* handler */ }
)
```

**Why:** The SDK's `tool()` function expects a raw Zod shape object and wraps it internally.

### 3. MCP Servers Config - Object, NOT Array

```typescript
// ✅ CORRECT - Object with server name as key
const claudeOptions: Options = {
  mcpServers: {
    "server-name": myMcpServer
  }
}

// ❌ WRONG - Array format doesn't work
const claudeOptions: Options = {
  mcpServers: [myMcpServer]
}
```

### 4. Tool Names - Use Full MCP Prefix

When MCP tools are registered, they get prefixed with `mcp__{server-name}__{tool-name}`.

```typescript
// Tool definition
const myTool = tool("restart_dev_server", "Description", schema, handler)

// MCP server
const myServer = createSdkMcpServer({
  name: "workspace-management",
  tools: [myTool]
})

// ✅ CORRECT - Use full MCP name in allowedTools
allowedTools: [
  "Write", "Edit", "Read", "Glob", "Grep",
  "mcp__workspace-management__restart_dev_server"
]

// ❌ WRONG - Just the tool name won't work
allowedTools: ["restart_dev_server"]
```

## How to Add a New Tool

### Step 1: Create the Tool File

Create a new file in `/tools` (e.g., `my-tool.ts`):

```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

const myCustomTool = tool(
  "my_tool_name",
  "Clear description of what this tool does and when to use it.",
  {
    // Raw Zod shape - no z.object() wrapper!
    param1: z.string().describe("Description of param1"),
    param2: z.number().optional().describe("Optional param2")
  },
  async (args) => {
    const { param1, param2 } = args

    try {
      // Your tool logic here
      const result = doSomething(param1, param2)

      return {
        content: [
          {
            type: "text" as const,
            text: `✓ Success: ${result}`
          }
        ],
        isError: false
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      return {
        content: [
          {
            type: "text" as const,
            text: `✗ Error: ${errorMessage}`
          }
        ],
        isError: true
      }
    }
  }
)

export const myToolMcp = createSdkMcpServer({
  name: "my-tool-category",
  version: "1.0.0",
  tools: [myCustomTool]
})
```

### Step 2: Register in Parent Route Handler

For **parent process** (root-owned workspaces), update `/app/api/claude/stream/route.ts`:

```typescript
import { myToolMcp } from "@/tools/my-tool"

const claudeOptions: Options = {
  cwd,
  allowedTools: [
    "Write", "Edit", "Read", "Glob", "Grep",
    "mcp__my-tool-category__my_tool_name"  // Add your tool
  ],
  permissionMode: "acceptEdits",
  canUseTool,
  maxTurns: effectiveMaxTurns,
  systemPrompt: getSystemPrompt({...}),
  settingSources: ["project"],
  model: env.CLAUDE_MODEL,
  mcpServers: {
    "my-tool-category": myToolMcp  // Add your server
  },
  ...(existingSessionId ? { resume: existingSessionId } : {}),
}
```

### Step 3: Register in Child Process

For **child process** (systemd workspaces), update `/scripts/run-agent.mjs`:

```javascript
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

// Copy your tool definition here (or import if using ES modules)
const myCustomTool = tool(
  "my_tool_name",
  "Description",
  {
    param1: z.string().describe("Description")
  },
  async (args) => {
    // Tool implementation
  }
)

const myToolMcp = createSdkMcpServer({
  name: "my-tool-category",
  version: "1.0.0",
  tools: [myCustomTool]
})

// In the query options
const agentQuery = query({
  prompt: request.message,
  options: {
    cwd: process.cwd(),
    model: request.model,
    maxTurns: request.maxTurns || 25,
    permissionMode: "acceptEdits",
    allowedTools: [
      "Write", "Edit", "Read", "Glob", "Grep",
      "mcp__my-tool-category__my_tool_name"  // Add your tool
    ],
    mcpServers: {
      "my-tool-category": myToolMcp  // Add your server
    },
    systemPrompt: request.systemPrompt,
    resume: request.resume
  }
})
```

### Step 4: Test the Tool

Restart the staging server:

```bash
pm2 restart claude-bridge-staging
```

Then ask Claude to use the tool in a conversation.

## Working Example: RestartDevServer

See `/tools/restart-server.ts` for a complete working example that:
- Takes workspace root as input
- Calls an API endpoint (which runs as root via PM2)
- Returns success/error feedback
- Works in both parent and child processes

## Tool Response Format

All tools must return `CallToolResult`:

```typescript
type CallToolResult = {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;  // For type: 'text'
    // Additional fields vary by type
  }>;
  isError?: boolean;
}
```

**For text responses:**
```typescript
{
  content: [
    {
      type: "text" as const,
      text: "Response message"
    }
  ],
  isError: false
}
```

## Multiple Tools per MCP Server

You can group related tools in one MCP server:

```typescript
export const workspaceToolsMcp = createSdkMcpServer({
  name: "workspace-management",
  version: "1.0.0",
  tools: [
    restartServerTool,
    clearCacheTool,
    viewLogsTool
  ]
})
```

Each tool will be prefixed: `mcp__workspace-management__restart_dev_server`, etc.

## Common Errors & Solutions

### Error: "keyValidator._parse is not a function"

**Cause:** Using Zod 4.x instead of Zod 3.x

**Solution:** Downgrade to Zod 3.x:
```bash
bun remove zod && bun add zod@^3.25.0
```

### Error: Tool doesn't appear in Claude's tool list

**Cause:** Missing MCP prefix in `allowedTools` or wrong `mcpServers` format

**Solution:** Use full tool name: `mcp__server-name__tool-name` and object format for `mcpServers`

### Error: Permission prompts appearing

**Cause:** `permissionMode` not set correctly

**Solution:** Use `permissionMode: "acceptEdits"` (not `"default"`)

## Tool vs API Endpoint

**Use MCP tool when:** Claude decides when to invoke it (agentic behavior)
**Use API endpoint when:** User/system triggers it directly (button, webhook)

Example: `restart_dev_server` is a tool because Claude decides if restart is needed.

## Important Notes

- Use snake_case for tool names
- Be specific in descriptions (Claude uses them to decide when to invoke)
- Always wrap in try/catch
- Register tools in BOTH parent AND child for systemd workspaces
- Use `localhost:8998` (staging) or `localhost:8999` (production) for privileged ops
- No sudo needed (APIs run as root via PM2)

## Debugging

**Tool not appearing:**
```bash
pm2 logs claude-bridge-staging --lines 50 | grep -i mcp
# Check tool name: mcp__server-name__tool-name
```

**Tool fails:**
```bash
# Test API directly
curl -X POST http://localhost:8998/api/your-endpoint -H "Content-Type: application/json" -d '{"param": "value"}'

# Check logs
pm2 logs claude-bridge-staging | grep -i error
```

## SDK Documentation

For more details, see the official SDK documentation:
- [Custom Tools Guide](https://docs.anthropic.com/en/docs/agents-and-tools/custom-tools)
- [TypeScript SDK Reference](https://docs.anthropic.com/en/api/agent-sdk/typescript)
