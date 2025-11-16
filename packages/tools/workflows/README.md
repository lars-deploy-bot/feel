# Alive Workflows

Workflow decision trees for handling specific request types using Alive's tools.

## Purpose

These workflows guide the AI agent through step-by-step processes for common tasks. They use **Alive's actual tools** (not Lovable's) and are tailored to our multi-workspace architecture.

## Available Workflows

1. **Bug Debugging** (`01-bug-debugging-request.md`)
   - Debugging workspace issues
   - Using `debug_workspace`, `read_server_logs`, `check_codebase`
   - Server restart and Vite cache clearing

2. **New Feature** (`02-new-feature-request.md`)
   - Implementing new features
   - Package installation and code organization
   - Refactoring patterns

3. **Package Installation** (`03-package-installation.md`)
   - Installing npm packages
   - Handling type definitions
   - Verifying installations

## Tool Categories

### SDK Tools (Always Available)
- `Read(path)` - Read file contents
- `Write(path, content)` - Create new file
- `Edit(path, changes)` - Modify existing file
- `Glob(pattern)` - Find files by pattern
- `Grep(pattern, path)` - Search code

### Alive Tools MCP Server (`mcp__alive-tools__*`)
- `search_tools` - Discover available tools
- `debug_workspace` - Quick workspace debugging (composite)
- `read_server_logs` - Read systemd logs with filtering
- `generate_persona` - Generate AI personas

### Alive Workspace MCP Server (`mcp__alive-workspace__*`)
- `restart_dev_server` - Restart systemd service, clear Vite cache
- `install_package` - Install npm package via bun
- `check_codebase` - Run TypeScript + ESLint checks

## Usage

Workflows are retrieved via the `get_workflow` tool:

```typescript
get_workflow({ 
  workflow_type: "bug-debugging",
  detail_level: "standard" 
})
```

**Workflow Types:**
- `bug-debugging` - Debugging workflows
- `new-feature` - Feature implementation workflows
- `package-installation` - Package installation workflows

**Detail Levels:**
- `minimal` - Overview only
- `standard` - Complete decision tree (default)
- `full` - Decision tree + examples

## Architecture Notes

- **Multi-workspace**: Tools operate on workspace-scoped paths
- **Systemd services**: Each workspace has its own systemd service
- **Vite cache**: `restart_dev_server` clears Vite cache
- **File ownership**: Tools run as workspace user (via child process)
- **API calls**: Privileged operations use Bridge API (systemctl, etc.)

## Adding New Workflows

1. Create markdown file: `packages/tools/workflows/XX-workflow-name.md`
2. Follow existing workflow format:
   - Scenario
   - Agent Capabilities
   - Decision Tree
   - Tool Sequence Examples
   - Critical Rules
   - Common Mistakes
   - Tool Reference
3. Update `get_workflow` tool to include new workflow type
4. Update this README

## Workflow Structure

Workflows are self-contained decision trees that guide the AI through common tasks using only available tools. Each workflow includes:
- Scenario description
- Available tools
- Decision tree
- Tool sequence examples
- Critical rules
- Common mistakes
- Tool reference

