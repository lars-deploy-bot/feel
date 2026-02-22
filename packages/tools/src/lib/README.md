# Tools Library

Shared utilities for MCP tools.

## tools-api.ts

Typed API client for MCP tools → API server calls.
Uses `@alive-brug/alrighty` `createClient` with a subset of the API schemas.

**Exports:**
- `toolsGetty(endpoint, init?, pathOverride?)` - Typed GET
- `toolsPostty(endpoint, body, init?, pathOverride?)` - Typed POST
- `ApiError` - Error class for API failures

## api-client.ts

Low-level HTTP client for MCP tools → API server calls.
Use `tools-api.ts` for typed calls; use this for untyped workspace tool calls.

**Auto-validates** `workspaceRoot` in request body before HTTP call.

**Exports:**
- `callApi(options)` - Makes HTTP request, auto-validates workspace, formats response
- `successResult(message)` - Creates success ToolResult
- `errorResult(message, details?)` - Creates error ToolResult

## workspace-validator.ts

Validates workspace paths before operations.

**Allowed workspace bases:**
- `/srv/webalive/sites/*`
- `/root/webalive/sites/*`

**Exports:**
- `validateWorkspacePath(workspaceRoot)` - Validates path is within allowed bases
- `hasPackageJson(workspaceRoot)` - Checks if workspace has package.json

**Security:** Prevents path traversal, evil paths, and system path access.
